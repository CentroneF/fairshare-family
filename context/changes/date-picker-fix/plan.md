# Expense Date Picker Boundaries Implementation Plan

## Overview

Replace the create-expense form's native date input with an app-owned, accessible popover calendar that renders only the selected report month. It will allow every eligible day in that month, visibly disable future days in the current month, and keep the existing API validation as the final integrity check.

## Current State Analysis

`CreateExpenseForm` is rendered by both the desktop Add Expense dialog and the mobile `/expenses/new` page. It receives the selected `month`, the current `maxDate`, and a default date; it currently renders a native date input with a selected-month minimum but a maximum of today. Historical months therefore expose dates in later months, which the API rejects only after submission.

The API already validates that the submitted ISO date belongs to the posted selected month. The codebase has React support for hydrated interactive forms, but no calendar dependency, component-test environment, or browser E2E suite. The user explicitly chose an app-owned popover calendar and JavaScript-only date selection.

## Desired End State

Both add-expense entry points show a compact date trigger that opens a calendar for the displayed report month only. There are no previous/next month controls. Every past-month day is selectable; for the current month, days after today are displayed but unavailable. Selecting an eligible day updates the form value and closes the popover; the existing background create flow posts that ISO date and retains its server-side validation.

### Key Discoveries:

- `src/components/expenses/CreateExpenseForm.astro:15-28,76-86` owns the shared creation date field and currently maps `month` to only a minimum date.
- `src/components/expenses/ExpenseWorkspace.astro:31-33,49-56` and `src/pages/expenses/new.astro:24-29,42-47` mount that shared form for desktop and mobile with the same `today` upper boundary.
- `src/pages/api/expenses/create.ts:20-30` calls `validateExpenseDateInMonth`, which rejects a selected date outside the posted month in `src/lib/expense-balance.ts:102-107`.
- Existing React islands use `client:load` (`src/pages/auth/signin.astro:16`), while form submission remains in the Astro component (`src/components/expenses/CreateExpenseForm.astro:135-188`).
- The repository has Vitest unit tests but no component/browser test setup (`package.json:5-10`, `src/lib/expense-balance.test.ts:1-44`).

## What We're NOT Doing

- Changing edit-expense date behavior or its API, which intentionally permits an expense date to move months.
- Changing database schema, Supabase migrations, RLS, or create-expense API contracts.
- Adding a third-party calendar package, a component-test stack, or browser E2E tooling.
- Providing a non-JavaScript date-selection fallback; JavaScript is required for the new calendar as requested.

## Implementation Approach

Create a small React date-picker island plus pure date-range helpers. The island will render a labelled trigger, a keyboard-accessible popover grid for the selected month, and a hidden `expenseDate` field only after hydration. `CreateExpenseForm` will supply the existing selected month, maximum eligible ISO date, and default date; it will otherwise retain its form submission and error lifecycle. Pure helpers will make selected-month bounds and disabled current-month days testable without introducing a UI test framework.

## Critical Implementation Details

The date-picker island must own the hidden `expenseDate` input so no-JavaScript submission lacks a date and is rejected by the existing server validation, matching the user's chosen JavaScript-only behavior. The desktop form calls `form.reset()` after a successful in-place refresh; the island must reset its selected state to its supplied default when that containing form emits a reset, so its visible trigger and posted hidden value stay synchronized.

## Phase 1: Selected-Month Calendar Integration

### Overview

Deliver the end-to-end desktop and mobile creation experience with a fixed-month calendar and compatible background form submission.

### Changes Required:

#### 1. Calendar domain helpers

**Files**: new `src/lib/expense-date-picker.ts`, new `src/lib/expense-date-picker.test.ts`

**Intent**: Centralize selected-month calendar generation and eligibility so the interface consistently shows the correct month and disables only future dates in the current month.

**Contract**: Given selected `YYYY-MM`, default `YYYY-MM-DD`, and maximum eligible ISO date, helpers return the month label/grid metadata and identify dates outside the selected month or after `maxDate` as unavailable. They preserve UTC/ISO string semantics used by `expense-balance`.

#### 2. Hydrated date-picker island

**Files**: new `src/components/expenses/ExpenseDatePicker.tsx`

**Intent**: Replace browser-owned calendar behavior with the selected-month-only interaction the user requested, without a new dependency.

**Contract**: Accept `month`, `maxDate`, and `defaultDate`; render a date trigger and popover calendar with no month navigation controls; show all selected-month days, disabling future days when applicable; and submit the selected ISO date in a hidden `expenseDate` field. The trigger and popover expose their expanded/dialog state to assistive technology, selection is keyboard reachable, Escape/outside click close the popover, a successful selection returns focus to the trigger, and form reset restores the supplied default selection.

#### 3. Create-form integration

**Files**: `src/components/expenses/CreateExpenseForm.astro`

**Intent**: Mount the interactive calendar in the shared form so desktop and mobile creation enforce the same visible month boundary while retaining background submission, existing errors, and server validation.

**Contract**: Replace the native `input[type=date]` with the React island hydrated on load. Do not render an equivalent native fallback. The submitted field name remains `expenseDate`; `month`, `maxDate`, `defaultDate`, locking behavior, and the form's current post-success reset path remain compatible.

### Success Criteria:

#### Automated Verification:

- Unit tests cover historical-month grids, current-month future-day disabling, selected-date validity, and reset/default semantics of the date helper contract.
- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.

#### Manual Verification:

