# Dashboard UI Refactoring Implementation Plan

## Overview

Refactor the authenticated dashboard into a current-month workspace with a clear month/year heading, balance, and expense list in that order. Replace the always-visible creation form with responsive entry points: a desktop dialog and a dedicated mobile page, while preserving background submissions, expense validation, settlement locks, and existing edit/review flows. Keep prior-month reports accessible through their own historical workspace route.

## Current State Analysis

The dashboard now derives the current UTC month and passes it to `ExpenseWorkspace` in both family states, intentionally ignoring `?month=`. The workspace presents the month heading, responsive Add Expense entry points, monthly balance, then expense list. Its client refresh function still replaces only balance and list markup after mutations.

`CreateExpenseForm` is coupled to that dashboard refresh function through global IDs and selectors. It cannot be safely mounted in both a desktop dialog and a standalone mobile page without scoping its DOM lookup and making success behavior explicit. Balance data is intentionally absent until a second parent joins, and expense/settlement mutations already rely on API validation and a `month` form field. Report-history cards still target the former dashboard `?month=` URL, which the current-month dashboard now deliberately ignores.

## Desired End State

Authenticated users see the current month and year at the top of the dashboard, followed by that month’s balance and expense list. There is no visible month selector. On screens below `md`, a floating Add Expense control opens a full-page form; at `md` and above, Add Expense sits in the month header and opens an accessible native dialog.

New expenses can only be dated from the first day of the displayed month through today. Desktop submissions update the balance/list in place, close the dialog, and restore focus to Add Expense. Mobile submissions are sent in the background and then navigate to the refreshed workspace. One-parent families see an explanatory unavailable-balance card rather than misleading zero values. Selecting a listed prior-month report, or opening any valid empty past month directly, opens an authenticated historical workspace for that month. It retains the existing availability rules for review, edit, decline, delete, refresh, and settlement, and allows expense creation until either parent confirms the month.

### Key Discoveries:

- `src/pages/dashboard.astro:22-24` derives the UTC current month; `src/components/expenses/ExpenseWorkspace.astro:21-76` owns the workspace layout and refresh contract.
- `src/components/expenses/CreateExpenseForm.astro:103-155` submits in the background and explicitly selects its dashboard or mobile completion behavior.
- `src/lib/expense-balance.ts:471-503` deliberately returns `balance: null` until two active parents exist; the UI needs a distinct unavailable state.
- `src/pages/api/expenses/create.ts:15-37` already validates the submitted month and provides JSON and redirect responses, providing the seam for server-enforced month-date validation.
- Native dialogs and `md` responsive behavior are established by `src/components/DashboardNavigation.astro:12-137` and the existing expense dialogs.

## What We're NOT Doing

- Adding previous/next month controls or preserving hidden `?month=` navigation on the dashboard.
- Changing historical API authorization, the existing confirmation lock, or adding a database migration.
- Changing the expense schema, Supabase migrations, RLS, settlement calculation, or approval/decline/delete rules.
- Redesigning existing edit, decline, delete, or settlement dialogs beyond keeping their current-month refresh behavior compatible.
- Introducing a new browser or component-test framework in this change.

## Implementation Approach

Keep the dashboard’s visible month fixed at the current UTC month, and use `ExpenseWorkspace` for both that dashboard and a validated historical-report route. The workspace receives whether creation is available and where partial refreshes should fetch from, while the existing create form keeps its separate desktop and mobile completion lifecycles. Historical routes accept every strict past `YYYY-MM`, including months without an existing report row, and rely on the existing confirmation lock to stop creation once either parent confirms. Keep the existing create API and progressive redirect fallback, including the server-side invariant that a creation date belongs to the submitted workspace month.

## Critical Implementation Details

The create form must scope all element lookups to its own rendered instance and receive an explicit post-success behavior. Do not render desktop and mobile form instances simultaneously: use a desktop dialog plus a mobile route so each submission handler has one unambiguous target. The desktop success sequence is refresh workspace → close dialog → restore trigger focus; the mobile sequence is successful background response → navigate to the originating workspace. Historical action handlers must refresh `/reports/[month]`, never `/dashboard`, so the partial replacement remains in the selected report.

