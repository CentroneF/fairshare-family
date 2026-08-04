# Family Authorization and Migration Boundaries — Plan Brief

> Full plan: `context/changes/testing-family-authorization-migration-boundaries/plan.md`
> Research: `context/changes/testing-family-authorization-migration-boundaries/research.md`

## What & Why

Add a focused database-integration suite that protects family data isolation as
RLS policies and `SECURITY DEFINER` RPCs evolve. This closes the remaining
gaps in foreign-expense update coverage, full direct-read isolation, and
settlement isolation without duplicating the existing financial lifecycle suite.

## Starting Point

The application uses request-scoped user sessions, but the database owns
authorization: forced RLS filters direct reads and RPCs derive family identity
from `auth.uid()`. Existing pgTAP tests already prove parts of the contract but
are split across foundation and lifecycle suites.

## Desired End State

A dedicated pgTAP suite runs against the complete migration chain and proves
that a parent sees and changes only their own family’s resources. Rejected or
isolated operations also prove the other family’s persisted data is unchanged,
and §6.2 documents this as the standard regression pattern.

## Key Decisions Made

| Decision | Choice | Why | Source |
|---|---|---|---|
| Test location | New `family_authorization_boundaries.test.sql` suite | Keeps the cross-cutting ownership contract readable and independently diagnosable. | Plan |
| RLS scope | All five core family-owned tables | A shared predicate/migration can expose more than expenses and settlements. | Plan |
| Denial oracle | Expected error plus persisted-state assertion | Errors alone do not rule out partial writes. | Plan |
| Settlement negative case | Caller-scoped isolation, not a foreign-ID error | Confirmation has no family argument and derives scope from the authenticated caller. | Research |
| Test layer | pgTAP via Supabase CLI | It exercises actual JWT claims, RLS, grants, and final migrations at the lowest useful cost. | Research |

## Scope

**In scope:** standalone two-family pgTAP fixtures; RLS visibility and direct-DML
checks; foreign update and settlement-isolation regressions; §6.2 cookbook
guidance.

**Out of scope:** production migrations/RPC changes, API or UI tests, e2e/AI
testing, and migration-upgrade fixtures without a real data transformation.

## Architecture / Approach

Privileged setup creates two deterministic family fixtures. Tests then switch
to authenticated JWT subjects and execute the same RLS and RPC boundaries as
production callers, asserting visible data, exact denied behavior where a
contract exists, and independent persisted-state postconditions.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|---|---|---|
| 1. Focused authorization suite | Real RLS/RPC regression proof | Cross-family data exposure or mutation |
| 2. Cookbook capture | Reusable test convention | Future tests using weak mocks or wrong seam |

**Prerequisites:** local Supabase stack; installed project dependencies.  
**Estimated effort:** ~1 focused implementation session across 2 phases.

## Open Risks & Assumptions

- pgTAP exact assertion count must be set only after the final test matrix is
  written.
- A future data-transforming migration may need a dedicated upgrade-fixture
  change; it is not justified by the current migration chain.

## Success Criteria (Summary)

- `npx supabase test db` proves complete family isolation and passes.
- Foreign expense updates and same-month settlement actions cannot affect the
  victim family’s persisted state.
- §6.2 tells a new contributor where and how to add a family-boundary test.
