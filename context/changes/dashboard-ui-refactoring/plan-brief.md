# Dashboard UI Refactoring — Plan Brief

> Full plan: `context/changes/dashboard-ui-refactoring/plan.md`

## What & Why

Refactor the dashboard into a simpler current-month workspace: month/year first, balance second, expenses third. Expense creation becomes an intentional action rather than an always-visible form, using a dialog on desktop and a focused full-page flow on mobile.

## Starting Point

The dashboard currently lets users choose a URL-backed month and renders a selector, inline create form, balance, then expense list. The create form is coupled to dashboard-only refresh code, while a balance is unavailable until both parents have joined.

## Desired End State

The dashboard always displays the current month and year without a selector; historic information remains available through Report history. Users add a current-month expense through a desktop dialog or mobile full page, and successful submissions promptly return them to an updated dashboard without a normal form-post refresh.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Dashboard month | Current month only | Removes hidden month-navigation state and matches the simplified dashboard request. |
| Responsive split | Existing `md` breakpoint | Aligns with the project’s established desktop/mobile navigation behavior. |
| Desktop entry | Header button + native dialog | Keeps the primary action visible while preserving dashboard context. |
| Mobile entry | Floating action + full-page form | Gives small screens a focused creation flow. |
| Expense date | Current month through today | Ensures a created expense appears in the dashboard users return to. |
| One-parent balance | Informative unavailable card | Explains why balance cannot be calculated without showing incorrect zeroes. |
| Submission lifecycle | Background submit | Preserves the project rule against normal full-page form posts. |
| Verification | Existing checks + responsive manual testing | Matches the repository’s current test tooling without expanding scope. |

## Scope

**In scope:**

- Current-month dashboard heading and content order
- Removed month selector
- Unavailable balance presentation
- Desktop dialog and mobile full-page expense creation
- Client and server current-month date validation
- Background submission/error/focus behavior

**Out of scope:**

- Historical dashboard month navigation
- Database/RLS/settlement-rule changes
- New browser-test infrastructure
- Redesign of existing edit/review/settlement flows

## Architecture / Approach

`dashboard.astro` becomes the current-month boundary and passes the month into `ExpenseWorkspace`. The workspace composes heading, balance, and list, while a reusable create form receives its presentation and success context from either a desktop dialog or the protected `/expenses/new` page. The existing create endpoint stays in place, with shared month-bound date validation added before persistence.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Current-month foundation | Simplified dashboard order and unavailable balance state | Preserving both onboarding-family layouts |
| 2. Responsive entry points | Desktop dialog, mobile route, and month-bound validation | Decoupling the form from global dashboard selectors |
| 3. Lifecycle verification | Correct post-submit behavior and regression checks | Ensuring existing mutation refreshes still work |

**Prerequisites:** Local application dependencies installed; authenticated family test accounts for one- and two-parent states.
**Estimated effort:** ~2–3 implementation sessions across 3 phases.

## Open Risks & Assumptions

- “Month and year” means the current UTC calendar month, consistent with existing server-side date logic.
- Report history remains the supported place to inspect past months.
- Native `<dialog>` behavior is supported by the application’s target browsers, as it is already used for expense actions.

## Success Criteria (Summary)

- The dashboard presents current month/year → balance → expenses, with no month selector.
- Desktop and mobile users can add only current-month expenses through their respective responsive flows.
- Submissions remain background operations, surface errors safely, and leave the dashboard data accurate.
