# Supabase Free-Tier Keep-Alive Implementation Plan

## Overview

Keep the FairShare Family Supabase Free project active by adding a once-daily
Cloudflare Worker Cron Trigger that invokes a dedicated no-data Supabase RPC.
The change stays inside this application repository and does not add a
service-role key, a public application route, or access to financial data.

## Current State Analysis

`wrangler.jsonc` uses Astro's default Cloudflare Worker entrypoint and defines
no Cron Trigger. `astro.config.mjs` declares the existing server-only
`SUPABASE_URL` and anon `SUPABASE_KEY` secrets. The current request client
intentionally carries a user's session, while all financial tables grant reads
only to `authenticated`; therefore the scheduled process cannot safely reuse a
financial query or the request-scoped client.

The project deploys from `main` through Cloudflare Workers Builds, and
`supabase/tests/` provides pgTAP coverage for database permissions. Supabase
Free-plan inactivity prevention remains best effort; it is not an availability
guarantee.

## Desired End State

The deployed Worker runs at 09:00 UTC every day and makes one successful,
minimal database RPC request using its existing runtime secrets. The RPC is
safe for the `anon` role, returns a fixed non-sensitive value, and neither
reads nor changes application data. Failed calls are reported as failed Cron
events in Cloudflare; regular browser requests continue through Astro exactly
as before.

### Key Discoveries

- `wrangler.jsonc` currently points at
  `@astrojs/cloudflare/entrypoints/server`; Astro 6 supports a custom Worker
  entrypoint that delegates normal requests through
  `@astrojs/cloudflare/handler`.
- `src/lib/supabase.ts` prohibits a service-role client and its user-session
  client cannot perform an anonymous scheduled query.
- `supabase/migrations/20260717160000_financial_rules_foundation.sql:241-277`
  enables forced RLS and grants financial-table reads only to
  `authenticated`.
- `context/changes/deployment/deployment-plan.md:34` establishes that the
  Worker must contain only the anon key and never a service-role key.

## What We're NOT Doing

- Upgrading Supabase, adding a separate scheduler repository, or providing an
  uptime/SLA guarantee.
- Adding a browser-accessible keep-alive endpoint, user interface, backup job,
  or a query against family, expense, or settlement data.
- Adding retries that can mask a failed Cron run; Cloudflare's Cron Events are
  the operational signal for failure.

## Implementation Approach

Create a narrow SQL function with no table access, revoke its default public
permission, and grant execution only to `anon`. Introduce a custom Worker
entrypoint that preserves Astro's `fetch` path and adds a `scheduled` path.
Put the actual HTTP request into a small testable server utility, then configure
one version-controlled daily trigger and document how to observe it.

## Critical Implementation Details

The Worker must invoke `/rest/v1/rpc/keep_alive` directly rather than issue a
request back to its own public application URL. Its normal `fetch` handler must
delegate to Astro's Cloudflare `handle()` helper; replacing it would bypass
asset handling, `Astro.locals.cfContext`, and middleware setup.

## Phase 1: Add the least-privileged database activity contract

### Overview

Provide a database call that counts as Supabase API/database activity without
exposing or modifying family data.

### Changes Required

#### 1. Keep-alive RPC migration

**File**: `supabase/migrations/<timestamp>_supabase_keep_alive.sql`

**Intent**: Define the isolated, read-only RPC used only for automated
inactivity prevention.

**Contract**: `public.keep_alive()` takes no arguments and returns a fixed
boolean or scalar value. It must not read tables, write data, or use elevated
privileges. Revoke the default `PUBLIC` execute grant and grant execution only
to `anon`; leave all existing table and function permissions unchanged.

#### 2. Database authorization coverage

**File**: `supabase/tests/supabase_keep_alive.test.sql`

**Intent**: Prove that the new anonymous RPC is harmless and callable with the
same role represented by the deployed anon key.

**Contract**: Under `anon`, assert the RPC returns its fixed value, existing
financial tables remain unreadable, and the test transaction rolls back.

### Success Criteria

#### Automated Verification

- The migration applies to the local Supabase stack.
- `npx supabase test db` passes, including the new anonymous-role test.

#### Manual Verification

- In local Supabase Studio or through the local REST RPC endpoint, an anon-key
  call succeeds and returns only the fixed keep-alive value.

**Implementation Note**: After this phase passes, pause for human confirmation
that the manual RPC result contains no application data before Phase 2.

---

## Phase 2: Schedule the Worker-owned keep-alive

### Overview

Add the Cloudflare Worker schedule while retaining all current Astro SSR and
asset behavior.

### Changes Required

#### 1. Testable Supabase keep-alive caller

**Files**: `src/lib/supabase-keep-alive.ts`, `src/lib/supabase-keep-alive.test.ts`

