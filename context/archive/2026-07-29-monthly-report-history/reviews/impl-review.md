<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Monthly Report History

- **Plan**: context/changes/monthly-report-history/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-07-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — History RPC accepts a future cutoff

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260729140000_monthly_report_history_read_model.sql:19-20
- **Detail**: The SECURITY DEFINER function validates only a month boundary. A direct authenticated caller can pass a future month and receive the current report, contrary to the prior-month history contract.
- **Fix**: Reject a cutoff later than the current calendar month and add a pgTAP denial test.
- **Decision**: FIXED — Added forward-only cutoff guard migrations and pgTAP future-cutoff coverage; local database tests pass (95 tests).

### F2 — Direct settlement-write denial lacks behavioral pgTAP coverage

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/tests/approved_expense_balance.test.sql
- **Detail**: The plan requires a direct authenticated settlement-mutation denial assertion. Current tests verify policy metadata and history reads but do not attempt a direct settlement write.
- **Fix**: Add authenticated `throws_ok` coverage for direct settlement mutation.
- **Decision**: FIXED — Added authenticated direct `monthly_settlements` UPDATE denial coverage; database tests pass (96 tests).

### F3 — Plan no longer documents the approved database read-model change

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/monthly-report-history/plan.md:45-46
- **Detail**: Phase 2 review approved a grouped database RPC, but the plan still says no migration and two TypeScript reads. The deployed architecture is sound; the plan is stale.
- **Fix**: Amend the plan’s approach, performance, and migration notes to document the read-only RPC.
- **Decision**: SKIPPED — leave the original plan text unchanged.

### F4 — Monthly aggregation may not use the date index efficiently

- **Severity**: OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260729140000_monthly_report_history_read_model.sql:35-57
- **Detail**: The month-truncating join may scan all family expenses for long histories. The MVP is bounded by expected volume, but the current index does not directly cover that expression.
- **Fix**: Consider a grouped-expense CTE or range join when volume warrants it.
- **Decision**: ACCEPTED — current expected MVP history volume does not justify further query optimization.

## Verification

- `npx supabase test db` — PASS (94 tests)
- `npm test` — PASS (20 tests)
- `npm run lint` — PASS
- `npm run build` — PASS
- All manual Progress rows are marked complete and were confirmed.