## Phase 1: Current-Month Dashboard Foundation

### Overview

Establish the new current-month-only dashboard structure and ensure it remains coherent for both fully formed and one-parent families.

### Changes Required:

#### 1. Dashboard month boundary

**Files**: `src/pages/dashboard.astro`, `src/components/expenses/ExpenseWorkspace.astro`

**Intent**: Stop exposing URL-selected dashboard months and consistently pass the current UTC month into both existing `ExpenseWorkspace` call sites. Replace the selector/form-first header with a formatted month/year heading, then render the balance before the expense list.

**Contract**: `ExpenseWorkspace` receives one current `YYYY-MM` month value from the dashboard; it no longer renders a `type="month"` selector or changes visible month from `?month=`.

#### 2. Unavailable balance presentation

**Files**: `src/components/expenses/ExpenseWorkspace.astro`, `src/components/expenses/MonthlyBalancePanel.astro` or a new focused balance-state component

**Intent**: Render an informative balance card in the same position when `loadExpenseWorkspaceState` has no calculated balance because the family does not yet have two active parents.

**Contract**: The unavailable card explains that both parents must join before a balance is available; it does not show numeric zero values or settlement controls. Existing calculated-balance and settlement behavior remains unchanged when a balance exists.

### Success Criteria:

#### Automated Verification:

- `npm run lint` passes after dashboard/layout changes.
- `npm run build` completes and includes the dashboard route.

#### Manual Verification:

- A two-parent dashboard displays current month/year, then balance, then the current month’s expenses, with no month selector.
- A creator-awaiting-parent dashboard displays the same heading/list structure and an explanatory unavailable-balance card.
- Supplying an old or future `month` query parameter does not change the displayed dashboard month.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Responsive Add Expense Entry Points

### Overview

Turn expense creation into responsive desktop and mobile entry points while enforcing that new entries belong to the visible month.

### Changes Required:

#### 1. Reusable create-expense form lifecycle

**Files**: `src/components/expenses/CreateExpenseForm.astro`, `src/lib/expense-balance.ts`, `src/lib/expense-balance.test.ts`, `src/pages/api/expenses/create.ts`

**Intent**: Refactor creation markup and client behavior so it is instance-safe and can explicitly either refresh the dashboard or return the mobile user to it. Limit displayed date inputs to the current month through today, and enforce the same month/date invariant on the server.

**Contract**: The form retains description, child, amount, date, lock messaging, safe errors, JSON submission, and no-JavaScript fallback. A successful create response remains keyed by the created expense month; any submitted date outside the validated form month returns a user-safe validation error.

#### 2. Desktop dialog and mobile action affordances

**Files**: `src/components/expenses/ExpenseWorkspace.astro`, new `src/components/expenses/AddExpenseDialog.astro` (or equivalent focused component)

**Intent**: Add an Add Expense action beside the desktop month heading that opens a native dialog containing the shared form, and add a mobile floating action that links to the full-page form.

**Contract**: At `md` and larger, the trigger opens a labelled modal dialog, supports cancel/Escape/backdrop behavior consistent with existing dialogs, and restores focus to the trigger when closed. Below `md`, only the floating action is exposed and points to the protected add-expense route.

#### 3. Protected mobile add-expense page

**Files**: new `src/pages/expenses/new.astro`, `src/middleware.ts`

**Intent**: Provide the mobile full-page form with a clear back-to-dashboard control, current family/child context, current-month date bounds, and the shared background submission behavior.

**Contract**: `/expenses/new` requires authentication, resolves the caller’s active family before rendering, redirects users without an eligible family context to the dashboard, and on successful JavaScript submission navigates to `/dashboard` with the existing success feedback. A normal form POST still follows the create API’s safe dashboard redirect.

