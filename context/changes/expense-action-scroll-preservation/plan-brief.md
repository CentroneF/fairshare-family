# Preserve scroll after expense actions — Plan Brief

> Full plan: `context/changes/expense-action-scroll-preservation/plan.md`
> Frame brief: `context/changes/expense-action-scroll-preservation/frame.md`

## What & Why

> **The actual problem to plan around is**: successful expense mutations fall back to full-document navigation whenever the shared in-place workspace refresh fails, losing scroll position and hiding the refresh failure's cause.

This plan removes that recovery navigation. A saved action stays on the current page, its card visibly refreshes, and any failed view update is accurately explained without pretending the mutation failed.

## Starting Point

Expense actions already use background JSON posts and fragment replacement. Their shared refresh helper catches failures and calls `location.assign`, which is why the browser loses scroll despite the background mutation.

## Desired End State

Approval, decline, deletion, editing, and in-workspace creation preserve the current URL and scroll position on both successful and failed fragment refresh. Existing expense cards show a transient refresh icon during their action; users can retry after a stale-view error. Deliberate mobile creation navigation is unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Failure recovery | No document navigation | Scroll preservation is the project convention for background actions. | Frame |
| Action scope | All in-workspace actions | They share the refresh boundary; approval-only handling would leave the defect elsewhere. | Plan |
| Pending feedback | Refresh icon on affected card | Shows exactly which expense is updating without displacing the user. | Plan |
| Post-save failure | Re-enable action with a stale-view alert | The user requested a usable control rather than a permanently disabled action. | Plan |
| Mobile creation | Preserve route navigation | This is an intentional completion behavior, not refresh recovery. | Frame |

## Scope

**In scope:**

- Shared workspace refresh behavior and its unit tests.
- Existing expense action, creation, settlement, and Refresh feedback.
- Affected-expense refresh indicator and manual scroll verification.

**Out of scope:**

- APIs, database rules, automated mutation retries, and E2E infrastructure.
- Normal route-navigation scroll restoration.

## Architecture / Approach

The shared refresh primitive remains responsible only for replacing valid workspace fragments. It rejects failures instead of navigating. Each existing caller keeps ownership of its button, dialog, or card state and renders a context-aware stale-view message when a saved mutation cannot refresh the view.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Preserve in-place expense actions | No-navigation recovery, card indicators, and regression coverage | A saved action could be misreported as failed or its dialog could close before feedback appears. |

**Prerequisites:** Existing expense workspace and JSON action routes.
**Estimated effort:** One focused implementation and verification session.

## Open Risks & Assumptions

- Full browser scroll proof remains a manual check because the present E2E setup lacks reusable authenticated expense fixtures.
- `npm run verify` may continue to expose unrelated existing lint errors in `packages/code-reviewer`; this plan does not alter that package.

## Success Criteria (Summary)

- A successful action never triggers document navigation solely because the workspace refresh failed.
- Users see an affected-card refresh indicator during expense actions and retain their scroll position after completion.
- A stale-view error is truthful, accessible, and leaves the control usable.
