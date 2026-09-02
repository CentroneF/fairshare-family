# Preserve scroll after expense actions — Plan Brief

> Full plan: `context/changes/expense-action-scroll-preservation/plan.md`
> Frame brief: `context/changes/expense-action-scroll-preservation/frame.md`

## What & Why

> **The actual problem to plan around is**: successful expense mutations fall back to full-document navigation whenever the shared in-place workspace refresh fails, losing scroll position and hiding the refresh failure's cause.

The fallback is real, but investigation found the refresh is consistently unavailable because the workspace client script never parses in the browser. This revised plan first restores a valid workspace runtime, then retains no-navigation recovery for genuine refresh failures.

## Starting Point

The workspace currently passes `refreshTarget` through `define:vars` while its inline script contains TypeScript syntax. Astro emits that code verbatim, so browser parsing aborts before registering the refresh callback or edit/settlement handlers.

## Desired End State

Expense actions refresh the live balance and list without reloading or moving the viewport. Existing expense cards show an accessible refresh indicator during their action; stale-view feedback appears only when a functioning refresh operation genuinely fails. Mobile creation continues its deliberate navigation flow.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Runtime configuration | DOM data attribute + processed script | Prevents TypeScript from reaching a raw browser script while retaining route-specific targets. | Plan |
| Failure recovery | No document navigation | Background actions must retain scroll position. | Frame |
| Pending feedback | Refresh icon on affected card | Identifies the item being updated without moving the user. | Plan |
| Post-save failure | Re-enable control with stale-view alert | The user requested a usable recovery path. | Plan |
| Mobile creation | Preserve route navigation | It is an intentional completion behavior, not refresh recovery. | Frame |

## Scope

**In scope:**

- Workspace runtime registration and refresh contract.
- Existing expense action, creation, settlement, and Refresh feedback.
- Affected-expense refresh indicator and runtime-aware regression coverage.

**Out of scope:**

- APIs, database rules, automatic mutation retries, and E2E authentication fixtures.
- Normal route-navigation scroll restoration.

## Architecture / Approach

`ExpenseWorkspace` renders its refresh target as data and runs the client code through Astro's normal script pipeline. Callers use the shared rejecting refresh primitive; action components own their pending state and show contextual recovery feedback only after a completed mutation cannot render the refreshed workspace.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Restore valid in-place workspace refresh | Browser-valid callback, no-navigation updates, card feedback, and regression coverage | A raw script can silently stop all workspace handlers before any fetch begins. |

**Prerequisites:** Existing expense workspace and JSON action routes.
**Estimated effort:** One focused implementation and verification session.

## Open Risks & Assumptions

- Browser scroll proof remains a manual check because the current E2E setup lacks reusable authenticated expense fixtures.
- `npm run verify` may continue to expose unrelated `packages/code-reviewer` lint errors; this change will not alter that package.

## Success Criteria (Summary)

- A browser-valid workspace script registers the refresh callback on dashboard and reports.
- Successful actions update the balance and list without document navigation or scroll loss.
- Genuine refresh failures retain the page, provide accessible feedback, and leave controls usable.
