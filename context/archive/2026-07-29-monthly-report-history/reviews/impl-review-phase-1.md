<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Monthly Report History

- **Plan**: context/changes/monthly-report-history/plan.md
- **Scope**: Phase 1 of 3
- **Date**: 2026-07-29
- **Verdict**: APPROVED
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Exact-total test does not exercise multiple approved amounts

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/expense-balance.test.ts:90
- **Detail**: The history fixture has one approved amount (`10.25`), so it proves status filtering and formatting but not Decimal-safe addition of multiple approved fractional amounts. The production helper correctly uses `Decimal` and `parsePlnAmount`; this is a coverage gap rather than a demonstrated calculation defect.
- **Fix**: Add a second approved fractional expense to the same historical month and assert their exact two-decimal sum.
- **Decision**: FIXED — Added a second approved fractional amount (`0.10`) and asserted the exact `10.35` monthly approved total; `npm test` and `npm run lint` pass.

### F2 — Phase 1 is not frontend-verifiable on its own

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: context/changes/monthly-report-history/plan.md:60-62
- **Detail**: Phase 1 delivers only the server read model, so its manual check requires code/test inspection rather than a frontend interaction. This conflicts with the newly recorded planning rule that phases should be vertical and manually verifiable from the frontend. The phase was manually accepted, but future plan revisions should avoid this split.
- **Fix**: For future changes, include the smallest visible vertical slice in the first phase; for this plan, Phase 2 is the first frontend-verifiable milestone.
- **Decision**: Accepted — no action for this change. Apply the recorded vertical-phase lesson to future plans.

## Verification

- `npm test` — PASS (19 tests)
- `npm run lint` — PASS
- Manual progress row 1.3 is marked complete; it was a read-model inspection rather than a frontend check.

## Notes

The Phase 1 implementation matches the planned request-scoped family queries, prior-month filtering, descending ordering, `settled` versus open/missing semantics, and exact approved-only totals. The lesson entry committed with the phase was user-directed and is not scope drift.
