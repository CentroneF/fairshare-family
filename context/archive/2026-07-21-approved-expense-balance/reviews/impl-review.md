<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Approved Expense Balance Implementation Plan

- **Plan**: `context/changes/approved-expense-balance/plan.md`
- **Supporting product sources**: `context/foundation/prd.md`, `context/foundation/tech-stack.md`
- **Scope**: Phases 1–3 of 3 (full implementation review; 8/11 progress checks complete)
- **Date**: 2026-07-22
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 3 warnings, 0 observations

## Verification

- `npm test`: PASS — 3 files, 16 tests.
- `npm run lint`: PASS.
- `npm run build`: PASS.
- `npx supabase test db`: PASS — user manually ran the suite after F3's assertion fix.
- Manual checks: marked complete in the plan; user confirmed the end-to-end Phase 3 checks.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Declined entries omit reviewer context

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Plan Adherence
- **Location**: `src/lib/expense-balance.ts:187`, `src/components/expenses/ExpenseList.astro:88`
- **Detail**: Phase 3 requires declined items to show the reason and reviewer context. The list query and `ExpenseDisplay` do not load `reviewed_by` or the reviewer's identity, so the declined section can only render the reason. This also falls short of the auditability intent in the plan and the PRD's expense-review workflow.
- **Fix**: Load the reviewer membership/user display value with the expense row, add it to `ExpenseDisplay`, and render “Declined by …” in the declined section.
- **Decision**: SKIPPED — reviewer context will be addressed in a future change.

### F2 — Background decline leaves the displayed month stale

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it.
- **Dimension**: Plan Adherence
- **Location**: `src/pages/api/expenses/decline.ts:18`, `src/components/expenses/DeclineExpenseDialog.astro:76`
- **Detail**: The JSON decline response returns only an ID and reason. The client replaces the action buttons but does not move the item to the declined section or recompute the monthly totals/balance. Until the user presses Refresh, the expense remains in the active list and the displayed `to_review` total still includes an expense that is already declined. This violates Phase 3's financial-exclusion requirement and the project lesson requiring background form posts without losing correct UI state.
- **Fix**: Return updated selected-month balance data from the decline route and refresh the expense-list fragment after a successful decline (or update both the list placement and balance panel atomically in the client).
  - Strength: Keeps the no-full-page-refresh rule while making the visible state match the committed database decision.
  - Tradeoff: The response/client contract gains a small amount of shared refresh logic.
  - Confidence: HIGH — the approval route already returns balance data and the list already has a background fragment refresh path.
  - Blind spot: None significant.
- **Decision**: FIXED — successful create, approve, decline, and Refresh actions now re-fetch the selected month in the background and replace both the balance and expense-list fragments. The list orders by `created_at` descending.

### F3 — Database authorization coverage has not executed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Success Criteria
- **Location**: `supabase/tests/approved_expense_balance.test.sql:1`
- **Detail**: The direct-write test initially executed a raw `UPDATE`, causing pgTAP to abort on the expected permission error. It now wraps that statement in `throws_ok`, and the user confirmed the complete database suite passes.
- **Fix**: Restore Docker CLI availability, rerun `npx supabase test db`, and record the passing result before closing the change.
- **Decision**: FIXED — wrapped the direct update in `throws_ok` with the expected PostgreSQL permission error; user confirmed the complete local pgTAP suite passes.
