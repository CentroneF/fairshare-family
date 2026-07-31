# Expense Date Picker Boundaries Implementation Plan

## Overview

Provide a fixed-month, accessible expense-date calendar for both creation and editing. A date must remain inside the displayed report month; the client prevents cross-month choices and the HTTP APIs retain the final validation guard.

## Current State Analysis

Phase 1 replaced the create form's native date control with `ExpenseDatePicker.astro`; it limits the view to one report month and adds the hidden `expenseDate` field only after hydration. The create API uses `validateExpenseDateInMonth` to reject missing, malformed, future, and cross-month values.

The edit dialog still uses a native date input with only a future-date maximum. Although it posts the displayed `month`, `src/pages/api/expenses/edit.ts` only calls `normalizeExpenseDate`, then returns the submitted date's month as the success destination. The Supabase RPC also allows cross-month updates; by decision, this change enforces the invariant at the HTTP API only and does not alter the RPC or existing data.

## Desired End State

Desktop expense editing uses the same no-navigation, selected-month calendar as creation. An eligible existing expense date is selected initially; current-month future days are visible but disabled. The edit endpoint rejects an altered date outside the posted report month and continues its existing background-refresh success flow for valid edits.

### Key Discoveries:

- `src/components/expenses/ExpenseDatePicker.astro` already accepts the `month`, `maxDate`, and `defaultDate` contract required by the edit dialog.
- `src/pages/api/expenses/create.ts:20-30` already demonstrates the required server-boundary validation with `validateExpenseDateInMonth`.
- `src/pages/api/expenses/edit.ts:14-28` receives the displayed month but currently permits an edited date to determine a different destination month.
- `supabase/migrations/20260729170000_joint_monthly_settlement.sql:225-246` deliberately permits direct cross-month RPC updates; this remains unchanged by the API-only decision.

## What We're NOT Doing

- Adding month navigation or allowing an edit to move an expense to another report month.
- Changing the `update_expense` database RPC, its migration history, or direct-RPC behavior.
- Rewriting or auditing historical expense dates; existing cross-month records are assumed absent.
- Changing the mobile create page, edit submission transport, or adding a browser/component test framework.

## Implementation Approach

Reuse the app-owned calendar inside the edit dialog with the displayed report month and the original expense date as its default. Change the edit route to normalize the posted report month first, validate the date against it using the existing shared helper, then retain the existing update and JSON response flow. Extend pure validation tests, rerun the project suite, and manually verify both create and edit boundaries.

## Critical Implementation Details

The picker adds `expenseDate` only after hydration, so the edit form becomes JavaScript-dependent for date submission just as the create form is. The API check is essential because a hidden month field and browser UI can be modified. This intentionally does not protect callers that invoke the Supabase RPC directly.

## Phase 1: Selected-Month Calendar Integration

### Overview

Deliver the end-to-end desktop and mobile creation experience with a fixed-month calendar and compatible background form submission.

### Changes Required:

#### 1. Calendar domain helpers

**Files**: `src/lib/expense-date-picker.ts`, `src/lib/expense-date-picker.test.ts`

**Intent**: Centralize selected-month calendar generation and eligibility.

**Contract**: Helpers generate one selected-month grid and identify dates outside that month or after `maxDate` as unavailable.

#### 2. Hydrated date-picker island

**Files**: `src/components/expenses/ExpenseDatePicker.astro`

**Intent**: Replace browser-owned calendar behavior with the selected-month-only interaction.

**Contract**: Render a labelled trigger, fixed-month popover grid, and hydration-only hidden `expenseDate`; selection, reset, Escape, outside click, and focus return remain accessible.

#### 3. Create-form integration

**Files**: `src/components/expenses/CreateExpenseForm.astro`

**Intent**: Mount the shared calendar in both creation contexts while retaining background submission.

**Contract**: No native date fallback is rendered; the selected `month`, `maxDate`, default selection, and form reset remain compatible.

### Success Criteria:

#### Automated Verification:

- Calendar-helper tests cover selected-month grids, eligibility, and reset/default behavior.
- `npm test`, `npm run lint`, and `npm run build` pass.

#### Manual Verification:

- Historical desktop and mobile create calendars show only the selected month and permit every day.
- Keyboard users can open, select, close, and retain trigger focus.
- Desktop refresh/dialog reset and mobile return navigation work after creation.

---

## Phase 2: Fixed-Month Edit Enforcement and Regression Verification

### Overview

Apply the selected-report-month rule to editing and verify the create and edit server boundaries after the shared picker is in use.

### Changes Required:

#### 1. Shared picker in the edit dialog

**Files**: `src/components/expenses/EditExpenseDialog.astro`

**Intent**: Replace the native edit date input with the existing fixed-month picker so users cannot browse or select another report month.

**Contract**: Supply the dialog's displayed `month`, existing `maxDate`, and expense date as `defaultDate` to `ExpenseDatePicker`. The picker remains the sole `expenseDate` control; description, child, amount, cancellation, and background submit behavior are unchanged.

#### 2. Edit API report-month guard

**Files**: `src/pages/api/expenses/edit.ts`

**Intent**: Make the server-side edit boundary agree with the picker and reject tampered cross-month submissions before `updateExpense` runs.

**Contract**: Validate the normalized `expenseDate` with `validateExpenseDateInMonth(expenseDate, month)`. Valid responses continue to return the edited date's month, which is necessarily the displayed month.

#### 3. Boundary regression coverage

**Files**: `src/lib/expense-balance.test.ts`

