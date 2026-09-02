# Expense action scroll preservation Implementation Plan

## Overview

Keep expense actions in the current document while restoring the workspace refresh runtime that is currently failing before it starts. Users retain their scroll position, see an affected-item refresh indicator, and receive truthful stale-view feedback only for genuine refresh failures.

## Current State Analysis

The shared refresh helper previously caught every rejection and navigated with `location.assign(...)`, which lost the scroll position. That fallback concealed a deeper issue: `ExpenseWorkspace.astro` uses `define:vars` for a raw inline script containing TypeScript syntax. Production output therefore contains invalid browser JavaScript, so the script never registers `window.refreshExpenseWorkspace` or its edit and settlement handlers. Every action that calls the helper consequently rejects before issuing the refresh GET.

## Desired End State

Expense workspace client code is valid and initialized on dashboard and report pages. Successful in-workspace actions replace balance and list fragments without navigation and preserve the current scroll position. The affected expense card visibly refreshes while its action is pending; only a real fetch, parsing, or fragment replacement failure shows a saved-but-stale alert and restores the control. Intentional mobile creation navigation remains unchanged.

### Key Discoveries:

- `define:vars` emits `ExpenseWorkspace.astro` as unprocessed inline JavaScript, while the script contains TypeScript annotations and assertions at `src/components/expenses/ExpenseWorkspace.astro:104-130`.
- Built output preserves `async function refreshExpenseWorkspace(month: string)`, which browsers cannot parse: `dist/server/chunks/ExpenseWorkspace_CZGAi1JT.mjs:139-165`.
- The shared helper rejects if its global callback was never registered: `src/lib/expense-workspace-refresh.ts:5-7`.
- The PWA and middleware are not the cause: protected workspace GETs are network-only and the service worker has no runtime GET cache rule.

## What We're NOT Doing

- Changing expense or settlement APIs, database rules, or server-side progressive-enhancement redirects.
- Retrying a mutation automatically after its response succeeds.
- Replacing the intentional mobile `return-to-dashboard` creation flow.
- Adding authenticated E2E fixtures or a general scroll-restoration mechanism for route navigation.

## Implementation Approach

Make the workspace runtime a normal Astro-processed client script, using a rendered DOM data attribute to supply its page-specific refresh target. Keep the shared helper rejecting rather than navigating, then let each action preserve its existing control state and surface stale-view feedback only after a completed mutation cannot refresh valid workspace fragments.

## Critical Implementation Details

The page-specific refresh target cannot be captured by a TypeScript-bearing `define:vars` script. Read it from a stable workspace element at runtime so Astro can compile the entire client script. Validate both incoming and live replacement containers before replacing either one; a failed refresh must not leave a half-updated workspace.

## Phase 1: Restore valid in-place workspace refresh

### Overview

Repair the client-runtime registration defect, preserve no-navigation recovery, and deliver visible pending feedback as one browser-verifiable vertical slice.

### Changes Required:

#### 1. Valid workspace client runtime

**Files**: `src/components/expenses/ExpenseWorkspace.astro`, `src/lib/expense-workspace-refresh.ts`, `src/lib/expense-workspace-refresh.test.ts`

**Intent**: Ensure the workspace callback and delegated edit/settlement handlers can execute in every rendered workspace, then retain a rejecting refresh contract with no navigation fallback.

**Contract**: Render the refresh target as a workspace data attribute and read it from a processed client script. The callback is registered before actions use it; unavailable and failed callbacks reject without calling `location.assign`. Both incoming and live balance/list targets are validated before DOM replacement.

#### 2. Action feedback and recovery

**Files**: `src/components/expenses/ExpenseList.astro`, `src/components/expenses/DeclineExpenseDialog.astro`, `src/components/expenses/DeleteExpenseDialog.astro`, `src/components/expenses/CreateExpenseForm.astro`, `src/lib/expense-refresh-indicator.ts`

**Intent**: Keep successful actions in the current viewport while making the affected expense's update state clear and handling genuine refresh failures truthfully.

