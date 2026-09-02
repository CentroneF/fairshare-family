# Expense action scroll preservation Implementation Plan

## Overview

Keep expense actions in the current document when their server mutation succeeds but the workspace fragment refresh fails. Users retain their scroll position, receive clear recovery feedback, and see a refresh indicator on the expense being updated.

## Current State Analysis

Approval, decline, deletion, and manual refresh submit through background JSON requests. They then call `refreshExpenseWorkspaceOrNavigate()`, whose recovery path performs `location.assign(...)` for every refresh error. That document navigation loses scroll position. Creation has a separate in-workspace fallback with the same issue; edit and settlement already call the throwing primitive but do not share a uniform stale-view contract.

## Desired End State

Every in-workspace mutation keeps the current document and scroll position, even when its balance/list fragment refresh fails. The affected expense card shows a brief accessible refresh indicator while its action is pending; on a refresh failure, its action becomes usable again and an accessible message accurately states that the action was saved but the view could not refresh. Intentional mobile creation navigation remains unchanged.

### Key Discoveries:

- The shared helper navigates on refresh rejection in `src/lib/expense-workspace-refresh.ts:11`.
- The workspace callback can reject on an unsuccessful GET or invalid returned fragments in `src/components/expenses/ExpenseWorkspace.astro:107`.
- Settlement already distinguishes a saved confirmation from a failed view refresh in `src/components/expenses/ExpenseWorkspace.astro:209`.
- The project rule requires form posts to remain in the background: `context/foundation/lessons.md`.

## What We're NOT Doing

- Changing expense or settlement API routes, database rules, or server-side progressive-enhancement redirects.
- Retrying a mutation automatically after its response has succeeded.
- Replacing intentional `return-to-dashboard` navigation for mobile creation.
- Adding E2E infrastructure, authentication fixtures, or a scroll-restoration mechanism for normal route navigation.

## Implementation Approach

Retire the shared navigation-on-refresh-failure policy and let existing background callers handle refresh rejection with context-aware UI feedback. Use a lightweight, accessible refreshing state on the affected expense card during the mutation-plus-refresh lifecycle, while preserving existing action-specific button labels and errors.

## Critical Implementation Details

Validate both refreshed fragments before replacing either one so a refresh failure cannot leave a half-updated workspace. Dialog-based actions must remain open until refresh succeeds; otherwise a stale-view error has no visible host.

## Phase 1: Preserve in-place expense actions

### Overview

Deliver the no-navigation recovery behavior, affected-item refresh feedback, and focused regression coverage as one browser-verifiable vertical slice.

### Changes Required:

#### 1. Shared workspace refresh contract

**Files**: `src/lib/expense-workspace-refresh.ts`, `src/lib/expense-workspace-refresh.test.ts`, `src/components/expenses/ExpenseWorkspace.astro`

**Intent**: Remove the recovery path that turns an in-place refresh error into a document navigation, and make the fragment update safe to fail as one unit.

**Contract**: `refreshExpenseWorkspace()` continues to reject when the callback is missing or refresh fails. Remove `refreshExpenseWorkspaceOrNavigate()` and its `Location` dependency. Validate both replacement targets before mutating the live document; callers receive the rejection and decide how to present it. Focused tests prove neither unavailable callbacks nor failed refreshes call `location.assign`.

#### 2. Expense action feedback and refresh indicators

**Files**: `src/components/expenses/ExpenseList.astro`, `src/components/expenses/DeclineExpenseDialog.astro`, `src/components/expenses/DeleteExpenseDialog.astro`, `src/components/expenses/ExpenseWorkspace.astro`, `src/components/expenses/CreateExpenseForm.astro`

**Intent**: Make background action progress visible on the affected expense without moving the user, and provide truthful recovery feedback if saved data cannot be rendered immediately.