**Intent**: Isolate the scheduled Supabase RPC request from the Worker adapter
wrapper so request construction and failure handling are deterministic in
Vitest.

**Contract**: Accept the Supabase URL/key and a fetch implementation; send one
`POST` request to `/rest/v1/rpc/keep_alive` with the anon key only in headers.
Resolve only for an OK response; throw an error containing the HTTP status but
never the URL credentials, response body, or key. Reject missing configuration
before attempting a request.

#### 2. Custom Cloudflare Worker entrypoint

**File**: `src/worker.ts`

**Intent**: Handle the Cron event internally while forwarding every normal HTTP
request through Astro's supported Cloudflare handler.

**Contract**: Export a standard Worker object with `fetch` delegating to
`handle(request, env, ctx)` and `scheduled` awaiting the utility from item 1.
The scheduled handler must propagate failed calls so Cloudflare records a
failed Cron event, while logging only a generic success/failure message and
status context.

#### 3. Worker deployment configuration and operator documentation

**Files**: `wrangler.jsonc`, `README.md`

**Intent**: Version-control the production schedule and give the owner a clear
verification and recovery procedure.

**Contract**: Point Wrangler `main` to `src/worker.ts` and configure exactly
one `0 9 * * *` Cron Trigger (UTC). Preserve the existing Worker name,
compatibility settings, assets binding, preview setting, and observability.
Document the existing required secrets, Cloudflare Cron Events verification,
and the manual Supabase dashboard-resume fallback; do not add any credentials
to tracked files.

### Success Criteria

#### Automated Verification

- Vitest covers success, missing configuration, and non-OK RPC responses
  without exposing the anon key in assertion output.
- `npm run verify` passes with the custom Worker entrypoint and current Astro
  build.
- `npx supabase test db` remains green after the application-side changes.

#### Manual Verification

- Deploy through the normal Cloudflare Workers Build on a merge to `main` and
  verify `SUPABASE_URL` and `SUPABASE_KEY` remain configured as Worker secrets.
- Confirm the `0 9 * * *` trigger appears in the Worker settings and, after it
  runs, appears as a successful Cloudflare Cron Event.
- Load an authenticated app page and a static asset after deployment to confirm
  Astro SSR, Supabase auth, and asset delivery are unchanged.

**Implementation Note**: After the automated checks pass, pause for human
confirmation of the production Cron Event before treating this phase as done.

## Testing Strategy

### Unit Tests

- Exact RPC path, POST method, and anon-key header construction.
- Successful response handling, missing secret rejection, and non-OK status
  propagation without sensitive logging.

### Database Tests

- The `anon` role executes only the no-data RPC and receives its fixed result.
- Existing RLS boundaries remain effective for financial tables.

### Manual Testing Steps

1. Start the local Supabase stack, apply the migration, and invoke the RPC with
   the local anon key.
2. Build and preview/deploy the Worker with the normal secret configuration.
3. Inspect the deployed Cron Trigger and its first event, then smoke-test an
   authenticated page and a static asset.

## Performance Considerations

One constant-time database RPC request per day has negligible application and
database cost. No data is fetched, stored, cached, or retried.

## Migration Notes

The database migration is additive and forward-only. Rolling back the Worker
configuration stops the scheduled traffic; the harmless RPC may remain in the
database without affecting application behavior. Removing it later requires a
separate forward migration after the Cron Trigger is disabled.

## References

- Requirements: `context/changes/supabase-free-tier-keepalive/requirements.md`
- Deployment convention: `context/changes/deployment/deployment-plan.md:34-42`
- Supabase client boundary: `src/lib/supabase.ts:6-25`
- RLS grants: `supabase/migrations/20260717160000_financial_rules_foundation.sql:241-277`
- Cloudflare Cron Trigger documentation: https://developers.cloudflare.com/workers/configuration/cron-triggers/
- Supabase project-pausing documentation: https://supabase.com/docs/guides/platform/free-project-pausing

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Add the least-privileged database activity contract

#### Automated

- [x] 1.1 Add the no-data anonymous keep-alive RPC migration
- [x] 1.2 Verify the RPC and existing RLS boundaries with pgTAP

#### Manual

- [x] 1.3 Confirm the local anon RPC result exposes no application data

### Phase 2: Schedule the Worker-owned keep-alive

#### Automated

- [ ] 2.1 Add and test the server-side Supabase keep-alive caller
- [ ] 2.2 Add the Astro-preserving Cloudflare Worker scheduled handler
- [ ] 2.3 Configure the daily Worker Cron Trigger and document operations
- [ ] 2.4 Run application and database verification suites

#### Manual

- [ ] 2.5 Confirm the deployed Cron Trigger records a successful event
- [ ] 2.6 Smoke-test existing SSR, auth, and static-asset behavior
