# Financial Rules Verification — Plan Brief

> Full plan: `context/changes/financial-rules-verification/plan.md`

## What & Why

This change creates the trusted data and calculation foundation for FairShare Family before any balance UI depends on it. It makes PLN amount handling, the fixed 50/50 split, approval ownership, settlement eligibility, and family-only access testable contracts rather than assumptions embedded in a future screen.

## Starting Point

The app has working Astro authentication and a protected dashboard, but no application migrations, data tables, financial domain code, or test runner. The current server Supabase helper creates a request-scoped SSR client in `src/lib/supabase.ts`.

## Desired End State

The application has a migration-backed, RLS-protected foundation for one family with up to two active co-parents, children, expenses, and month settlement state. Server-side TypeScript calculates exact PLN balances from approved expenses; database integration tests and unit tests demonstrate that unauthorized access and invalid financial states are rejected.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| MVP currency | PLN only | A single currency makes monetary constraints and report calculations unambiguous. | Plan |
| Amount representation | PostgreSQL fixed-scale decimal; Decimal.js in TypeScript | Avoids binary floating-point errors at both persistence and calculation layers. | Plan |
| Financial scope | Contract, authorization, and automated verification; no finance UI | Establishes the trust boundary before the approved-expense slice. | Plan |
| Authorization | Supabase RLS plus server-side checks | Database blocks cross-family reads while the server enforces business transitions. | Plan |
| Family foundation | This change creates the minimal schema; S-01 owns onboarding UI | Prevents financial data from being built on temporary, unauthorised relationships. | Plan |
| Balance source | Derive on demand from expenses | Keeps the MVP correct without cached aggregates or reconciliation jobs. | Plan |

## Scope

**In scope:**

- Family, membership, child, expense, and monthly settlement schema foundation.
- RLS and database constraints for active two-parent families and expense review ownership.
- Exact server-side balance and settlement-eligibility rules.
- Unit and local Supabase integration tests.
- Documentation updates that remove the resolved currency blocker and sequence S-01 after this foundation.

**Out of scope:**

- Family creation/join screens, join codes, children UI, expense forms, reports UI, or settlement UI.
- Recurring expenses, notifications, comments, money transfers, and revision-event history.
- Cached monthly aggregates and production database deployment.

## Architecture / Approach

Migrations provide the data model and RLS boundary. A server-only TypeScript domain module performs exact Decimal arithmetic and evaluates the state supplied by a narrow repository layer; later slices will expose those capabilities through UI routes. Unit tests exercise pure rules, while pgTAP tests authenticate as multiple users to prove constraints and policies at the database boundary.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Database foundation | Schema, constraints, RLS, and migration reset path | Authorization must not create a bypass for cross-family data. |
| 2. Financial domain | Exact PLN calculations and settlement eligibility | JavaScript number coercion would corrupt monetary results. |
| 3. Server integration | Server-only repository and validated operations contract | Service-role usage could bypass intended policy checks. |
| 4. Verification and handoff | Unit/pgTAP coverage, scripts, and updated roadmap/PRD | Local database tests must be repeatable for CI adoption. |

**Prerequisites:** Docker/Supabase local stack available; existing Supabase environment variables remain configured for the app build.
**Estimated effort:** ~3–4 focused sessions across four phases.

## Open Risks & Assumptions

- The local Supabase stack previously had an analytics-container health issue; database verification depends on the adjusted local configuration continuing to start successfully.
- The initial migration defines persistence and authorization, not the S-01 join-code workflow; migration ownership must remain clear when onboarding begins.
- This plan intentionally adds local tests first. Hosted migration deployment needs a separate reviewed release step.

## Success Criteria (Summary)

- A family member can only read their own family’s foundation data, and an unauthorised user cannot mutate it.
- Exact two-decimal PLN inputs and fixed-split balances calculate deterministically, with `.50` final rounding upward.
- `npm test`, `supabase test db`, lint, and build all pass after the change.
