# Expense and settlement state protections — Plan Brief

> Full plan: `context/changes/testing-expense-settlement-state-protections/plan.md`
> Research: `context/changes/testing-expense-settlement-state-protections/research.md`

## What & Why

This change strengthens regression proof for financial expense states and settlement locks. It targets the remaining high-signal gaps: exact status-specific financial behavior and proof that rejected locked-state commands leave no data changed.

## Starting Point

The existing database RPCs already lock the family and reject writes after a first confirmation or final settlement. Vitest and pgTAP cover the major lifecycle, but several error assertions do not yet verify post-error persistence, and the three expense states lack one focused totals-plus-eligibility matrix.

## Desired End State

Contributors can rely on tests that prove a locked financial report is unchanged after a rejected action, not merely that it returned an error. The quality contract documents where to add pure financial and database-state regressions and how to run them.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Database scope | Targeted invariants | It closes meaningful no-side-effect gaps without a brittle exhaustive matrix. | Plan |
| Production scope | No application changes | The database RPC boundary already provides the protection under test. | Research |
| Concurrency | Defer two-session harness | The current pgTAP setup is sequential; lock-order changes can justify a later dedicated test. | Research |
| Documentation | Update §6.1 now | Each test-rollout phase must leave a reusable cookbook pattern. | Plan |

## Scope

**In scope:**

- Exact approved, pending, and declined total/eligibility unit cases.
- pgTAP no-side-effect assertions for selected locked-state rejections.
- First-confirmed source and destination edit-lock coverage.
- Phase-1 cookbook guidance and relevant verification commands.

**Out of scope:**

- Migrations, RPC, RLS, API, UI, or settlement-read-model changes.
- Browser/e2e tests, two-session concurrency tests, and exhaustive state matrices.

## Architecture / Approach

The pure TypeScript financial rules remain the exact-value oracle, while the database lifecycle suite proves persistence, authorization, and lock behavior. The plan extends existing tests alongside the related lifecycle steps rather than introducing a new harness or duplicating UI behavior.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Exact financial state oracle | Status-specific totals and eligibility cases | Incorrect balance or settlement decision |
| 2. Locked-report immutability | Post-rejection persistence assertions | A locked report silently changes |
| 3. Cookbook and regression handoff | Reusable guidance plus quality-gate verification | Future tests follow inconsistent patterns |

**Prerequisites:** Local dependencies installed; local Supabase running before pgTAP verification.  
**Estimated effort:** One focused implementation session across three small phases.

## Open Risks & Assumptions

- The family-row lock is treated as the current serialization contract; this plan does not prove two-session contention.
- Exact pgTAP plan-count adjustment depends on the final number of assertions added in Phase 2.

## Success Criteria (Summary)

- Financial state tests assert exact Decimal values and correct settlement eligibility for all three statuses.
- Lock rejection tests prove relevant expense and settlement fields are unchanged.
- The cookbook gives contributors a clear location, naming convention, reference test, and commands for future state-protection work.
