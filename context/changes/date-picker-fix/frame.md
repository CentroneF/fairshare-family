# Frame Brief: Expense date picker boundaries

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

On the add-expense form, the date picker allows a date from a different month
than the month currently being viewed.

## Initial Framing (preserved)

- **User's stated cause or approach**: The report month is selected before “Add expense” is clicked, so the date picker should stay in that month.
- **User's proposed direction**: Allow every eligible day in the selected month only; users should not be able to navigate to other months in the picker.
- **Pre-dispatch narrowing**: All days in the selected month only; no navigation to another month.
- **Scope correction (2026-07-31)**: The same selected-report-month rule applies to editing: an expense must not be moved between months.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Report-month propagation** — the selected month could be lost before the form is rendered.
2. **Client input bounds** — `min`/`max` could describe a range broader than the selected month.  ← initial framing
3. **Native calendar interaction** — a browser-owned `<input type="date">` may still expose month navigation even with valid-date bounds.
4. **Submission validation** — the server could accept a submitted date outside the displayed month.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Report-month propagation is broken | The mobile route preserves `month` and passes it into the form; the form also posts it as a hidden value. `src/pages/expenses/new.astro:14-29`, `src/components/expenses/CreateExpenseForm.astro:15-28,45` | NONE |
| Client bounds span more than the selected month | The form sets `min` to `${month}-01`, but receives `maxDate` as `today`. For a historical month this permits dates in following months through today. `src/components/expenses/CreateExpenseForm.astro:27,78-86`, `src/pages/expenses/new.astro:24,42-47`, `src/components/expenses/ExpenseWorkspace.astro:31-33,49-56` | STRONG |
| Native picker cannot promise no month navigation | The shared control is a native `input[type=date]`; its picker chrome/navigation is browser-controlled. No app-owned picker or date-picker dependency exists. `src/components/expenses/CreateExpenseForm.astro:76-86`, `package.json` | STRONG |
| Server accepts an out-of-month date | The API validates the posted date against the posted month before creating an expense. `src/pages/api/expenses/create.ts:20-30`, `src/lib/expense-balance.ts:102-107`; tests cover mismatched-month rejection in `src/lib/expense-balance.test.ts:38-44`. | NONE |

## Narrowing Signals

- The selected report month determines the valid date range for both creation and editing.
- The user requires all eligible days in that month, not a single default date.
- Investigation found strong evidence for the client-boundary and native-control hypotheses and none for lost month state or missing server validation, so no additional hypothesis question was needed.

## Cross-System Convention

The existing creation convention is defense in depth: the form carries the displayed month and the API rejects a mismatched month. This was intentionally introduced in the dashboard refactor (`context/changes/dashboard-ui-refactoring/plan.md:94-98`) and is implemented in the create API. The edit path currently diverges: its native control only caps future dates, and its API derives a new destination month from the submitted date. The selected-month invariant must now apply consistently to both paths.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: Create and edit expense flows must both enforce the displayed report month in their UI and server validation; an expense must not be moved between months.

For historical months, the create form's upper date bound was today rather than the end of the selected month, so users could select invalid dates and only discover the violation on submission. The edit control likewise allows dates outside the displayed month, and the edit API accepts them before navigating to that destination month. The plan must apply the fixed-month picker and server guard to both flows, with regression coverage for direct API tampering.

## Confidence

- **HIGH** — source inspection and an independent cross-system check agree that month state and server validation are intact, while the client range is too broad and the only UI is browser-native.

## What Changes for /10x-plan

Revise the active plan before completing Phase 2: include the edit dialog, edit API, database/RPC invariant, and their regression coverage. Preserve the no-future-date rule, retain background form submission, and use the selected report month as the fixed edit boundary.

The edit dialog must also own its Cancel and backdrop-close behavior. Workspace-level delegation is insufficient because the workspace can be replaced after an in-place refresh.

## References

- Source files: `src/components/expenses/CreateExpenseForm.astro:27,45,76-86`; `src/components/expenses/EditExpenseDialog.astro:29-32,65-74`; `src/pages/expenses/new.astro:14-29,42-47`; `src/components/expenses/ExpenseWorkspace.astro:31-33,49-56,103-115,175-180`; `src/pages/api/expenses/create.ts:20-30`; `src/pages/api/expenses/edit.ts:14-28`; `src/lib/expense-balance.ts:87-108,313-329`
- Database contract: `supabase/migrations/20260729170000_joint_monthly_settlement.sql:225-246`; `supabase/tests/approved_expense_balance.test.sql:201-211`
- Tests: `src/lib/expense-balance.test.ts:38-44`
- Related history: `context/changes/dashboard-ui-refactoring/plan.md:94-98`; `context/changes/dashboard-ui-refactoring/reviews/impl-review.md:35-43`
- Investigation tasks: trace_date_constraints, trace_server_date, independent_date_check
