# Unsettled Expense Corrections Implementation Plan

## Overview

Let a parent safely correct an expense they paid, re-submit it for review, or remove an eligible unresolved expense. The feature preserves the existing PostgreSQL command boundary, exact PLN rules, selected-month balance behavior, and background-refresh interaction model.

## Current State Analysis

The completed approved-expense-balance slice supports pending creation, other-parent approval, and required-reason decline. Expenses are read-only through forced RLS; all writes occur through `SECURITY DEFINER` RPCs. The current dashboard can refresh only the balance/list fragments in the background, but it has no own-expense correction actions or settled-month state.

## Desired End State

The original payer can edit a pending, approved, or declined expense while both its source and destination months are unsettled. Every edit resets the expense to pending so the other parent must review it again. If a declined expense is edited, its most recent decline reason is retained as prior context and pre-fills a later decline dialog. The payer can delete only their pending or declined expenses. Settled months show no correction actions, and all successful mutations refresh the destination month without a full-page reload.

### Key Discoveries:

- `expenses` requires pending rows to have no reviewer metadata, while resolved rows require an other-parent reviewer: `supabase/migrations/20260717160000_financial_rules_foundation.sql:32`.
- The existing decline constraint requires the active `decline_reason` to be null outside the declined state: `supabase/migrations/20260722120000_decline_expense.sql:3`.
- `monthly_settlements` already models `open` versus `settled` by family and first-of-month date, but has no command/UI yet: `supabase/migrations/20260717160000_financial_rules_foundation.sql:65`.
- Expense UI mutations use JSON fetch, local errors, and `refreshExpenseWorkspace()` rather than a full navigation: `src/components/expenses/ExpenseWorkspace.astro:71`.

## What We're NOT Doing

- A general expense revision/audit-history system; only the latest prior decline reason is retained.
- Editing the original payer/family, direct client-side table writes, or mutation RLS policies.
- Deleting approved expenses, restoring deleted expenses, or changing settlement itself.
- Expense comments, notifications, receipts, categories, custom split ratios, or report-history UI.

## Implementation Approach

Add one forward-only migration with a retained prior-decline-reason field and two narrowly authorized command RPCs. The server module and routes normalize only editable input, while database commands derive family, payer, status, and settlement eligibility from locked database rows. Extend the workspace state with the selected month's settled flag, then use native edit/delete dialogs and the existing fragment refresh helper to keep the balance and list in sync.

## Critical Implementation Details

Correction commands must lock the family row before checking settlement status and lock the target expense before changing it. The future settlement command must follow the same family-lock protocol, so a correction cannot race a newly settled month. A cross-month edit must check both the original and new report months before writing.

## Phase 1: Edit an Expense Back Into Review

### Overview

Deliver the end-to-end edit flow for an own unsettled expense, including re-review behavior and retained prior decline context.

### Changes Required:

#### 1. Correction schema and edit command

**Files**: `supabase/migrations/20260722130000_unsettled_expense_corrections.sql`, `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Permit only the original payer to correct an expense without weakening direct-write protections or allowing a settled month to change.

**Contract**: Add nullable `previous_decline_reason text`, constrained to either null or trimmed/nonblank/max-500 characters. Adjust the existing decline-reason state constraint so the active `decline_reason` remains null for pending/approved rows while `previous_decline_reason` may survive a re-opened expense. Define `public.update_expense(p_expense_id uuid, p_child_id uuid, p_description text, p_expense_date date, p_amount_pln numeric) returns uuid`.

The command must authenticate and derive the active caller membership/family, lock the caller family and target expense, require the caller to be the payer, validate the same child/description/date/amount rules as creation, and reject either source or destination month when its settlement is `settled`. It may edit pending, approved, or declined records; it must atomically set the editable fields, reset `status` to `pending`, clear `reviewed_by`, `reviewed_at`, and active `decline_reason`, and copy a declined row's active reason to `previous_decline_reason`. Revoke public execution and grant only `authenticated`.

Extend the transactional pgTAP suite for own-payer edit permission; other-parent/non-member denial; input and child validation; pending/approved/declined reset behavior; retained prior reason; source/destination settled-month denial; and preserved direct-update denial.

#### 2. Correction state and edit route

**Files**: `src/lib/expense-balance.ts`, `src/lib/expense-balance.test.ts`, `src/pages/api/expenses/edit.ts`

**Intent**: Expose the immutable display context and provide a thin authenticated HTTP boundary for the edit command.

**Contract**: Extend `ExpenseDisplay` and month query data with `childId` and `previousDeclineReason`; extend workspace state with `isMonthSettled`, where no matching settlement or an `open` row means unsettled. Reuse the existing amount/date/UUID/error normalization, add an `updateExpense` wrapper, and map settled/month and ownership failures to safe feedback.

The edit route accepts only expense ID, editable field values, and selected month. Its JSON response returns the destination `month`; the non-JavaScript fallback redirects there. It must not accept payer, family, status, reviewer, settlement status, or decline-state values from the client.

#### 3. Edit dialog and background re-review UI

**Files**: `src/components/expenses/EditExpenseDialog.astro`, `src/components/expenses/ExpenseList.astro`, `src/components/expenses/ExpenseWorkspace.astro`, `src/components/expenses/DeclineExpenseDialog.astro`

**Intent**: Let the payer correct any own expense while showing the resulting re-review state accurately.

**Contract**: Extend `ExpenseList` to receive the existing `children` collection from `ExpenseWorkspace`, then pass it and each expense's `childId` to the edit dialog so the child/N/A selector can render and pre-select the current value. Render Edit only for the current membership's expense when the selected month is not settled, including approved and declined entries. The native dialog pre-populates description, child/N/A, amount, and date; it supports keyboard focus, Escape/cancel, focus return, inline safe errors, and submits with JSON enhancement plus redirect fallback. On success, close the dialog before updating the browser month with `history.replaceState` and calling `refreshExpenseWorkspace(destinationMonth)`.

Pass a pending expense's `previousDeclineReason` into the existing decline dialog and pre-fill its reason textarea when that expense is declined again. The active decline reason remains shown only for currently declined entries. Edit and Delete must use the existing document-delegated open/cancel/submit-handler pattern, because `refreshExpenseWorkspace()` replaces the list fragment; do not attach element-local listeners that disappear after refresh. No edit/delete actions are rendered when `isMonthSettled` is true.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` proves edit authorization, input validation, re-review reset, retained prior reason, both-month settlement denial, and direct-write denial.
- `npm test` covers correction input/error mapping and balance behavior after an approved expense is returned to pending.
- `npm run lint` and `npm run build` pass.

