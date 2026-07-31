# Supabase Cookie Refresh — Plan Brief

> Full plan: `context/changes/supabase-cookie-refresh/plan.md`
> Frame brief: `context/changes/supabase-cookie-refresh/frame.md`

## What & Why

The issue is not merely a noisy Astro log. Dashboard and reports violate a single request-scoped Supabase-client boundary: a late-rendered component can refresh the auth session after headers are committed, while duplicate clients repeatedly read stale request cookies. The change centralizes the client in middleware and removes server-rendered component client creation.

## Starting Point

Middleware already creates a Supabase client and calls `auth.getUser()`, but neither pages nor API routes reuse it. Dashboard creates a second client and its imported expense component creates a third; all independently read the original request cookie header.

## Desired End State

Each request has one nullable, server-only Supabase SSR client initialized in middleware. Session refresh happens before rendering, refreshed cookies reach the browser, and all application consumers use that same client without changing their user-facing behavior.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Client ownership | Middleware owns one client per request | It is the safe pre-render point for token refresh and response-cookie writes. | Frame |
| Scope | Update pages, component, and all API handlers | The invariant must apply to every request, not just the visible warning path. | Plan |
| Verification | Lint/build plus manual refresh test | Existing tests cannot simulate Astro’s streamed response-header timing. | Plan |

## Scope

**In scope:**

- Typed `locals.supabase` set in middleware
- Reuse in pages, the expense workspace component, and 14 API routes
- Automated checks and expired-session browser verification

**Out of scope:**

- Schema, RLS, Supabase project configuration, or auth-provider changes
- Service-role access or a new browser/integration test framework

## Architecture / Approach

`request → middleware creates client, refreshes/reads user, stores both in locals → page or API route reuses locals client → component receives the existing client as a prop`. Only middleware may invoke the cookie-writing client factory.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Establish one request-scoped client | All application consumers reuse middleware locals. | Missing a consumer or changing a nullable guard. |
| 2. Verify token-refresh persistence | Proof that a refreshed session sets cookies with no Astro warning. | Reproducing an expired/refreshable local session. |

**Prerequisites:** Local Supabase configuration and a test account able to sign in.
**Estimated effort:** One focused implementation session plus manual browser verification.

## Open Risks & Assumptions

- Middleware runs for every affected route, including auth endpoints, as it does today.
- The supplied `_callRefreshToken` stack is reproducible with an expired or refreshable local session.

## Success Criteria (Summary)

- Dashboard and reports maintain authenticated behavior while using no component-created SSR client.
- Auth, family, and expense API behaviors are unchanged.
- A refreshable session persists refreshed auth cookies without Astro’s late-cookie warning.
