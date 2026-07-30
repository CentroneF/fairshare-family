# Responsive Dashboard Navigation Implementation Plan

## Overview

Move secondary information out of the established-family dashboard flow. Parents will use a responsive navigation surface—sidebar on larger screens and a slide-in drawer on smaller screens—and report history will move to a dedicated page.

## Current State Analysis

The dashboard renders account information and sign out in its header, then renders the family summary and expense workspace in one central column. The workspace also loads and renders the historical-report list, and its background refresh replaces that list's DOM container after expense or settlement mutations.

The report data is already available through the family-scoped `loadMonthlyReportHistory` server seam. Its entries are normal dashboard-month links, so the new index page can reuse the canonical detailed report view instead of creating a second report-detail surface.

## Desired End State

For an established family, a parent sees their account, family summary, sign out, and a Report history link in a persistent desktop sidebar or a mobile burger-menu drawer. The primary expense workspace remains the main dashboard content. The drawer slides in and can be dismissed with its close control or its backdrop.

`/reports` is an authenticated, family-scoped page that lists each available past month with its settlement status and approved total. Selecting an item opens the existing `/dashboard?month=YYYY-MM` detailed report. First-time and awaiting-second-parent dashboard setups retain their current layouts.

### Key Discoveries:

- `src/pages/dashboard.astro:35-102` currently owns the inline account header and chooses between setup, waiting, and established-family layouts.
- `src/components/expenses/ExpenseWorkspace.astro:17-25,83-105` both loads report history and replaces its history container during background refreshes; moving history out requires removing that obsolete refresh dependency.
- `src/lib/expense-balance.ts:458-469` already exposes an RLS-backed, typed report-history loader, and `src/components/expenses/MonthlyReportHistory.astro:36-59` already defines the month/status/approved-total row contract.
- `src/middleware.ts:4-21` currently protects only `/dashboard`; `/reports` must be added to the same authenticated-route boundary.
- Existing tests are library-only Vitest tests; no browser or DOM test framework is installed (`package.json:5-13,38-58`).

## What We're NOT Doing

- Changing expense, settlement, or family database schema, RLS policies, or API endpoints.
- Creating a new report-detail route, exports, pagination, filtering, or stored report aggregates.
- Showing report rows directly in the sidebar or drawer.
- Changing the first-time or awaiting-second-parent setup experiences, including invite and child-management controls.
- Adding a browser E2E or DOM-test framework solely for this change.

## Implementation Approach

Keep report data server-rendered. Extract the current report-list presentation into the dedicated page and remove report history from the dashboard workspace state/refresh targets. Add a small Astro navigation component for the established-family branch only; it renders the same account and family content responsively as a desktop sidebar and a modal mobile drawer, with delegated client interactions following the existing Astro dialog pattern.

## Critical Implementation Details

The current workspace refresh parses a fresh dashboard document and replaces the balance, list, and report-history containers. Once report history leaves the dashboard, remove its replacement and disclosure-state handling together; leaving either behind would make a successful background expense action fail its refresh check. The drawer must close only for the explicit close control and a backdrop click, not clicks inside its panel; normal report navigation remains a standard link.

## Phase 1: Deliver the Dedicated Report-History Page

### Overview

Make report history independently reachable as a protected, family-scoped page before moving dashboard navigation to point at it.

### Changes Required:

#### 1. History data ownership and presentation

**Files**: `src/lib/expense-balance.ts`, `src/components/expenses/ExpenseWorkspace.astro`, `src/components/expenses/MonthlyReportHistory.astro`

**Intent**: Move report-history ownership out of the expense workspace while retaining the existing authoritative data and row semantics.

**Contract**: Keep `loadMonthlyReportHistory` as the typed, server-side source for report rows. Remove `history` from `ExpenseWorkspaceState`, stop loading it from `loadExpenseWorkspaceState`, and remove the dashboard-embedded history component/container. Refactor the history component into a page-ready list that accepts report rows, shows a readable month, Settled/Unsettled status, and approved PLN total, and links each row to `/dashboard?month=YYYY-MM`; preserve an explanatory empty state.

#### 2. Authenticated report-history route

**Files**: `src/pages/reports.astro`, `src/middleware.ts`

**Intent**: Provide a simple dedicated history page that only an authenticated parent with a family can use.

**Contract**: Add `/reports` to the protected route list. The page must resolve the authenticated user's onboarding/family state, redirect users without an established family to `/dashboard`, and invoke `loadMonthlyReportHistory` with the server-derived family ID and current month. Render the refactored list and a normal dashboard-return link; do not accept family or report data from the client.

### Success Criteria:

#### Automated Verification:

- `npm test` passes after the workspace-state and history-component contract changes.
- `npm run lint` and `npm run build` pass with the protected `/reports` route.

#### Manual Verification:

- As an established-family parent, visit `/reports` and confirm month, status, approved total, empty state, and each dashboard-month link are correct.
- Visit `/reports` while signed out and confirm redirect to sign in; visit it before family setup completes and confirm redirect to the unchanged dashboard setup.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Add Responsive Established-Family Navigation

### Overview

Recompose only the established-family dashboard into a desktop sidebar and mobile burger-menu drawer while keeping expense tracking central.

### Changes Required:

#### 1. Shared navigation surface

**Files**: `src/components/DashboardNavigation.astro` (new), `src/components/family/FamilySummaryPanel.astro`, `src/pages/dashboard.astro`

**Intent**: Place account information, family description, sign out, and report-history access in one responsive surface instead of the established dashboard's main flow.