#### Manual Verification:

- As the payer, edit pending, approved, and declined expenses; confirm all become pending and an approved amount moves into To review.
- Edit a declined expense, then decline it again; confirm the prior reason pre-fills and the new decline result is displayed.
- Edit an expense into an earlier month and confirm the view switches there without a full-page reload.

**Implementation Note**: Pause for manual confirmation before Phase 2. An edited expense must be re-reviewed; the UI must never imply that its prior approval remains effective.

---

## Phase 2: Delete an Eligible Own Expense

### Overview

Deliver the end-to-end deletion flow for own pending or declined expenses, with the same settled-month and background-refresh guarantees.

### Changes Required:

#### 1. Delete command and authorization tests

**Files**: `supabase/migrations/20260722130000_unsettled_expense_corrections.sql`, `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Let a payer remove only unresolved expenses they own while preserving approved records and settlement locks.

**Contract**: Define `public.delete_expense(p_expense_id uuid) returns uuid`. It must authenticate, derive and lock the active caller family/membership, lock the expense, require the caller to be its payer, reject cross-family/missing/settled-month records, and delete only `pending` or `declined` rows. An approved row must be rejected. The command returns the removed ID, revokes public execution, and grants only `authenticated`.

Extend pgTAP coverage for own pending/declined deletion, approved/non-owner/cross-family/settled denial, review-versus-delete serialization outcome, and direct authenticated delete denial.

#### 2. Delete server route and confirmation dialog

**Files**: `src/lib/expense-balance.ts`, `src/lib/expense-balance.test.ts`, `src/pages/api/expenses/delete.ts`, `src/components/expenses/DeleteExpenseDialog.astro`, `src/components/expenses/ExpenseList.astro`

**Intent**: Make deletion deliberate, safely authorized, and immediately reflected in financial state.

**Contract**: Add a `deleteExpense` wrapper and safe error mapping. The route accepts only expense ID and selected month, returns JSON destination month for enhanced clients, and preserves a redirect fallback.

Render Delete only beside the payer's pending/declined expense when the selected month is unsettled; never show it for approved or settled entries. The native confirmation dialog uses explicit Cancel/Delete controls, Escape/cancel/focus return, disabled submit state, and inline errors. Use the same document-delegated open/cancel/submit-handler pattern as the existing decline dialog so replacement of the expense-list fragment does not remove its behavior. On success it closes and calls `refreshExpenseWorkspace(month)` so the list, empty state, and balance update without a page reload.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` proves deletion eligibility, owner/family/settlement authorization, approved-record preservation, and direct-delete denial.
- `npm test`, `npm run lint`, and `npm run build` pass.

#### Manual Verification:

- Delete own pending and declined expenses; confirm each disappears and the monthly totals/balance refresh immediately.
- Confirm Delete is absent for approved, other-parent, and settled-month expenses.
- Confirm Cancel/Escape leave an expense unchanged and return keyboard focus to its Delete control.

**Implementation Note**: Pause for manual confirmation before Phase 3. Deletion must remain unavailable for approved records even if their month is otherwise unsettled.

---

## Phase 3: Verify the Complete Correction Workflow

### Overview

Prove the correction contracts and user experience across the complete pending/approved/declined lifecycle.

### Changes Required:

#### 1. Focused lifecycle regression coverage

**Files**: `supabase/tests/approved_expense_balance.test.sql`, `src/lib/expense-balance.test.ts`

**Intent**: Keep future settlement work safe by making correction behavior explicit at the existing database and exact-balance seams.