**Intent**: Prove the common validation contract accepts the first and last eligible dates and rejects missing, malformed, invalid-calendar, future, and cross-month values used by both HTTP routes.

**Contract**: Keep existing creation-boundary coverage and add explicit edit-path assertions where needed; do not introduce an API test harness solely for this change.

#### 4. Creation-flow regression checks

**Files**: `src/components/expenses/CreateExpenseForm.astro`, `src/components/expenses/ExpenseWorkspace.astro`, `src/pages/expenses/new.astro` only if a regression is found

**Intent**: Confirm expanding the shared date rule does not alter existing create handoff or background completion behavior.

**Contract**: The create date remains hydration-only and its existing missing-date API failure remains safe. No source changes are expected unless verification identifies a regression.

### Success Criteria:

#### Automated Verification:

- Unit tests retain creation validation coverage and cover the common edit date boundary contract.
- `npm test`, `npm run lint`, and `npm run build` pass after the edit changes.

#### Manual Verification:

- Edit dialogs show only the displayed report month, provide no month navigation, and preserve the existing expense date as the selected value.
- Current-month edit calendars visibly disable future dates; all dates through today are selectable.
- A manually altered edit date outside the displayed month receives the safe validation response and does not update the expense.
- Edit dialogs close from both Cancel and a backdrop click, including after an in-place workspace refresh.
- Create calendars and existing desktop/mobile background success paths continue to work.

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before committing the phase.

## Testing Strategy

### Unit Tests:

- Retain selected-month grid, leap-year, and current-month disabled-date tests.
- Cover first/last eligible dates plus empty, malformed, invalid-calendar, future, and cross-month dates through `validateExpenseDateInMonth`.

### Integration Tests:

- No new browser, component, API-harness, or database-test setup is introduced.
- The API is the chosen enforcement boundary; direct database-RPC calls remain outside this plan.

### Manual Testing Steps:

1. Open create and edit dialogs for a historical report; each calendar shows exactly that month and permits every day.
2. Open create and edit dialogs for the current month; future days are visible but cannot be selected.
3. Test calendar keyboard selection, Escape, outside click, focus return, and selected-date display in each flow.
4. Submit a valid create and edit; confirm their existing background success behavior.
5. Tamper with or omit a create date, then tamper with an edit date outside its report month; confirm the API rejects each safely.

## Performance Considerations

Each date picker renders at most one month of buttons; reusing it in the edit dialog adds no dependency or network work.

## Migration Notes

No migration or data backfill is required. Rollback is a component-and-route revert. The database RPC continues to allow direct cross-month updates by explicit scope decision.

## References

- Frame brief: `context/changes/date-picker-fix/frame.md`
- Shared picker: `src/components/expenses/ExpenseDatePicker.astro`; `src/lib/expense-date-picker.ts`
- Edit UI/API: `src/components/expenses/EditExpenseDialog.astro:29-32,65-74`; `src/pages/api/expenses/edit.ts:14-28`
- Create invariant: `src/pages/api/expenses/create.ts:20-30`; `src/lib/expense-balance.ts:87-107`
- Existing RPC behavior: `supabase/migrations/20260729170000_joint_monthly_settlement.sql:225-246`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Selected-Month Calendar Integration

#### Automated

- [x] 1.1 Cover historical-month grids, current-month future-day disabling, selected-date validity, and reset/default helper behavior — 1790241
- [x] 1.2 Run `npm test` — 1790241
- [x] 1.3 Run `npm run lint` — 1790241
- [x] 1.4 Run `npm run build` — 1790241

#### Manual

- [x] 1.5 Verify historical-report desktop and mobile calendars show only the selected month, permit every day, and expose no month navigation — 1790241
- [x] 1.7 Verify keyboard navigation, Escape closing, and focus return to the date trigger — 1790241
- [x] 1.8 Verify desktop refresh/dialog close/reset and mobile return navigation after a successful create — 1790241

### Phase 2: Fixed-Month Edit Enforcement and Regression Verification

#### Automated

- [x] 2.1 Cover first/last eligible, cross-month, empty, malformed, invalid-calendar-date, and future-date server validation boundaries — 0a1aa79
- [x] 2.2 Replace the native edit date input with the shared fixed-month picker — 0a1aa79
- [x] 2.3 Enforce the displayed report month in the edit API — 0a1aa79
- [x] 2.4 Extend regression coverage for the common create/edit date boundary contract — 0a1aa79
- [x] 2.5 Run `npm test` after the edit boundary changes — 0a1aa79
- [x] 2.6 Run `npm run lint` after the edit boundary changes — 0a1aa79
- [x] 2.7 Run `npm run build` after the edit boundary changes — 0a1aa79
- [x] 2.8 Make the edit dialog close from Cancel and backdrop clicks — 0a1aa79
- [x] 2.9 Run `npm test` after the dialog-close repair — 0a1aa79
- [x] 2.10 Run `npm run lint` after the dialog-close repair — 0a1aa79
- [x] 2.11 Run `npm run build` after the dialog-close repair — 0a1aa79

#### Manual

- [x] 2.12 Verify create dates that are missing or outside the displayed month receive the safe validation response — 0a1aa79
- [x] 2.13 Verify edit calendars allow no cross-month date or month navigation and preserve the existing date — 0a1aa79
- [x] 2.14 Verify altered edit dates outside the displayed month are rejected without updating the expense — 0a1aa79
- [x] 2.15 Verify current-month create and edit calendars disable future dates while allowing all dates through today — 0a1aa79
- [x] 2.16 Verify desktop and mobile creation and desktop edit retain their background-success behavior, including Cancel and backdrop closing — 0a1aa79
