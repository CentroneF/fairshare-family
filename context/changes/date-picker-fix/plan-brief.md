# Expense Date Picker Boundaries — Plan Brief

> Full plan: `context/changes/date-picker-fix/plan.md`
> Frame brief: `context/changes/date-picker-fix/frame.md`

## What & Why

The create-expense UI does not faithfully express the existing selected-month business rule, and the native date control cannot guarantee the requested no-cross-month-navigation interaction. This plan replaces that control with an app-owned calendar that exposes only the selected report month while preserving the API as the final validator.

## Starting Point

The shared form has a selected-month lower bound but uses today as its upper bound, so a historical report can expose later months. The create API already rejects dates outside the posted month; the gap is the client interaction, not data integrity.

## Desired End State

Desktop and mobile Add Expense use the same compact popover calendar. It offers every eligible day in the selected month, has no month navigation controls, and visibly disables future dates when the selected month is current. The chosen ISO date continues through the existing background submission flow.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Calendar ownership | App-owned React calendar | Native picker navigation is browser-controlled and cannot meet the requirement. | Plan |
| Current-month future days | Visible but disabled | Makes the complete month and no-future-date rule clear. | Plan |
| Calendar presentation | Triggered popover | Keeps the shared desktop/mobile form compact without nested dialogs. | Plan |
| Non-JavaScript behavior | JavaScript required | Chosen explicitly; missing date fails safely through the existing API. | Plan |
| Server invariant | Keep unchanged | The API already enforces selected-month integrity. | Frame |

## Scope

**In scope:**

- A fixed-month popover calendar for create-expense forms.
- Date helpers and Vitest coverage for calendar boundaries.
- Desktop/mobile creation and server-boundary regression checks.

**Out of scope:**

- Edit-expense date behavior, database work, third-party calendar dependencies, and new browser/component test frameworks.

## Architecture / Approach

A small hydrated React island owns the trigger, popover grid, and hidden `expenseDate` field. It consumes the selected month and existing upper boundary from the Astro form; pure helpers build the month grid and eligibility. The Astro form continues to own submission, errors, and completion behavior, while the API remains authoritative for tampered requests.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Selected-Month Calendar Integration | Fixed-month accessible calendar in both create flows | Synchronizing island state with form reset and popover focus behavior |
| 2. Boundary and Submission Regression Verification | Client/server boundary confidence and no-scope-creep checks | JavaScript-only behavior must fail safely when date data is missing |

**Prerequisites:** Existing React integration and Vitest setup; no new service or database access.
**Estimated effort:** One focused implementation session plus manual desktop/mobile verification.

## Open Risks & Assumptions

- The app-owned popover must be manually checked on desktop and mobile because the repository has no browser E2E suite.
- JavaScript-disabled form submissions will be rejected for the missing date by design.

## Success Criteria (Summary)

- Users cannot navigate the expense date picker into another month and can select every eligible date in the displayed month.
- Current-month future days are visible but cannot be selected.
- Desktop and mobile creation retain their existing background-success paths, while invalid or tampered submissions remain safely rejected.
