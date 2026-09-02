# Frame Brief: Preserve scroll after expense actions

> Framing step before /10x-plan. This document captures what is actually at
> issue, separated from what was initially assumed.

## Reported Observation

Approving an expense refreshes the full page and loses the current scroll
position. The same occurs for the other background expense actions.

## Initial Framing (preserved)

- **User's stated cause or approach**: No cause was proposed.
- **User's proposed direction**: Fix the action flow so scroll position is not lost.
- **Pre-dispatch narrowing**: The problem occurs across approval and the other background expense actions, not only one action.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Action interception** — a native form submission might not be prevented.
2. **Shared refresh fallback** — a successful mutation followed by a failed in-place refresh may intentionally navigate the document.
3. **Workspace fragment refresh** — its fetch, parsing, or target replacement might reject and trigger recovery.
4. **Route-specific behavior** — a page rendering actions might omit the workspace refresh callback.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| Action interception fails | Approval, decline, and delete handlers all call `preventDefault()` before their JSON POSTs. `src/components/expenses/ExpenseList.astro:207-226`; `DeclineExpenseDialog.astro:62-83`; `DeleteExpenseDialog.astro:56-72` | NONE |
| Shared fallback navigates after refresh failure | `refreshExpenseWorkspaceOrNavigate()` catches every refresh failure and calls `location.assign(...)`; its unit test explicitly asserts this behavior. `src/lib/expense-workspace-refresh.ts:11-21`; `src/lib/expense-workspace-refresh.test.ts:25-43` | STRONG |
| Fragment refresh rejects | The workspace throws for a non-OK GET or missing balance/list fragments; each such error reaches the shared navigation fallback. `src/components/expenses/ExpenseWorkspace.astro:107-116` | STRONG |
| Workspace callback is absent on the action pages | The workspace assigns the callback globally and both dashboard and historical reports render it. `src/components/expenses/ExpenseWorkspace.astro:127-128`; `src/pages/dashboard.astro:52`; `src/pages/reports/[month].astro:35` | WEAK |

## Narrowing Signals

- The reported behavior spans actions that share `refreshExpenseWorkspaceOrNavigate()`, which is the common navigation-capable path.
- The action POST handlers intercept their native forms, so a direct form submit does not explain the shared behavior.
- The fallback intentionally collapses unavailable callback, fetch, parsing, and fragment-mismatch failures into one document navigation, with no diagnostic retained.

## Cross-System Convention

The project rule requires form posts to run in the background so scrolling is
preserved (`context/foundation/lessons.md`). Earlier plans likewise describe
background fragment replacement as the interaction contract. The present
fallback, introduced in `f5052ea` and expanded in `f30a4b0`, is therefore a
recovery behavior that conflicts with that convention whenever it activates.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: successful expense mutations fall back to full-document navigation whenever the shared in-place workspace refresh fails, losing scroll position and hiding the refresh failure's cause.

The mutation itself is backgrounded. The scroll loss occurs afterward in the
shared recovery policy, not because approval is intrinsically a native form
post. The implementation work should identify and preserve the proper
background failure behavior while making the refresh failure observable.

## Confidence

- **HIGH** — the shared navigation is explicit, is covered by an existing unit
  test, and is reached by each affected action after its successful mutation.

## What Changes for /10x-plan

Plan the shared refresh-failure behavior and its action-level verification, not
an approval-only form submission change. Preserve normal route navigation and
the deliberate mobile creation flow outside this background-action boundary.

## References

- Source files: `src/lib/expense-workspace-refresh.ts:6-21`
- Source files: `src/components/expenses/ExpenseWorkspace.astro:107-128`
- Source files: `src/components/expenses/ExpenseList.astro:207-245`
- Source files: `src/components/expenses/DeclineExpenseDialog.astro:62-83`
- Source files: `src/components/expenses/DeleteExpenseDialog.astro:56-72`
- Related frame: `context/changes/expense-refresh-button/frame.md`
- Related plan: `context/changes/ux-changes/plan.md` (Phase 4)
