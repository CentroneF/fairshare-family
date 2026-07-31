# Dashboard UI Refactoring — Plan Brief

> Full plan: `context/changes/dashboard-ui-refactoring/plan.md`

## What & Why

The dashboard is a current-month workspace, so older reports can no longer rely on its former `?month=` navigation. This revision adds a dedicated historical workspace so a report selected from history displays the correct prior month without weakening the current-month dashboard contract.

## Starting Point

The dashboard consistently renders the current UTC month and intentionally ignores `month` query parameters. Report-history cards still link to that ignored query, so selecting a prior report returns the user to the current dashboard instead.

## Desired End State

Report-history cards open an authenticated workspace for the selected previous month. Any valid past month can also open as an empty report. Historical workspaces preserve existing review, edit, decline, delete, refresh, and settlement availability, and allow expense creation until either parent confirms that month.

## Key Decisions Made

| Decision | Choice | Why |
| --- | --- | --- |
| Historical content | Reuse the workspace | Keeps report detail and existing action behavior consistent. |
| Route access | Any valid past month | Allows an empty historical report to be opened and populated. |
| Invalid route | Redirect to report history | Keeps recovery in the historical-report flow. |
| Historical creation | Available until first confirmation | Keeps past reports correctable before they are locked. |
| Historical actions | Preserve existing availability rules | Supports corrections and eligible settlement for prior reports. |
| Automated coverage | Unit access checks plus suite | Locks down route boundaries without new browser tooling. |

## Scope

**In scope:** dedicated prior-report route, report-card links, route validation, workspace refresh target, historical creation before confirmation, and historical-route coverage.

**Out of scope:** dashboard month navigation, changes to the existing confirmation lock, API/RLS changes, migrations, and a new browser-test framework.

## Architecture / Approach

`/reports/[month]` validates any previous `YYYY-MM` month and loads the existing workspace state, including an empty state. `ExpenseWorkspace` gains explicit configuration for its refresh destination and whether creation actions are available; historical creation remains available until the existing confirmation lock applies. Existing mutation handlers continue their background refresh using the configured route.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Current-month dashboard | Current-month layout and balance state | Completed |
| 2. Responsive creation | Desktop dialog and mobile creation page | Completed |
| 3. Completion and historical reports | Submission regressions plus prior-report route | Refreshing the wrong workspace after a mutation |

**Prerequisites:** Phases 1–2 are committed; Phase 3 baseline checks passed.
**Estimated effort:** One focused implementation session.

## Open Risks & Assumptions

- Historical mutation APIs remain the source of authorization; the route only controls which forms are presented.
- A valid prior month may be opened directly even before it has expenses or a settlement row.

## Success Criteria (Summary)

- Listed reports and valid empty past months open their exact workspace; malformed, current, and future routes return to history.
- Historical mutations refresh the historical workspace, and Add Expense remains available only until first confirmation.
- Tests, lint, and production build pass.
