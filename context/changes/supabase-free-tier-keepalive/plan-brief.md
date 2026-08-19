# Supabase Free-Tier Keep-Alive — Plan Brief

> Full plan: `context/changes/supabase-free-tier-keepalive/plan.md`
> Requirements: `context/changes/supabase-free-tier-keepalive/requirements.md`

## What & Why

This change prevents the FairShare Family Supabase Free project from becoming
idle by running a minimal database RPC once every day through its existing
Cloudflare Worker. The solution stays in this repository and is explicitly a
best-effort free-tier safeguard, not a paid-plan availability guarantee.

## Starting Point

The app is an Astro 6 server-rendered Cloudflare Worker using the adapter's
default entrypoint. It already has server-only Supabase URL and anon-key
secrets, but no Cron Trigger or safe anonymous database query; all financial
data is protected by forced RLS for authenticated users.

## Desired End State

At 09:00 UTC each day Cloudflare invokes the Worker's `scheduled` handler, and
the handler makes one no-data Supabase RPC request. A failure is visible in
Cloudflare Cron Events, while browser traffic, Astro SSR, authentication, asset
delivery, and financial-data boundaries are unaffected.

## Key Decisions Made

| Decision           | Choice                           | Why                                                                            |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------ |
| Ownership          | This application repository      | The Worker and required secrets already deploy here.                           |
| Plan tier          | Remain on Free                   | The goal is to avoid a paid upgrade for this personal application.             |
| Activity frequency | Once daily at 09:00 UTC          | Chosen minimal recurring activity.                                             |
| Scheduler          | Cloudflare Worker Cron Trigger   | Runs inside the existing deployment without a public route or side repository. |
| Database access    | No-data RPC executable by `anon` | Avoids service-role access and protected-table reads.                          |
| Failure behavior   | Propagate failure to Cloudflare  | Preserves Cron Event visibility rather than masking outages with retries.      |

## Scope

**In scope:** additive RPC migration, Worker scheduled handler, daily Wrangler
trigger, focused tests, and operating documentation.

**Out of scope:** Pro upgrade, SLA, UI, service-role credentials, external
scheduler, backups, and access to application data.

## Architecture / Approach

`Cloudflare Cron Trigger → src/worker.ts scheduled() → small testable request
utility → Supabase /rest/v1/rpc/keep_alive → fixed scalar response`. Normal
HTTP requests still flow through Astro's Cloudflare `handle()` function.

## Phases at a Glance

| Phase                           | What it delivers                                  | Key risk                                             |
| ------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| 1. Secure database contract     | No-data anon RPC and pgTAP authorization proof    | Accidentally broadening database access              |
| 2. Scheduled Worker integration | Worker wrapper, daily trigger, tests, and runbook | Regressing Astro request handling or hiding failures |

**Prerequisites:** Existing Worker secrets remain configured; local Supabase
stack is available for pgTAP; Cloudflare Builds deploys `main`.

**Estimated effort:** One focused implementation session plus a next-day Cron
Event verification.

## Open Risks & Assumptions

- Supabase retains its current Free-plan activity behavior; only Pro guarantees
  no inactivity pausing.
- One daily query is the user-selected cadence and has less redundancy than a
  more frequent schedule.
- Cloudflare Cron configuration changes can take time to propagate.

## Success Criteria (Summary)

- The deployed Worker records a successful daily Cron Event that reaches the
  no-data Supabase RPC.
- No secret, financial data, service-role key, or public app endpoint is added.
- Existing application verification and database authorization tests pass.