**Contract**: Create a presentational Astro navigation component with server-rendered props for user email, family name, children, and the `/reports` destination. It must render a persistent sidebar at the desktop breakpoint and a labelled burger button plus slide-in drawer below that breakpoint. Both presentations expose the same secondary content without duplicate IDs. The drawer includes an explicit close control and closes when its backdrop itself is clicked; clicks within the panel do not close it. Retire the established-family use of `FamilySummaryPanel` and restructure only that dashboard branch into sidebar-plus-main-content layout. Do not alter the no-family or creator-awaiting-parent branches.

#### 2. Drawer interaction and visual regression safeguards

**Files**: `src/components/DashboardNavigation.astro`, `src/pages/dashboard.astro`

**Intent**: Make the small-screen navigation usable without sacrificing the existing expense actions or accessibility baseline.

**Contract**: Use the project's existing dialog/event-delegation conventions to open the mobile drawer, focus it on open, and return focus to the burger trigger after non-navigation dismissal. Keep the primary workspace in the dashboard main region; the report-history link remains a normal navigation. Ensure desktop shows the sidebar and suppresses the burger trigger, while small screens suppress the sidebar and expose the drawer trigger.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, and `npm run build` pass after responsive navigation integration.

#### Manual Verification:

- On a narrow viewport, open the drawer, verify its account/family/sign-out/history content, dismiss it with the close control and backdrop, and verify focus returns to the burger trigger after each dismissal.
- On a desktop viewport, verify the sidebar is visible, the burger trigger is absent, and expense creation/review/edit/delete/settlement flows remain usable in the main region.
- Verify no-family and awaiting-second-parent dashboard states remain visually and functionally unchanged.

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Verify Report Navigation and Refresh Boundaries

### Overview

Prove that removing dashboard history did not regress background expense updates or report navigation.

### Changes Required:

#### 1. Workspace refresh cleanup

**Files**: `src/components/expenses/ExpenseWorkspace.astro`

**Intent**: Keep background expense and settlement actions reliable after the history container leaves the dashboard.

**Contract**: Update `refreshExpenseWorkspace` to replace only the still-rendered balance and expense-list fragments. Remove report-history lookup, replacement, and disclosure-state preservation so its success check cannot fail because a removed element is absent. Preserve selected-month URL updates and all existing JSON form-submit behavior.

#### 2. Regression checks and documentation alignment

**Files**: `src/lib/expense-balance.test.ts`, `context/changes/add-burger-menu/plan.md`

**Intent**: Retain existing history read-model coverage and document the final validation boundary without introducing unsupported UI test tooling.

**Contract**: Keep the existing focused tests for history row derivation and mapping intact after state-shape changes; add or adjust only type-safe assertions required by changed exported contracts. Validate the route and responsive UI manually rather than adding an E2E framework. Do not edit archived change artifacts.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, and `npm run build` pass from a clean working tree.

#### Manual Verification:

- Perform create, approve, edit, delete, decline, and settlement actions and confirm the dashboard balance/list refresh continues without a history-container error.
- From both sidebar and drawer, follow Report history to `/reports`, open a past month, and confirm the existing detailed dashboard report is shown.
- Confirm report history reflects server-rendered data on a fresh `/reports` visit after relevant expense or settlement changes.

**Implementation Note**: Pause for final manual confirmation before treating this change as complete.

## Testing Strategy

### Unit Tests:

- Retain `src/lib/expense-balance.test.ts` coverage for history month ordering, status mapping, and exact approved totals.
- Add only focused assertions needed if the exported workspace state no longer carries history.

### Integration Tests:

- No new database integration test is required: report history continues to use the existing RLS-backed RPC and no database contract changes.

### Manual Testing Steps:

1. Sign in as a parent in an established family and verify desktop sidebar content, then verify the mobile drawer at a narrow viewport.
2. Close the drawer with its close control and backdrop; confirm focus returns to the burger control.
3. Use the Report history link, verify the list's month/status/approved-total rows and empty state, then open a row and confirm the selected dashboard month.
4. Submit each existing background expense or settlement action and confirm the balance/list refresh succeeds.
5. Verify the no-family and awaiting-second-parent dashboard flows remain unchanged.

## Performance Considerations

The dashboard no longer loads or replaces report history during each workspace refresh. `/reports` makes the existing single server-side history read only when a parent requests it; no client-side data cache, per-row detail fetch, or aggregate storage is introduced.

## Migration Notes

No migration is required. The existing family-scoped report-history RPC, RLS enforcement, and `/dashboard?month=` detailed-report contract remain unchanged.

## References

- Frame brief: `context/changes/add-burger-menu/frame.md`
- Existing report-history plan (historical context): `context/archive/2026-07-29-monthly-report-history/plan.md`
- Dashboard composition: `src/pages/dashboard.astro:35-102`
- Workspace refresh behavior: `src/components/expenses/ExpenseWorkspace.astro:88-109`
- History loader: `src/lib/expense-balance.ts:458-506`
- Existing report rows: `src/components/expenses/MonthlyReportHistory.astro:18-66`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Deliver the Dedicated Report-History Page

#### Automated

- [x] 1.1 Report-history route tests, lint, and production build pass.

#### Manual

- [x] 1.2 Verify authenticated history access, report rows, dashboard links, and setup-state redirect.

### Phase 2: Add Responsive Established-Family Navigation

#### Automated

- [ ] 2.1 Responsive navigation integration tests, lint, and production build pass.

#### Manual

- [ ] 2.2 Verify desktop sidebar, mobile drawer dismissal/focus, main workspace behavior, and unchanged setup states.

### Phase 3: Verify Report Navigation and Refresh Boundaries

#### Automated

- [ ] 3.1 Full unit suite, lint, and production build pass after refresh cleanup.

#### Manual

- [ ] 3.2 Verify all background expense and settlement actions refresh correctly and report navigation remains current.
