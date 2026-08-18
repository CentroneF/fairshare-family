# Authenticated homepage redirect — Plan Brief

> Full plan: `context/changes/homepage-jump-if-logged-in/plan.md`

## What & Why

Signed-in users should enter FairShare through their dashboard rather than seeing the public marketing homepage or authentication screens. This makes the authenticated experience deterministic while preserving the public entry point after logout.

## Starting Point

Middleware already resolves the Supabase user on every request, but only guards protected application routes. The public homepage and `/auth/**` pages render regardless of session state.

## Desired End State

Authenticated visits to `/` and `/auth/**` redirect, without caching, to `/dashboard`. Anonymous visitors retain the current homepage and authentication flow; signing out restores access to the public homepage.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Authenticated destination | `/dashboard` | It matches the existing successful sign-in destination. |
| Auth page policy | Redirect signed-in users from all `/auth/**` pages | It fulfils the requirement that authenticated users never see entry/auth screens. |
| Automated proof | Authenticated Playwright coverage | It exercises middleware, cookies, and redirect behavior together. |
| Logout proof | Manual verification | It avoids mutating the shared authenticated browser state while retaining human acceptance. |

## Scope

**In scope:**

- Middleware redirect policy for authenticated `/` and `/auth/**` requests.
- Authenticated browser coverage for the redirect behavior.
- Manual signed-out regression check.

**Out of scope:**

- Changes to Supabase, login, signup, logout, onboarding, or dashboard behavior.
- Anonymous-route redirects, return URLs, and client-side redirect logic.

## Architecture / Approach

The request middleware remains the sole policy layer: it resolves the user, then returns the existing no-store redirect helper before route rendering for guest-only entry paths. Playwright uses the current authenticated storage state to observe the response outcome in a real browser.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Authenticated entry-route guard | Server redirect policy and browser regression coverage | Accidentally broad route matching or cached redirects after logout |

**Prerequisites:** Valid local Supabase configuration and existing authenticated Playwright storage state.
**Estimated effort:** One short implementation session.

## Open Risks & Assumptions

- The configured Playwright authenticated state remains valid for the focused route test.
- A signed-in account without a family is still correctly handled by the existing dashboard onboarding state.

## Success Criteria (Summary)

- Signed-in users cannot render `/` or `/auth/**`; they land on `/dashboard`.
- Signing out restores the anonymous homepage and auth routes.
- Browser redirect coverage and the existing verification gate pass.
