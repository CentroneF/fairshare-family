# Supabase Cookie Refresh Implementation Plan

## Overview

Centralize the Supabase SSR client at the middleware boundary and reuse it throughout each request. This prevents a late-rendered Astro component from refreshing a session after response cookies have been committed, while preserving authentication and RLS behavior for pages and API routes.

## Current State Analysis

`createClient()` creates a new cookie-writing server client on every call. Middleware authenticates with one instance, dashboard and reports create their own instances, and `ExpenseWorkspace` creates another inside imported component frontmatter. Each instance parses the immutable original request `Cookie` header, so a refresh performed by middleware is not shared with a later client.

There is no existing `locals.supabase` type or reuse pattern. The codebase has Vitest coverage for domain libraries only; it has no Astro server-render/middleware harness that can reproduce a headers-already-sent response.

## Desired End State

Every request receives exactly one nullable Supabase SSR client from middleware. Middleware performs the user lookup (and any session refresh) before page rendering; pages, server-rendered components, and API routes reuse that client from locals. A request with a refreshable expired session persists the refreshed cookies without Astro logging a late cookie write, while dashboard, reports, sign-in/out/up, and financial/family actions continue to work.

### Key Discoveries:

- `src/lib/supabase.ts:11-20` reads the original request cookie header and is the sole bridge from Supabase `setAll` to `Astro.cookies.set`.
- `src/middleware.ts:7-13` already establishes the correct early request lifecycle point for `auth.getUser()`.
- `src/components/expenses/ExpenseWorkspace.astro:17-18` creates the late component-level client that directly matches the warning stack.
- `src/env.d.ts:1-4` currently declares only `locals.user`, so the shared client contract must be typed before consumers are changed.
- Current automated coverage is domain-only; real expired-token verification is required for the original production symptom.

## What We're NOT Doing

- Changing Supabase project configuration, database schema, migrations, RLS policies, or authentication providers.
- Introducing a service-role client or exposing server credentials to browser code.
- Altering redirects, JSON response contracts, form behavior, or financial authorization rules.
- Adding an Astro integration-test framework solely to simulate streamed response headers.

## Implementation Approach

Keep `createClient()` as the only Supabase SSR factory, but invoke it only in middleware. Store its nullable result on `context.locals` before calling `auth.getUser()`. Replace every same-request factory call with the typed local client. Pages pass that client into server-rendered components that need data access; components must not construct cookie-capable clients themselves. API endpoints reuse the middleware instance, including auth endpoints whose sign-in, sign-up, or sign-out actions intentionally update cookies before their redirect response is returned.

## Critical Implementation Details

The middleware must assign `context.locals.supabase` before the `auth.getUser()` call and before `next()`. This preserves the only safe point for a Supabase token refresh to modify the response cookie headers. Keep the local client nullable so the current graceful behavior when Supabase environment variables are absent remains unchanged.

## Phase 1: Establish One Request-Scoped Supabase Client

### Overview

Make the middleware-owned client the single authenticated Supabase instance for every rendered page and API request, removing the component-level late cookie-write path.

### Changes Required:

#### 1. Server client and request-local contract

**Files**: `src/lib/supabase.ts`, `src/middleware.ts`, `src/env.d.ts`

**Intent**: Preserve the existing server-only, cookie-backed client factory while making middleware its single owner per request. Expose the nullable client and existing nullable user through the application-local contract.

**Contract**: `App.Locals` gains `supabase: SupabaseClient | null`. Middleware initializes that field before user lookup and leaves the existing configured/unconfigured and protected-route behavior intact.

#### 2. Server-rendered page and component consumers

**Files**: `src/pages/dashboard.astro`, `src/pages/reports.astro`, `src/components/expenses/ExpenseWorkspace.astro`

**Intent**: Eliminate independent page and component client creation. Dashboard and reports read the middleware client from locals; dashboard passes it explicitly to both `ExpenseWorkspace` render paths.

**Contract**: `ExpenseWorkspace` accepts the nullable shared `SupabaseClient` as a server-only prop and uses it for `loadExpenseWorkspaceState`; it no longer imports or invokes `createClient`. Existing null-safe data loading, onboarding, and render branches remain unchanged.

#### 3. API route consumers

**Files**: `src/pages/api/auth/signin.ts`, `src/pages/api/auth/signout.ts`, `src/pages/api/auth/signup.ts`, `src/pages/api/expenses/approve.ts`, `src/pages/api/expenses/create.ts`, `src/pages/api/expenses/decline.ts`, `src/pages/api/expenses/delete.ts`, `src/pages/api/expenses/edit.ts`, `src/pages/api/family/children.ts`, `src/pages/api/family/create.ts`, `src/pages/api/family/join/confirm.ts`, `src/pages/api/family/join/preview.ts`, `src/pages/api/family/regenerate-code.ts`, `src/pages/api/settlements/confirm.ts`