**Contract**: Approve, decline, delete, and edit mark their associated `[data-expense-id]` card busy with a visible refresh icon for the mutation-plus-refresh lifecycle. A successful mutation followed by a real refresh failure leaves the page unchanged, re-enables the action, and shows a local `role="alert"`; dialogs remain open until a refresh succeeds. Creation, settlement, and manual Refresh keep their own controls usable and present matching stale-view feedback. Mobile creation retains its explicit navigation.

#### 3. Runtime-aware regression coverage

**Files**: `src/lib/expense-workspace-refresh.test.ts`, `src/components/expenses/ExpenseWorkspace.astro`; add a focused colocated test only if needed

**Intent**: Prevent the browser parse failure from being hidden by helper-only tests.

**Contract**: Coverage proves successful delegation and non-navigation rejection, and verifies the workspace source is emitted through a processed client-script path rather than a TypeScript-bearing `define:vars` inline script. Build validation remains part of the phase because it produces the browser artifact that previously exposed the defect.

### Success Criteria:

#### Automated Verification:

- Focused workspace-refresh tests cover successful delegation, unavailable callbacks, and failed callbacks without fallback navigation.
- A focused regression guards the valid client-runtime boundary that registers the workspace callback.
- `npm test` and `npm run build` pass.
- Run `npm run verify`; if the known unrelated `packages/code-reviewer` lint errors remain, report them without changing that package.

#### Manual Verification:

- From a scrolled dashboard, approve, decline, delete, edit, and create an expense; confirm the URL and scroll position stay unchanged and the balance/list update on successful refresh.
- Confirm the affected existing expense card displays its refresh indicator while approve, decline, delete, or edit is processing.
- Induce a real fragment-refresh failure after a successful action; confirm no navigation, an accurate accessible stale-view message, and a usable action control. Confirm manual Refresh remains usable with its existing error.
- Confirm mobile expense creation still follows its deliberate return-to-dashboard path.

**Implementation Note**: After automated verification passes (or the known unrelated lint baseline is documented), pause for human confirmation of the browser checks before committing.

---

## Testing Strategy

### Unit Tests:

- Exercise the shared refresh primitive's successful delegation and rejection behavior with a spyable navigation method.
- Guard against a TypeScript-bearing raw inline workspace script, which would prevent callback registration before any fetch occurs.

### Integration Tests:

- No database test is needed: the change preserves existing JSON mutation and authorization contracts.

### Manual Testing Steps:

1. Scroll the dashboard below the expense list header and perform each eligible expense action.
2. Confirm the relevant card's indicator appears and a normal response replaces balance and list without document navigation.
3. Temporarily force a workspace-fragment refresh failure after a successful action; confirm scroll retention, stale-view alert, and re-enabled control.
4. Verify manual Refresh and mobile creation retain their independent behavior.

## Performance Considerations

The change adds only transient DOM state to an existing single-card action. It adds no requests, polling, persistence, or client-side cache.

## Migration Notes

No migration is required. Existing non-JavaScript form redirects remain the progressive-enhancement behavior.

## References

- Frame: `context/changes/expense-action-scroll-preservation/frame.md`
- Root-cause evidence: `src/components/expenses/ExpenseWorkspace.astro:104-130`
- Built invalid script evidence: `dist/server/chunks/ExpenseWorkspace_CZGAi1JT.mjs:139-165`
- Shared refresh helper: `src/lib/expense-workspace-refresh.ts:5-7`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Restore valid in-place workspace refresh

#### Automated

- [x] 1.1 Make the workspace client runtime valid and retain the rejecting refresh contract. — 2405ebd
- [x] 1.2 Add affected-item refresh indicators and no-navigation stale-view feedback. — 2405ebd
- [x] 1.3 Add runtime-aware refresh regression coverage. — 2405ebd
- [x] 1.4 Run focused checks, `npm test`, `npm run build`, and `npm run verify`. — 2405ebd

#### Manual

- [x] 1.5 Verify successful in-place actions, refresh indicators, and retained scroll position. — 2405ebd
- [x] 1.6 Verify real refresh-failure recovery and intentional mobile creation navigation. — 2405ebd