- From a historical report, desktop and mobile Add Expense each open a calendar containing only the selected month; every day in that month can be selected and no month navigation is available.
- Keyboard users can open the popover, reach an eligible date, select it, close with Escape, and retain sensible trigger focus.
- A successful desktop create continues to refresh the workspace, close the Add Expense dialog, and reset the selected date; mobile creation continues to navigate back after its background submission.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Boundary and Submission Regression Verification

### Overview

Confirm the client control and existing server guard agree across permitted and invalid creation paths without broadening scope to edit behavior.

### Changes Required:

#### 1. Server-boundary regression coverage

**Files**: `src/lib/expense-balance.test.ts`, `src/pages/api/expenses/create.ts` only if a test-discovered contract gap requires it

**Intent**: Preserve the API as the authoritative protection against malformed, future, or cross-month date submissions after the UI moves date selection into a JavaScript island.

**Contract**: Retain `validateExpenseDateInMonth` coverage and add explicit empty, malformed, and invalid-calendar-date cases alongside selected-month and future-date boundaries, proving the picker rules and JavaScript-only missing-date failure agree with the API. Do not change API behavior or database contracts absent a demonstrated mismatch.

#### 2. Creation-flow regression checks

**Files**: `src/components/expenses/CreateExpenseForm.astro`, `src/components/expenses/ExpenseWorkspace.astro`, `src/pages/expenses/new.astro` only if a regression is found

**Intent**: Verify the shared form works correctly in both rendering contexts and that the JavaScript-only date decision fails safely when hydration is unavailable.

**Contract**: Desktop and mobile retain their current selected-month handoff and background completion behavior. When JavaScript is unavailable, the form does not supply `expenseDate`; the existing API returns its safe date error rather than creating an expense.

### Success Criteria:

#### Automated Verification:

- `npm test` passes with selected-month and future-date server validation coverage retained.
- `npm run lint` passes.
- `npm run build` passes.

#### Manual Verification:

- Submitting a manually altered or missing date cannot create an expense outside the displayed month and receives the existing safe validation response.
- The edit-expense date control remains unchanged and its existing behavior still works.
- The date selector has no selectable cross-month date in current or historical create flows at desktop and mobile widths.
- From the current-month workspace, days after today are visible but disabled, while every day through today can be selected.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before considering the change complete.

## Testing Strategy

### Unit Tests:

- Test pure selected-month grid generation for a month beginning on each relevant weekday and for leap-year February.
- Test current-month eligibility through today and disabled future-day behavior.
- Cover first/last eligible dates, cross-month rejection, empty and malformed input, invalid calendar dates, and future dates in the server validation tests.

### Integration Tests:

- No new component or browser test framework is introduced for this focused change; the existing API contract remains covered through Vitest unit tests.

### Manual Testing Steps:

1. Open Add Expense for a historical report on desktop and mobile; confirm the popover shows exactly that month and permits every day.
2. Open Add Expense for the current month; confirm future dates are visible but cannot be selected.
3. Test popover open/close, Escape, outside click, keyboard selection, selected-date display, and focus return.
4. Submit an expense from each entry point and confirm the existing background-success behavior.
5. Tamper with or omit the submitted date and confirm the API rejects it safely.
6. Verify edit-expense dates continue to use their existing control and behavior.

## Performance Considerations

The calendar renders at most one month of day buttons and has no network work. Hydration is limited to the create form, which is already an interactive surface, and does not alter the existing partial workspace refresh.

## Migration Notes

No migration, backfill, or deployment sequence is required. Rollback is a component-level revert; persisted expenses and API contracts are unchanged.

## References

- Frame brief: `context/changes/date-picker-fix/frame.md`
- Shared creation form: `src/components/expenses/CreateExpenseForm.astro:15-28,76-86,135-188`
- Desktop and mobile mounts: `src/components/expenses/ExpenseWorkspace.astro:31-33,49-56`; `src/pages/expenses/new.astro:24-29,42-47`
- API and invariant: `src/pages/api/expenses/create.ts:20-30`; `src/lib/expense-balance.ts:87-108`
- Existing server tests: `src/lib/expense-balance.test.ts:38-44`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Selected-Month Calendar Integration

#### Automated

- [x] 1.1 Cover historical-month grids, current-month future-day disabling, selected-date validity, and reset/default helper behavior
- [x] 1.2 Run `npm test`
- [x] 1.3 Run `npm run lint`
- [x] 1.4 Run `npm run build`

#### Manual

- [x] 1.5 Verify historical-report desktop and mobile calendars show only the selected month, permit every day, and expose no month navigation
- [x] 1.7 Verify keyboard navigation, Escape closing, and focus return to the date trigger
- [x] 1.8 Verify desktop refresh/dialog close/reset and mobile return navigation after a successful create

### Phase 2: Boundary and Submission Regression Verification

#### Automated

- [ ] 2.1 Cover first/last eligible, cross-month, empty, malformed, invalid-calendar-date, and future-date server validation boundaries
- [ ] 2.2 Run `npm test`
- [ ] 2.3 Run `npm run lint`
- [ ] 2.4 Run `npm run build`

#### Manual

- [ ] 2.5 Verify manually altered or missing dates cannot create an outside-month expense and receive the safe validation response
- [ ] 2.6 Verify edit-expense date behavior remains unchanged
- [ ] 2.7 Verify no cross-month date is selectable in current or historical create flows at desktop and mobile widths
- [ ] 2.8 Verify current-month future dates are visible but disabled and every date through today is selectable
