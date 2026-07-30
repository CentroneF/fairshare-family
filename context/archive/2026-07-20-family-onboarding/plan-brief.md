# Family Onboarding — Plan Brief

> Full plan: `context/changes/family-onboarding/plan.md`

## What & Why

This change creates the first shared family workspace for FairShare Family. An authenticated parent names and creates one family, adds children, shares a short code, and lets the second parent preview and explicitly confirm joining without an email-invitation workflow.

## Starting Point

The database foundation already provides families, memberships, children, forced RLS, a one-family-per-account constraint, and a two-parent cap. Authentication and a protected dashboard exist, but the dashboard has no product state or family mutations yet.

## Desired End State

Every signed-in user reaches `/dashboard` and sees one state: create/join a family, creator setup while waiting for a co-parent, or the shared two-parent family summary. A valid code first reveals the family name in a confirmation dialog; only confirmation joins the family. The code is visible only while the creator is waiting and is invalidated when regenerated or used.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Family identity | Required, non-unique family name | Gives the shared workspace a clear identity without global naming restrictions. |
| Join mechanism | Reusable short code until the second parent joins | Matches the MVP’s simple-sharing requirement without delivered invitations. |
| Join confirmation | Preview valid code, then confirm `Do you want to join the {name} family?` | Prevents accidental membership creation and identifies the target family only to the code holder. |
| Code format | Opaque, random, case-sensitive eight-character alphanumeric token | Keeps the code non-human-readable while remaining short enough to copy and share. |
| Code renewal | Creator may regenerate before joining | Gives a recovery path and invalidates an accidentally shared code. |
| Onboarding order | Children and invitation may happen in either order | Avoids blocking the creator from reaching value. |
| Dashboard | One server-driven stateful route | Keeps creation, joining, and existing-family states coherent after sign-in. |
| Authorization | Authenticated database RPCs; no direct writes | Preserves the established forced-RLS security boundary. |
| Testing | pgTAP + focused Vitest + real-session manual checks | Covers authorization and pure application behavior while dialog interaction stays manual. |

## Scope

**In scope:** named-family creation, children creation, code sharing/regeneration, previewed and confirmed second-parent joining, state-driven dashboard UI, and authorization verification.

**Out of scope:** email invitations, code expiry, child editing/deletion, expenses, reports, notifications, and browser E2E tooling.

## Architecture / Approach

The database owns family mutations and generates each random code through security-definer RPCs. A non-mutating preview operation resolves a valid code to its family name, while confirmation revalidates the code and creates membership. Astro routes call those operations with the request-scoped authenticated client, and `/dashboard` renders the user’s current membership state with focused React forms and an accessible confirmation dialog.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Secure database contract | Family-name/join-code schema, RPCs, and pgTAP authorization coverage | Concurrent joining or an authorization bypass |
| 2. Server-owned flow | Typed dashboard state and safe preview/confirmation endpoints | Raw database failures or unintended join on preview |
| 3. State-driven dashboard | Responsive create, preview, confirm, setup, and shared-family screens | Inconsistent state or code exposure after join |

**Prerequisites:** financial-rules foundation migration and Supabase access are already in place.
**Estimated effort:** ~2–3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- No join-code expiry is intentionally included; regeneration and the opaque random token mitigate accidental sharing.
- Existing pre-production families, if any, need an active generated code during migration.
- Parent membership is immutable in this slice; leaving or replacing a parent is future scope.

## Success Criteria (Summary)

- Two authenticated co-parents can safely establish one named family and see the same children.
- Invalid, outdated, repeat, and third-parent join attempts fail without exposing family data.
- Database authorization, app tests, linting, and production build all pass.