**Intent**: Reuse the client middleware already initialized for the endpoint instead of creating a second SSR client. This completes the one-client-per-request invariant without changing authorization checks or response behavior.

**Contract**: Each handler reads `context.locals.supabase`, removes its `createClient` import/call, and retains its existing null guard and success/error/redirect or JSON response contracts. Auth endpoints continue to use the shared client for their session-changing auth operation.

### Success Criteria:

#### Automated Verification:

- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.
- A code search confirms `createClient(` is invoked only from middleware, with no invocation from an imported `.astro` component, page frontmatter, or API handler.

#### Manual Verification:

- A signed-in user can load `/dashboard` in both family states, view `/reports`, and refresh the expense workspace without a UI regression.
- Sign-in, sign-up, sign-out, and one authenticated financial or family API action preserve their current redirect/JSON behavior.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Verify Token-Refresh Persistence

### Overview

Exercise the actual session-refresh condition responsible for the warning and confirm that response cookies can be updated before page output is streamed.

### Changes Required:

#### 1. Runtime verification and regression evidence

**Files**: No production file changes expected; use the local development logs and browser network/storage inspection.

**Intent**: Validate the behavior unavailable to the current unit-test setup: a session refresh from a rendered page persists successfully and does not log Astro’s late-cookie warning.

**Contract**: Use a valid signed-in session whose access token is expired or close enough to trigger refresh; inspect the dashboard and reports responses for updated Supabase auth cookies and confirm the refreshed session remains authenticated on a subsequent request.

### Success Criteria:

#### Automated Verification:

- Repeat `npm run lint` and `npm run build` after any final corrections.

#### Manual Verification:

- With an expired or refreshable local Supabase session, request `/dashboard`; confirm the response sets refreshed `sb-*` auth cookies and the Astro warning is absent from development logs.
- Reload `/dashboard` and request `/reports`; confirm the user remains authenticated and no subsequent refresh warning occurs.
- Confirm an unauthenticated request to `/dashboard` still redirects to `/auth/signin`.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before declaring the change complete.

## Testing Strategy

### Unit Tests:

- Retain the existing domain-library suite; no unit test currently has an Astro middleware/streaming harness.
- Use TypeScript compilation through the production build to ensure every changed page/component/API consumer conforms to the new `App.Locals` and component-prop contracts.

### Integration Tests:

- No database or RLS integration test is required because the change preserves the existing client credentials and query contracts.
- Use manual browser/network verification for cookie refresh because it is the only test surface that exercises Astro’s response-header timing.

### Manual Testing Steps:

1. Start local development with valid Supabase configuration and sign in.
2. Make the local access token expired/refreshable, then load `/dashboard` and inspect response cookies and server logs.
3. Reload dashboard, open reports, and perform an authenticated API action to confirm the shared client preserves session and authorization behavior.
4. Sign out and verify protected routes still redirect to sign-in.

## Performance Considerations

The refactor removes duplicate Supabase client initialization and duplicate session reads within a rendered request. It does not add network calls beyond the existing middleware user lookup.

## Migration Notes

No data migration or deployment ordering is required. The change is source-only and can be reverted as a single application deployment if an unexpected request-local typing or auth regression is found.

## References

- Frame brief: `context/changes/supabase-cookie-refresh/frame.md`
- Client cookie bridge: `src/lib/supabase.ts:5-23`
- Middleware authentication boundary: `src/middleware.ts:6-24`
- Direct late-render client: `src/components/expenses/ExpenseWorkspace.astro:16-18`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Establish One Request-Scoped Supabase Client

#### Automated

- [x] 1.1 `npm test` passes.
- [x] 1.2 `npm run lint` passes.
- [x] 1.3 `npm run build` passes.
- [x] 1.4 `createClient(` is invoked only from middleware.

#### Manual

- [x] 1.5 Signed-in dashboard, reports, and expense workspace behavior remains intact.
- [x] 1.6 Auth and authenticated API operations preserve their current response behavior.

### Phase 2: Verify Token-Refresh Persistence

#### Automated

- [ ] 2.1 `npm run lint` and `npm run build` pass after final corrections.

#### Manual

- [ ] 2.2 A refreshable session updates auth cookies on dashboard without the Astro warning.
- [ ] 2.3 Refreshed dashboard and reports requests remain authenticated without another warning.
- [ ] 2.4 An unauthenticated protected-route request still redirects to sign-in.
