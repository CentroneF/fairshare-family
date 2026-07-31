<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Expense Date Picker Boundaries Implementation Plan

- **Plan**: `context/changes/date-picker-fix/plan.md`
- **Scope**: Phases 1–2 of 2
- **Date**: 2026-07-31
- **Verdict**: APPROVED
- **Findings**: 1 critical, 3 warnings, 1 observation — all triaged

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Cancel can submit and persist an edit

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Safety & Quality
- **Location**: `src/components/expenses/EditExpenseDialog.astro:72`; `src/components/expenses/ExpenseWorkspace.astro:155-180`
- **Detail**: The Cancel control is `type="submit" formmethod="dialog"`, but the delegated edit submit handler intercepts every edit form, prevents the native dialog behavior, and sends `FormData` to the edit API. A cancelled edit can therefore persist changed data; the database update resets review state to pending.
- **Fix**: Restore Cancel to `type="button"` and close the nearest dialog with a handler that cannot submit the form.
  - Strength: Preserves the existing submit path and prevents the data mutation directly.
  - Tradeoff: Requires a small, explicit close handler.
  - Confidence: HIGH — the prior button used this type and the existing click delegation already recognizes `data-cancel-edit`.
  - Blind spot: None significant.
- **Decision**: FIXED — restored Cancel as a non-submitting button with a direct nearest-dialog close handler that resets unsaved form and date-picker state before closing; backdrop closing does the same.

### F2 — Refreshed edit dialogs do not hydrate their date picker

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: `src/components/expenses/ExpenseDatePicker.astro:81-137`; `src/components/expenses/ExpenseWorkspace.astro:108-115`
- **Detail**: The picker initializes only once by querying the initial document. Workspace refresh replaces the expense list, including edit dialogs, with parsed markup whose scripts do not execute. The new picker has neither its hidden `expenseDate` input nor its event handlers, so a refreshed edit cannot submit a date.
- **Fix A ⭐ Recommended**: Expose an idempotent picker initializer and call it after the workspace replaces the refreshed list.
  - Strength: Preserves the component's current event model and fixes both initial and refreshed instances.
  - Tradeoff: Adds an explicit lifecycle hook between the picker and workspace refresh.
  - Confidence: HIGH — the refresh boundary is explicit and localized.
  - Blind spot: No browser test currently exercises the replacement path.
- **Fix B**: Convert picker interactions to document-level delegation.
  - Strength: Automatically handles future inserted picker markup.
  - Tradeoff: Broader event routing and more target filtering than the existing component design.
  - Confidence: MEDIUM — feasible, but more invasive.
  - Blind spot: Focus and reset behavior need careful retesting.
- **Decision**: FIXED via Fix A — added an idempotent picker initializer and invoke it after workspace replacement.

### F3 — No regression coverage for dialog events or refreshed picker instances

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `src/lib/expense-balance.test.ts:38-61`
- **Detail**: Tests cover the pure shared date validator, but cannot detect Cancel submission or picker behavior after a partial DOM refresh. Manual item 2.16 was marked complete despite both behaviors being broken.
- **Fix**: Add focused browser/component coverage for Cancel and post-refresh edit-date submission, or keep these as mandatory repeatable manual regression checks until such coverage is available.
- **Decision**: ACCEPTED — no automated UI coverage will be added; manual regression checks were repeated successfully after F1 and F2 fixes.

### F4 — Add-expense dialog layout change is not recorded in the plan

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/components/expenses/AddExpenseDialog.astro:30`
- **Detail**: The dialog gained `overflow-visible`, plausibly to allow the upward-opening calendar, but the plan did not name this file or change.
- **Fix**: Document this related layout adjustment in the plan if it is necessary to the create picker.
- **Decision**: FIXED — documented the required visible overflow in the Phase 1 create-form integration contract.

### F5 — Historical edit fallback loses the report route

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `src/pages/api/expenses/edit.ts:31-38`; `src/components/expenses/ExpenseWorkspace.astro:180-185`
- **Detail**: The edit API's fallback redirects always targeted `/dashboard`, and the client rewrote browser history with a dashboard-oriented month query. Saving a historical report edit could therefore leave the report route.
- **Fix**: Derive the fallback destination from the validated report month and leave client history unchanged before refreshing the existing workspace route.
- **Decision**: FIXED — preserved `/reports/<month>` for historical edits and `/dashboard` for the current month.

## Verification After Triage

- `npm test` — 33 tests passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- Manual verification — Cancel discards unsaved edits, refreshed edit pickers submit normally, and historical edits remain on their report.
