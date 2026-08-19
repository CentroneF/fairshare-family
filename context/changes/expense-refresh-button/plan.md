# Expense refresh button implementation plan

## Overview

Restore background refresh for the expense workspace by ensuring its client-side handlers only reference helpers from the same emitted Astro script. Surface a subtle inline error when a refresh cannot complete.

## Current State Analysis

`ExpenseList.astro` renders the refresh form correctly, but its refresh submit listener is in a separate processed Astro script from the helper it calls. Astro emits those scripts as separate modules, so the handler prevents the native request and then fails before it can start the workspace fetch. Other expense controls resolve the global workspace refresh callback from within their own scripts.

## Desired End State

Clicking Refresh updates the expense workspace without a page reload. If the refresh operation fails, the button returns to its normal state and an unobtrusive inline error explains that the list could not be refreshed. Existing approval, decline, edit, delete, and create actions continue to refresh the workspace.

### Key Discoveries:

- The broken handler calls a helper defined in another Astro script: `src/components/expenses/ExpenseList.astro:156-161,207-224`.
- Existing controls use a same-script wrapper around `window.refreshExpenseWorkspace`: `src/components/expenses/DeclineExpenseDialog.astro:42-47`, `src/components/expenses/DeleteExpenseDialog.astro:33-37`.
- Background refresh is a project rule: `context/foundation/lessons.md`.

## What We're NOT Doing

- Changing the expense API or workspace fetch contract.
- Adding page reloads as the normal refresh path.
- Changing database schema or recurring-expense behavior.

## Implementation Approach

Consolidate the list’s browser handlers behind one guarded setup path, resolving the workspace callback inside that script’s lexical scope. Keep native form semantics until the handler successfully intercepts submission, and render refresh failures beside the control.

## Phase 1: Restore resilient expense refresh

### Overview

Make the Refresh button execute the workspace refresh flow reliably and audit the adjacent list action handler for the same cross-script dependency risk.

### Changes Required:

#### 1. Expense-list handler consolidation and feedback

**Files**: `src/components/expenses/ExpenseList.astro`; focused component or browser-level regression test as appropriate.

**Intent**: Keep the client event handlers executable after Astro compiles component scripts separately, prevent duplicate listener registration, and show a low-profile inline error when refresh fails.

**Contract**: Refresh resolves `window.refreshExpenseWorkspace` inside the handler’s script, submits the selected month without navigation, restores the button state in all outcomes, and exposes errors through an accessible inline alert. Approval behavior retains its existing request and workspace-refresh semantics.

### Success Criteria:

#### Automated Verification:

- Focused regression coverage proves the Refresh submit path invokes the workspace callback and reports an unavailable/failed callback safely.
- `npm run verify` passes.

#### Manual Verification:

- Clicking Refresh changes its state, issues a background request, and updates the list without a page reload.
- An induced refresh failure displays a non-invasive error and leaves the control usable.
- Approve, decline, edit, delete, and create still refresh the workspace correctly.

**Implementation Note**: After completing this phase and automated verification, pause for human confirmation before committing.

## Testing Strategy

### Unit Tests:

- Cover same-script refresh callback resolution and error state rendering.

### Integration Tests:

- Preserve existing expense action request and refresh behavior.

### Manual Testing Steps:

1. Click Refresh and confirm its loading state, a background request, and list replacement without navigation.
2. Temporarily make the workspace callback unavailable and confirm the inline error appears while the button becomes usable again.
3. Run each expense action and confirm the workspace still refreshes.

## References

- Frame: `context/changes/expense-refresh-button/frame.md`
- Expense workspace: `src/components/expenses/ExpenseWorkspace.astro:104-123`
- Existing refresh-wrapper patterns: `src/components/expenses/DeclineExpenseDialog.astro:42-47`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Restore resilient expense refresh

#### Automated

- [ ] 1.1 Consolidate the expense-list handlers and add focused refresh regression coverage.
- [ ] 1.2 Run focused checks and `npm run verify`.

#### Manual

- [ ] 1.3 Verify background refresh, failure feedback, and the adjacent expense actions in the browser.
