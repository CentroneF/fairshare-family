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

- The requested scope is creation only: the selected report month determines the valid date range.
- The user requires all eligible days in that month, not a single default date.
- Investigation found strong evidence for the client-boundary and native-control hypotheses and none for lost month state or missing server validation, so no additional hypothesis question was needed.

## Cross-System Convention

The existing convention is defense in depth: the form carries the displayed month, and the API rejects a mismatched month. This was intentionally introduced in the dashboard refactor (`context/changes/dashboard-ui-refactoring/plan.md:94-98`) and is implemented in the create API. The UI needs to match that invariant; a native control cannot reliably guarantee its calendar navigation UI across browsers.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: The create-expense UI does not faithfully express the existing selected-month business rule, and the native date control cannot guarantee the requested no-cross-month-navigation interaction.

For historical months, the form's upper date bound is today rather than the end of the selected month, so users can select invalid dates and only discover the violation on submission. The server-side invariant is already correct. The plan must additionally treat “cannot navigate to other months” as a UI-control requirement, not something guaranteed merely by native date input bounds.

## Confidence

- **HIGH** — source inspection and an independent cross-system check agree that month state and server validation are intact, while the client range is too broad and the only UI is browser-native.

## What Changes for /10x-plan

Plan the creation-form experience around the existing selected-month invariant across both desktop and mobile mounts. Preserve the no-future-date rule for the current month, correct the historical-month date range, and explicitly decide how the requested navigation guarantee will be met given native picker behavior. Do not broaden this change to the edit-expense flow, whose API intentionally permits a month move.

## References

- Source files: `src/components/expenses/CreateExpenseForm.astro:27,45,76-86`; `src/pages/expenses/new.astro:14-29,42-47`; `src/components/expenses/ExpenseWorkspace.astro:31-33,49-56`; `src/pages/api/expenses/create.ts:20-30`; `src/lib/expense-balance.ts:87-108`
- Tests: `src/lib/expense-balance.test.ts:38-44`
- Related history: `context/changes/dashboard-ui-refactoring/plan.md:94-98`; `context/changes/dashboard-ui-refactoring/reviews/impl-review.md:35-43`
- Investigation tasks: trace_date_constraints, trace_server_date, independent_date_check
