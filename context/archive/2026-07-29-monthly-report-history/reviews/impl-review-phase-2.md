<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Monthly Report History

- **Plan**: context/changes/monthly-report-history/plan.md
- **Scope**: Phase 2 of 3
- **Date**: 2026-07-29
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — History source read can silently omit older expense rows

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/expense-balance.ts:301-312
- **Detail**: `loadMonthlyReportHistory` loads every prior expense row in one PostgREST query with no pagination or server-side grouping. Once a response reaches the service row cap, the history can omit months or understate approved totals without an error. Phase 2 now invokes this query on every dashboard load, making the Phase 1 risk user-visible. This conflicts with the plan's financial-accuracy and bounded-read goals.
- **Fix A ⭐ Recommended**: Use a family-scoped database read model that groups history by month, or an authenticated RPC/view that returns month/status/approved total directly.
  - Strength: Prevents response-cap truncation and moves grouping close to indexed source data.
  - Tradeoff: Adds a migration and a read-only database contract.
  - Confidence: HIGH — the existing RLS and `(family_id, expense_date, status)` index support this boundary.
  - Blind spot: The actual production expense volume is not yet known.
- **Fix B**: Fetch a deterministic ordered page sequence until exhaustion, then retain TypeScript Decimal aggregation.
  - Strength: Preserves the current schema and exact TypeScript calculation path.
  - Tradeoff: More request round trips and pagination logic.
  - Confidence: MEDIUM — correct but more application complexity.
  - Blind spot: Must verify Supabase page limits and ordering semantics in the deployed environment.
- **Decision**: FIXED — Added `list_monthly_report_history`, a read-only family-authorized grouped database function, updated the server loader to call it, and added pgTAP exact-aggregation/status coverage. Forward migration applied locally; database tests (93), unit tests, lint, and build pass.

### F2 — Visible history has no rendered-UI regression test

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/monthly-report-history/plan.md:92-98
- **Detail**: Phase 2 required dashboard-history and selected-month regression coverage, but `60015f9` changes no test file. Existing unit tests cover the derivation only; they do not protect the disclosure, empty state, month link, selected state, or workspace wiring.
- **Fix**: Add focused Astro-rendered markup coverage if supported by the existing test setup; otherwise add a narrow server-render regression test for history component inputs and `/dashboard?month=` links.
- **Decision**: Accepted — current unit, build, and confirmed manual coverage are sufficient for this MVP.

## Verification

- `npm test` — PASS (19 tests)
- `npm run lint` — PASS
- `npm run build` — PASS
- Manual progress row 2.3 is marked complete and was confirmed by the human.

## Notes

The visible implementation matches the Phase 2 UI contract: server-derived history is outside the background-refresh replacement fragments; it is a collapsed native disclosure; rows use normal dashboard month links; badges, exact approved totals, selected state, responsive layout, and empty state are present. The only unplanned addition is none.