### Success Criteria:

#### Automated Verification:

- Add and pass unit coverage for the month-bound date validation, including first day, today, prior-month, and future-date cases.
- `npm test` passes.
- `npm run lint` and `npm run build` pass.

#### Manual Verification:

- At `md` and larger, Add Expense opens a dialog; cancel/Escape/backdrop close it and return focus to the trigger.
- Below `md`, the floating Add Expense control opens the full-page form with a working back control.
- Both entry points reject a date outside the current month and show the existing safe error treatment.
- Locked creation state remains clear and cannot submit through either entry point.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Submission Lifecycle and Regression Verification

### Overview

Complete the responsive completion flows, restore report-history navigation through a dedicated historical workspace, and verify that existing mutations remain reliable after the layout and form changes.

### Changes Required:

#### 1. Desktop creation completion and refresh compatibility

**Files**: `src/components/expenses/CreateExpenseForm.astro`, `src/components/expenses/ExpenseWorkspace.astro`, new desktop dialog component if introduced

**Intent**: On desktop success, refresh the current workspace’s balance/list, close the create dialog, reset its fields for the current month, and return focus to Add Expense without a full page refresh.

**Contract**: The workspace refresh contract continues to replace `#monthly-balance-container` and `#expense-list-container`; the create form has no global selector collision and leaves an actionable error in the dialog when a request or refresh fails.

#### 2. Mobile completion and existing mutation regression checks

**Files**: `src/components/expenses/CreateExpenseForm.astro`, `src/pages/expenses/new.astro`, `src/components/expenses/ExpenseList.astro`, `src/components/expenses/MonthlyBalancePanel.astro`

**Intent**: Navigate the mobile user back to the refreshed dashboard after a successful background submission and confirm that existing approval, edit, decline, delete, refresh, and settlement actions still operate against the current workspace.

**Contract**: Mobile submission does not leave the user on a stale add form. Existing actions preserve their server validation and update the visible current-month balance/list as before.

#### 3. Historical report route and workspace refresh target

**Files**: `src/pages/reports/[month].astro`, `src/components/expenses/MonthlyReportHistory.astro`, `src/components/expenses/ExpenseWorkspace.astro`, `src/lib/expense-balance.ts`, `src/lib/expense-balance.test.ts`

**Intent**: Make each report-history card open a protected workspace for its exact prior month instead of the current-only dashboard. Permit any strict past month to open as an empty report, and retain the established review, edit, decline, delete, refresh, settlement, and pre-confirmation creation availability rules there.

**Contract**: The detail route accepts any strict previous `YYYY-MM` month; malformed, current, and future months redirect to `/reports`. An empty past month renders as an empty workspace and exposes responsive Add Expense controls until either parent confirms that month. `ExpenseWorkspace` receives an explicit refresh target and creation-availability mode so dashboard instances refresh the current dashboard and historical instances refresh their own route. Existing action handlers continue to use the workspace refresh contract, so a successful historical mutation replaces the historical balance/list rather than navigating to the dashboard.

### Success Criteria:

#### Automated Verification:

- `npm test` passes.
- `npm run lint` passes.
- `npm run build` passes.
- Unit coverage verifies that historical route months accept valid past values, including empty months, and reject malformed, current, and future values.

#### Manual Verification:

- A desktop create submission updates totals/list, closes the dialog, and restores focus without a page reload.
- A mobile create submission navigates to the originating workspace and shows the new expense and success feedback.
- Creation API errors are visible in the active desktop or mobile form without losing entered data.
- Approve, edit, decline, delete, refresh, and settlement controls still refresh the current dashboard correctly.
- Selecting a listed historical report or opening an empty past month shows its matching workspace; its actions refresh that report, Add Expense remains available until either parent confirms, and its back link returns to report history.
- Malformed, current, and future historical report URLs return to report history.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

## Testing Strategy

### Unit Tests:

- Add tests for the server-shared date-within-month validator, including boundary dates and rejection of dates outside the displayed month.
- Retain the existing `normalizeSelectedMonth`, expense validation, balance, and settlement tests in `src/lib/expense-balance.test.ts`.

### Integration Tests:

- No migration or database-contract changes are planned; run the existing application test suite instead of adding Supabase integration coverage.

### Manual Testing Steps:

1. Verify the current-month header, balance/list ordering, and ignored `month` query parameter on desktop and mobile.
2. Verify one-parent unavailable balance presentation.
3. At desktop width, open/close the dialog using button, Cancel, Escape, and backdrop, then create an in-month expense.
4. At mobile width, use the floating action, navigate back, create an in-month expense, and return to the refreshed dashboard.
5. Select a listed historical report and open an empty past month, confirm their month and controls, then exercise an eligible existing mutation and confirm the report refreshes in place.
6. Confirm historical reports expose Add Expense until either parent confirms, and malformed/current/future report URLs redirect to report history.
7. Attempt prior-month and future dates, trigger a server error, and confirm validation/error recovery.

## Performance Considerations

The existing partial workspace refresh is retained: successful desktop and historical mutations fetch and replace only balance and expense-list containers from their explicit workspace route. The mobile form redirects after its background response, avoiding duplicate workspace markup on small screens.

## Migration Notes

No database migrations, data backfill, or release-time migration procedure is required. Roll back by reverting the route/component changes; expense data and existing API contracts remain intact.

## References

- Change requirements: `context/changes/dashboard-ui-refactoring/change.md`
- Dashboard month routing: `src/pages/dashboard.astro:25-30`
- Workspace layout and refresh contract: `src/components/expenses/ExpenseWorkspace.astro:27-99`
- Create-form submission behavior: `src/components/expenses/CreateExpenseForm.astro:21-157`
- Expense creation API: `src/pages/api/expenses/create.ts:15-37`
- Balance loading behavior: `src/lib/expense-balance.ts:471-503`
- Native dialog/mobile breakpoint pattern: `src/components/DashboardNavigation.astro:12-137`
- Report history navigation: `src/pages/reports.astro:7-31`, `src/components/expenses/MonthlyReportHistory.astro:17-58`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Current-Month Dashboard Foundation

#### Automated

- [x] 1.1 Run `npm run lint` after dashboard/layout changes — a3caf27
- [x] 1.2 Run `npm run build` and confirm the dashboard route builds — a3caf27

#### Manual

- [x] 1.3 Verify two-parent current-month heading, balance/list order, and no selector — a3caf27
- [x] 1.4 Verify one-parent unavailable balance card — a3caf27
- [x] 1.5 Verify `month` query parameters do not change the dashboard month — a3caf27

### Phase 2: Responsive Add Expense Entry Points

#### Automated

- [x] 2.1 Add and pass month-bound date-validation unit coverage — 0ec5dc6
- [x] 2.2 Run `npm test` — 0ec5dc6
- [x] 2.3 Run `npm run lint` and `npm run build` — 0ec5dc6

#### Manual

- [x] 2.4 Verify desktop dialog open/close/focus behavior — 0ec5dc6
- [x] 2.5 Verify mobile floating action and full-page form navigation — 0ec5dc6
- [x] 2.6 Verify out-of-month date validation and locked creation state — 0ec5dc6

### Phase 3: Submission Lifecycle and Regression Verification

#### Automated

- [x] 3.1 Run `npm test`, `npm run lint`, and `npm run build`
- [x] 3.2 Add and pass historical-month route-access unit coverage
- [x] 3.3 Run `npm test`, `npm run lint`, and `npm run build` after historical-report changes

#### Manual

- [x] 3.4 Verify desktop creation updates the workspace and restores trigger focus
- [x] 3.5 Verify mobile creation returns to the refreshed dashboard with success feedback
- [x] 3.6 Verify creation error recovery and current-dashboard mutation refresh behavior
- [x] 3.7 Verify historical report navigation, in-place refresh, unavailable Add Expense, and invalid-route redirect
