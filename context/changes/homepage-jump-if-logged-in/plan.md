# Authenticated homepage redirect implementation plan

## Overview

Ensure signed-in users never see the public homepage or authentication screens. Server middleware will redirect authenticated requests for `/` and `/auth/**` to `/dashboard`, while anonymous visitors retain the existing public and authentication experiences.

## Current State Analysis

`src/middleware.ts` creates the request-scoped Supabase client, resolves `context.locals.user`, and currently protects only dashboard, reports, and expense routes. The root route always renders the landing page, and sign-in, sign-up, and email-confirmation routes remain reachable to an authenticated session.

Logout already clears the Supabase session and redirects to `/`; with the proposed user-aware guard, the subsequent request will render the public homepage. Browser-level authenticated route coverage uses Playwright's configured storage state.

## Desired End State

An authenticated visit to `/`, `/auth/signin`, `/auth/signup`, or `/auth/confirm-email` receives a no-store redirect to `/dashboard`. Anonymous and expired sessions can still see those routes normally. After signing out, the user returns to and can continue to view the public homepage.

### Key Discoveries:

- `src/middleware.ts:12-37` resolves the authenticated user once for every request and is the single route-policy boundary.
- `src/pages/api/auth/signout.ts:3-9` signs out before redirecting to `/`, so no logout route change is needed.
- `tests/e2e/seed.spec.ts:5-15` and `playwright.config.ts:7-22` provide an authenticated Playwright pattern for browser-level redirects.
- `tests/e2e/AGENTS.md:1-11` requires independent tests and accessible locators; browser work follows the `/10x-e2e` workflow.

## What We're NOT Doing

- Changing Supabase authentication, cookie handling, sign-in, sign-up, or sign-out API behavior.
- Redirecting anonymous users away from the homepage or auth pages.
- Adding a `next`/return-url mechanism, new routes, persistent preferences, or client-side redirect code.
- Changing protected-route, onboarding, or dashboard authorization rules.

## Implementation Approach

Keep the policy server-side in middleware. After resolving `context.locals.user`, apply an exact-root or `/auth/`-prefix guest-only route guard for authenticated users and return the existing no-store redirect response to `/dashboard`. Extend the authenticated browser route coverage to prove the visible result rather than introducing a new middleware test harness.

## Critical Implementation Details

The root match must be exact: do not use a broad slash prefix that could affect all pages or assets. The redirect response must use the existing `preventBrowserCaching` helper, so a previous authenticated entry response cannot be reused after logout.

## Phase 1: Authenticated entry-route guard

### Overview

Deliver the complete signed-in entry policy in middleware and prove the user-visible redirects through the existing authenticated browser test setup.

### Changes Required:

#### 1. Central authenticated entry-route policy

**File**: `src/middleware.ts`

**Intent**: Redirect an authenticated user away from the public homepage and every browser-facing `/auth/**` page before Astro renders route content.

**Contract**: After user resolution, exact `/` and paths beginning `/auth/` redirect authenticated users to `/dashboard` through `preventBrowserCaching`. The existing anonymous protected-route redirect and all non-entry route behavior remain unchanged.

#### 2. Authenticated browser redirect coverage

**File**: `tests/e2e/seed.spec.ts` (or a focused sibling under `tests/e2e/`)

**Intent**: Establish a regression test that observes the actual authenticated middleware behavior for entry routes.

**Contract**: Using the configured authenticated storage state, each independent browser test navigates to `/` and representative `/auth/**` routes, waits for `/dashboard`, and asserts existing dashboard landmarks with role-based locators. The test must not use selectors, hard waits, or a shared sign-out mutation.

### Success Criteria:

#### Automated Verification:

- Focused authenticated Playwright coverage passes for `/` and `/auth/**` redirects using the existing storage state.
- `npm run verify` passes.

#### Manual Verification:

- While signed in, opening `/`, `/auth/signin`, `/auth/signup`, and `/auth/confirm-email` always lands on `/dashboard` without rendering an entry page.
- After using the existing sign-out control, `/` renders the public FairShare homepage and `/auth/signin` is reachable again.
- An anonymous browser can still open `/`, sign in, sign up, and confirmation routes.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation of signed-in and signed-out browser behavior before declaring the change complete.

## Testing Strategy

### Unit Tests:

- Do not introduce a middleware unit-test harness for this small routing policy; Astro request/session behavior is covered at the browser boundary.

### Integration Tests:

- Use the existing authenticated Playwright storage state to verify middleware redirects and dashboard visibility.
- Drive any browser-level implementation and verification through `/10x-e2e` in accordance with `tests/e2e/AGENTS.md`.

### Manual Testing Steps:

1. Sign in with a valid account and request `/`; confirm `/dashboard` loads.
2. In the same signed-in browser, request each `/auth/**` page; confirm each redirects to `/dashboard`.
3. Sign out using the existing visible control; confirm `/` presents the public homepage.
4. In the signed-out browser, open `/auth/signin`, `/auth/signup`, and `/auth/confirm-email`; confirm they render normally.

## Performance Considerations

The implementation reuses the existing per-request user lookup and returns before page rendering for guest-only routes. It adds no client-side JavaScript, network call, or data query.

## Migration Notes

No database or deployment migration is required. Rollback is a single middleware-policy revert; authenticated users will again be able to view `/` and `/auth/**`.

## References

- Authentication middleware: `src/middleware.ts:12-37`
- Public root route: `src/pages/index.astro:1-8`
- Logout flow: `src/pages/api/auth/signout.ts:3-9`
- Authenticated browser pattern: `tests/e2e/seed.spec.ts:5-15`
- E2E conventions: `tests/e2e/AGENTS.md:1-11`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Authenticated entry-route guard

#### Automated

- [ ] 1.1 Add the authenticated exact-root and `/auth/**` redirect policy in middleware.
- [ ] 1.2 Add independent authenticated browser coverage for homepage and auth-route redirects.
- [ ] 1.3 Run the focused browser test and `npm run verify`.

#### Manual

- [ ] 1.4 Verify signed-in entry-route redirects and signed-out public/auth access in a browser.