**Contract**: Approve, decline, delete, and edit mark their associated `[data-expense-id]` card as refreshing while the JSON request and fragment refresh are in flight, with a visible refresh icon and an accessible busy description. Clear that state in every completion path. After a successful mutation followed by refresh failure, keep the viewport unchanged, restore the action control, and show an action-local `role="alert"` explaining that the change was saved but the view could not refresh. Keep dialogs open on this failure so the message is visible. Creation, settlement, and manual Refresh use their existing controls as the pending affordance and adopt the same no-navigation, truthful stale-view feedback. Preserve the explicit mobile creation redirect.

#### 3. Focused regression and manual verification

**Files**: `src/lib/expense-workspace-refresh.test.ts`; update colocated tests only if a new pure helper is introduced for refreshing-card state.

**Intent**: Protect the common recovery policy that caused the scroll loss, then verify the real browser interaction that unit tests cannot observe.

**Contract**: Tests cover successful delegation, unavailable callback, and failed callback without navigation. The manual path confirms an affected card's refresh icon, retained scroll/URL after action and manual refresh, accurate stale-view feedback, and ordinary successful list/balance replacement.

### Success Criteria:

#### Automated Verification:

- Focused workspace-refresh tests prove no fallback document navigation after refresh rejection.
- `npm test` and `npm run build` pass.
- Run `npm run verify`; if the known unrelated `packages/code-reviewer` lint errors remain, report them without changing that package.

#### Manual Verification:

- From a scrolled dashboard, approve, decline, delete, edit, and create an expense; confirm the URL and scroll position stay unchanged and the balance and list update on successful refresh.
- Confirm the affected existing expense card displays its refresh indicator while approve, decline, delete, or edit is processing.
- Induce a fragment-refresh failure after a successful action; confirm no page navigation, an accurate accessible stale-view message, and a usable action control. Confirm manual Refresh remains usable with its existing error.
- Confirm mobile expense creation still follows its deliberate return-to-dashboard path.

**Implementation Note**: After automated verification passes (or the known unrelated lint baseline is documented), pause for human confirmation of the browser checks before committing.

---

## Testing Strategy

### Unit Tests:

- Exercise the shared refresh primitive's success and rejection behavior with a spyable `location.assign`.
- Ensure unavailable callback and failed callback paths reject rather than navigate.

### Integration Tests:

- No database test is needed: the change preserves the existing JSON mutation and authorization contracts.

### Manual Testing Steps:

1. Scroll the dashboard below the expense list header and perform each existing expense action as an eligible parent.
2. Observe the affected card's refresh indicator and verify that a normal response updates balance and list without a document navigation.
3. Temporarily induce a workspace fragment refresh failure after a successful action; verify scroll retention, the stale-view alert, and re-enabled action.
4. Verify Refresh and mobile creation retain their specified independent behavior.

## Performance Considerations

The change adds only transient DOM state to an existing single-card action; it does not add requests, polling, persistence, or client-side caches.

## Migration Notes

No migration is required. Existing non-JavaScript form redirects stay intact as the server routes' progressive-enhancement behavior.

## References

- Frame: `context/changes/expense-action-scroll-preservation/frame.md`
- Shared refresh helper: `src/lib/expense-workspace-refresh.ts:6`
- Workspace fragment refresh: `src/components/expenses/ExpenseWorkspace.astro:107`
- Settlement stale-view pattern: `src/components/expenses/ExpenseWorkspace.astro:209`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Preserve in-place expense actions

#### Automated

- [ ] 1.1 Replace navigation fallback with a rejecting shared refresh contract.
- [ ] 1.2 Add affected-item refresh indicators and no-navigation stale-view feedback.
- [ ] 1.3 Add focused refresh-failure regression coverage.
- [ ] 1.4 Run focused checks, `npm test`, `npm run build`, and `npm run verify`.

#### Manual

- [ ] 1.5 Verify in-place actions, refresh indicators, and retained scroll position.
- [ ] 1.6 Verify failed refresh recovery and intentional mobile creation navigation.