**Contract**: Consolidate transactional scenarios for create → approve → edit → re-approve, create → decline → edit → re-decline with prefilled prior reason, and pending/declined delete. Assert exact approved/to-review/total effects at each state and validate no direct mutation path was introduced. Do not add an audit-history abstraction or settlement command.

#### 2. Narrow responsive workflow check

**Files**: `src/components/expenses/EditExpenseDialog.astro`, `src/components/expenses/DeleteExpenseDialog.astro`, `src/components/expenses/ExpenseList.astro`

**Intent**: Verify correction controls remain usable and unambiguous on the target mobile-sized dashboard.

**Contract**: Ensure both dialogs fit a narrow Android-sized viewport, preserve focus behavior, and retain the existing background-refresh convention after list replacement. Keep settled-month action hiding and the selected-month URL state intact.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` and `npm test` pass with correction lifecycle coverage.
- `npm run lint` and `npm run build` pass.

#### Manual Verification:

- On desktop and a narrow viewport, create, approve, edit, re-approve, decline, edit, re-decline, delete, and switch months without a full-page refresh.
- Verify safe feedback for stale/resolved/cross-family attempts and no visible correction actions in a settled month.

**Implementation Note**: Pause for final manual confirmation before treating this change as complete.

## Testing Strategy

### Unit Tests:

- Amount/date/month and UUID normalization reused by edits and deletes.
- Safe mapping for ownership, approved-delete, and settled-month errors.
- Exact balance transitions when approved becomes pending and when pending/declined rows are removed.

### Integration Tests:

- Payer-only edit and pending/declined-only delete through RPCs.
- Cross-family, non-owner, approved-delete, and source/destination settled-month rejection.
- Declined edit retains the most recent prior reason, clears active review fields, and permits later re-decline.
- Forced RLS continues to deny authenticated direct UPDATE and DELETE.

### Manual Testing Steps:

1. Edit an own approved expense and confirm it becomes pending, moves from Approved to To review, and is reviewable by the other parent.
2. Edit a declined expense and confirm its reason is retained as prior context and pre-fills the next decline dialog.
3. Move an own expense to a past unsettled month and confirm the dashboard switches month without a page refresh.
4. Delete own pending and declined expenses; confirm approved/other-parent/settled records expose no deletion action.
5. Verify dialogs and background refresh on a narrow Android-sized viewport.

## Performance Considerations

The existing one-month query remains bounded. Correction commands use targeted family, settlement, and expense locks; no pagination, audit log, or bulk operation is introduced.

## Migration Notes

Use one forward-only additive migration. Update the decline-reason constraint only after adding `previous_decline_reason`; do not edit applied migrations or add direct UPDATE/DELETE RLS policies. Absence of a settlement row and an `open` settlement both mean unsettled; only a `settled` row locks correction commands.

## References

- Product requirements: `context/foundation/prd.md:81`
- Roadmap slice: `context/foundation/roadmap.md:100`
- Expense and settlement schema/RLS: `supabase/migrations/20260717160000_financial_rules_foundation.sql:32`
- Existing create/approval/decline commands: `supabase/migrations/20260721120000_approved_expense_balance.sql:1`
- Existing background workspace refresh: `src/components/expenses/ExpenseWorkspace.astro:71`
- Existing database test harness: `supabase/tests/approved_expense_balance.test.sql:1`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Edit an Expense Back Into Review

#### Automated

- [ ] 1.1 Edit migration/RPC authorization, settlement-lock, and direct-write-denial tests pass.
- [ ] 1.2 Edit server state, route, and exact-balance tests pass.
- [ ] 1.3 Edit dialog/dashboard lint and production build pass.

#### Manual

- [ ] 1.4 Edit own pending, approved, and declined expenses; each re-opens as pending and an approved amount moves into To review.
- [ ] 1.5 Re-decline an edited expense; its prior decline reason pre-fills and the new decline result is displayed.
- [ ] 1.6 Edit an expense into an earlier month; the view switches there without a full-page reload.

### Phase 2: Delete an Eligible Own Expense

#### Automated

- [ ] 2.1 Delete RPC eligibility, authorization, settlement-lock, and direct-delete-denial tests pass.
- [ ] 2.2 Delete route/dialog/dashboard lint and production build pass.

#### Manual

- [ ] 2.3 Delete own pending and declined expenses; each disappears and the monthly totals/balance refresh immediately.
- [ ] 2.4 Confirm Delete is absent for approved, other-parent, and settled-month expenses.
- [ ] 2.5 Confirm Cancel/Escape leave an expense unchanged and return keyboard focus to its Delete control.

### Phase 3: Verify the Complete Correction Workflow

#### Automated

- [ ] 3.1 Full correction lifecycle pgTAP and exact-balance unit coverage pass.
- [ ] 3.2 Complete correction dashboard lint and production build pass.

#### Manual

- [ ] 3.3 On desktop and a narrow viewport, complete the correction lifecycle and switch months without a full-page refresh.
- [ ] 3.4 Verify safe feedback for stale/resolved/cross-family attempts and no visible correction actions in a settled month.
