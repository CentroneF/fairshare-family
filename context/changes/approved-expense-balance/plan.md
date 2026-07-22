# Approved Expense Balance Implementation Plan

## Overview

Deliver the first shared-money workflow in vertical slices: parents record pending expenses, the other parent approves them into an exact 50/50 monthly balance, and declined expenses retain one required reason. Each mutation is authorized in PostgreSQL through narrowly scoped RPCs; Astro routes and dashboard UI only invoke and display those contracts.

## Current State Analysis

The completed family-onboarding change supplies authenticated two-parent families, children, and a state-driven dashboard. The financial foundation already defines family-scoped expenses, exact PLN amounts, read-only RLS, and pure Decimal.js balance rules, but it deliberately has no expense mutation RPCs, Supabase repository adapter, API routes, or expense UI.

## Desired End State

An active parent can add an expense for any current or past date, with an optional child and an exact PLN amount. It appears pending in the selected month until the other parent approves or declines it. Approved expenses update approved totals and the directed balance immediately; declined expenses appear after active items with an immutable required reason and do not affect totals. The dashboard defaults to the current month and permits only current/past months.

### Key Discoveries:

- `expenses` already enforces family-scoped child, payer, reviewer, status, and exact-amount relationships, while direct writes remain denied by forced RLS: `supabase/migrations/20260717160000_financial_rules_foundation.sql:32`.
- Exact 50/50 calculation, pending totals, declined exclusion, and final-only whole-PLN half-up rounding already exist in `src/lib/financial-rules.ts:21`.
- `src/lib/financial-service.ts:11` defines a testable repository contract but lacks the request-scoped Supabase adapter required by the previous financial review.
- The current dashboard has distinct one-parent and two-parent family states, so the expense workspace must be available to any active family parent while approval controls remain unavailable until a second parent exists: `src/pages/dashboard.astro:43`.

## What We're NOT Doing

- Editing or deleting expenses; those belong to `unsettled-expense-corrections`.
- Settlement, historical-report browsing, recurring expenses, notifications, receipts, categories, money transfer, or generic comments/dispute threads.
- Future-dated expenses, multiple currencies, custom split ratios, client-side direct writes, service-role access, or mutation RLS policies.

## Implementation Approach

Build three vertical slices. Each phase owns the migration/RPC changes needed for that user-visible capability, a request-scoped server layer, dashboard integration, and focused database/UI verification. Keep the existing `financial-rules.ts` as the single calculation source; create a Supabase-backed adapter rather than duplicating amount or balance logic in a route or component.

## Critical Implementation Details

Amount normalization is application-side only: accept a comma or dot in form input, normalize to the existing positive two-decimal contract before calling an RPC, and continue storing PostgreSQL `numeric(12,2)`. A decline reason is a single immutable decision field, not a comments subsystem; only the decline RPC may write it and approval must leave it null.

## Phase 1: Record Pending Expenses

### Overview

Let an active family parent record a valid pending expense and see it in a selected current/past month, including while the creator is still waiting for the second parent.

### Changes Required:

#### 1. Pending-expense database command

**File**: `supabase/migrations/20260721120000_approved_expense_balance.sql`

**Intent**: Add the first expense mutation boundary without weakening the existing RLS model.

**Contract**: Define `public.create_expense(p_child_id uuid, p_description text, p_expense_date date, p_amount_pln numeric)` as a `security definer` function. It must derive the active caller membership/family from `auth.uid()`, reject unauthenticated callers, blank descriptions, nonpositive/non-two-decimal amounts, future dates, and a child outside the caller family. A null child ID represents “No specific child.” Insert a pending expense with the caller as payer and no review metadata, return its UUID, revoke public execution, and grant execution only to `authenticated`.

#### 2. Pending-expense authorization tests

**Files**: `supabase/tests/approved_expense_balance.test.sql`, `supabase/tests/financial_rules_foundation.test.sql`

**Intent**: Prove the new RPC creates only safe pending records while the direct-table boundary remains intact.

**Contract**: Add transactional two-parent and isolated-family fixtures. Verify valid creation, nullable child/N/A, current and past dates, exact amount persistence, pending metadata, family isolation, future-date/invalid-amount/blank-description rejection, and direct authenticated `expenses` writes still denied. Keep all fixtures local and rolled back.

#### 3. Expense server module and month loader

**Files**: `src/lib/expense-balance.ts`, `src/lib/expense-balance.test.ts`, `src/lib/financial-service.ts`

**Intent**: Centralize amount normalization, safe error mapping, current/past month validation, and request-scoped reads needed by the first vertical slice.

**Contract**: Export a Supabase-backed repository factory using the existing request-scoped client, preserving `FinancialRepository` for pure balance tests. Return typed display rows containing expense ID, description, date, decimal string, status, payer membership ID, child name/null, and review metadata. Normalize a single comma decimal separator to a dot before `parsePlnAmount`; reject future dates/months and malformed form data with safe user-facing messages. Query expenses by a half-open selected-month range and order active statuses newest-first; no family/user ID is accepted from form data.

#### 4. Create-expense route and pending workspace

**Files**: `src/pages/api/expenses/create.ts`, `src/components/expenses/CreateExpenseForm.tsx`, `src/components/expenses/ExpenseList.astro`, `src/pages/dashboard.astro`

**Intent**: Make the pending-expense contract usable in the existing family dashboard.

**Contract**: Follow the established request-scoped POST/redirect pattern. Render the workspace for both creator-awaiting-parent and two-parent families, with a native month picker defaulting to the current month and capped at it. Provide an inline form for description, optional child selector whose default is “No specific child,” amount, and date. On success redirect to the selected month and show accessible feedback. Render pending expenses in newest-first order and label the creator’s pre-join items as awaiting review; do not render approval controls in this phase.

### Success Criteria:

#### Automated Verification:

- `zsh -lic 'nvm use default >/dev/null && npx supabase test db'` passes pending-expense RPC and direct-write-denial coverage.
- `zsh -lic 'nvm use default >/dev/null && npm test'` passes amount/month/server-mapping tests.
- `zsh -lic 'nvm use default >/dev/null && npm run lint'` and `zsh -lic 'nvm use default >/dev/null && npm run build'` pass.

#### Manual Verification:

- As a one-parent family creator, add N/A and child-linked expenses with dot and comma decimal input; confirm both remain pending in the selected month.
- Confirm past-month navigation and past-date entry work, while a future month/date is rejected.

**Implementation Note**: Pause for manual confirmation before Phase 2. The UI must not imply that a one-parent family has an approved balance.

---

## Phase 2: Approve Expenses Into the Balance

### Overview

Let the non-payer approve a pending expense and immediately see the existing exact monthly balance update.

### Changes Required:

#### 1. Approval database command and concurrency tests

**Files**: `supabase/migrations/20260721120000_approved_expense_balance.sql`, `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Authorize the other active parent to make one final approval decision on a pending expense.

**Contract**: Define `public.approve_expense(p_expense_id uuid)` as a `security definer` RPC. Resolve caller and expense memberships from database state, require exactly two active parents, reject non-members, the payer, missing/cross-family expenses, and any non-pending expense. Atomically set `status = 'approved'`, `reviewed_by`, and `reviewed_at`; return the expense ID. Tests must prove only the other parent can approve and that two competing/repeated decisions cannot overwrite an already-resolved expense.

#### 2. Balance state and approval server flow

**Files**: `src/lib/expense-balance.ts`, `src/lib/financial-service.ts`, `src/lib/expense-balance.test.ts`, `src/pages/api/expenses/approve.ts`

**Intent**: Load the selected month through the request-scoped adapter and derive the balance without JavaScript number coercion.

**Contract**: Extend the dashboard state with active parent membership IDs and the current user’s membership ID. Feed selected-month rows into `loadMonthlyBalance`; expose approved, to-review, and total amounts plus the directed/rounded settlement result. The approval route accepts only an expense ID, calls the server module, and redirects back to the validated selected month with safe feedback. Use the established calculation module; do not reimplement split or rounding logic.

#### 3. Approval and balance dashboard slice

**Files**: `src/components/expenses/ExpenseList.astro`, `src/components/expenses/MonthlyBalancePanel.astro`, `src/pages/dashboard.astro`

**Intent**: Turn a pending shared record into an approved, financially meaningful view.

**Contract**: In two-parent state, show an Approve action only on a pending expense paid by the other membership. Show selected-month total, approved, and to-review amounts separately; show a directed “you owe/are owed” message only from the existing settlement result and show a balanced state when its rounded amount is zero. One-parent state continues to show pending expenses but no balance/approval controls.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` proves approval authorization, self-review denial, resolved-state immutability, and family isolation.
- `npm test` covers selected-month mapping, exact approved/pending totals, directed balances, and final half-up rounding through the server state mapper.
- `npm run lint` and `npm run build` pass.

#### Manual Verification:

- With two parents, create expenses from each account and approve only the other parent’s pending item; verify the approved amount and who owes whom update immediately.
- Verify a parent cannot approve their own item, and a repeat approval shows safe feedback without changing the expense.

**Implementation Note**: Pause for manual confirmation before Phase 3. Approval must be final for this slice; edits/re-review remain out of scope.

---

## Phase 3: Decline Reasons and Completed Month Experience

### Overview

Complete the review workflow with a required immutable decline reason, declined-item presentation, and end-to-end selected-month verification.

### Changes Required:

#### 1. Decline-reason schema and decision command

**Files**: `supabase/migrations/20260721120000_approved_expense_balance.sql`, `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Retain a concise, auditable reason when the other parent declines an expense without creating a generic comments feature.

**Contract**: Add nullable `expenses.decline_reason text` with constraints: approved and pending rows keep it null; declined rows require a trimmed, nonblank reason of at most 500 characters. Define `public.decline_expense(p_expense_id uuid, p_reason text)` with the same active-other-parent/pending/family authorization as approval, then atomically write declined status, reviewer metadata, and normalized reason. The RPC must reject missing/oversized reason, self-review, repeat decisions, and cross-family attempts. It must not expose the reason to non-members under RLS.

#### 2. Decline server flow and safe messages

**Files**: `src/lib/expense-balance.ts`, `src/lib/expense-balance.test.ts`, `src/pages/api/expenses/decline.ts`

**Intent**: Keep decline validation and error translation consistent with the create/approve actions.

**Contract**: Validate/trim the reason before the RPC and map known command failures to non-disclosing feedback. The route accepts only expense ID and reason, preserves the selected month in its redirect, and never trusts a family, payer, reviewer, amount, or status from the client.

#### 3. Decline dialog and final month presentation

**Files**: `src/components/expenses/DeclineExpenseDialog.tsx`, `src/components/expenses/ExpenseList.astro`, `src/pages/dashboard.astro`

**Intent**: Make decline a deliberate review action and keep rejected records visible but financially excluded.

**Contract**: A pending other-parent expense exposes a Decline action that opens an accessible dialog with a required reason field, focus containment, Escape/cancel behavior, and focus return. Render all approved/pending items newest-first, then a visually distinct declined section containing the reason and reviewer context. Declined items must not contribute to any displayed total/balance. Keep the existing month picker’s current-month maximum and selected-month state through create, approve, and decline redirects.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` proves required/immutable decline reasons, other-parent-only decline, RLS isolation, and continued denial of direct expense mutations.
- `npm test` covers comma normalization, decline-reason validation, approved/pending/declined balance mapping, and selected-month validation.
- `npm run lint` and `npm run build` pass.

#### Manual Verification:

- Decline an other-parent pending expense with a reason; confirm it moves to the declined section, retains the reason, and does not affect totals.
- Confirm the decline dialog keeps keyboard focus, returns focus after cancel, and cannot decline the current user’s or an already-resolved expense.
- Check the complete flow on a narrow Android-sized viewport: create, approve, decline, switch month, and verify safe errors for invalid requests.

**Implementation Note**: Pause for final manual confirmation before treating this change as complete.

---

## Testing Strategy

### Unit Tests:

- Comma/dot normalization, positive two-decimal PLN validation, current/past month validation, and decline-reason bounds.
- Mapping Supabase rows without numeric coercion into existing Decimal.js balance rules.
- Approved/pending/declined totals, directed settlement wording input, and no balance with fewer than two active parents.

### Integration Tests:

- RPC creation for valid child/N/A expenses, invalid amount/date/child rejection, and direct-write denial.
- Other-parent-only approval/decline, self-review and repeated-decision rejection, required decline reason, and cross-family isolation.
- Current/past selected-month range behavior and exact persisted decimal strings.

### Manual Testing Steps:

1. As the first parent, create child-linked and N/A expenses with `12.50` and `12,50`; verify both remain pending until the second parent joins.
2. As the second parent, approve an expense and verify the monthly approved/to-review totals and directed balance.
3. Decline another pending expense with a required reason; verify its placement, reason, and financial exclusion.
4. Navigate a past month and a narrow viewport; confirm future month/date attempts and unauthorized/repeated decisions fail safely.

## Performance Considerations

Monthly totals remain derived on demand from the existing `(family_id, expense_date, status)` index. The UI loads one selected month, two memberships, and the family’s small child list; pagination and cached aggregates remain out of scope.

## Migration Notes

Use one forward-only migration. It is additive: introduce commands and the nullable decline-reason column before adding the state-dependent constraint and grant only authenticated execution on each RPC. Do not edit the applied financial-foundation or family-onboarding migrations, and never run `supabase db reset` against hosted data.

## References

- Product contract: `context/foundation/prd.md:49`
- Roadmap slice: `context/foundation/roadmap.md:89`
- Expense schema/RLS boundary: `supabase/migrations/20260717160000_financial_rules_foundation.sql:32`
- Exact balance rules: `src/lib/financial-rules.ts:21`
- Existing repository seam: `src/lib/financial-service.ts:11`
- Existing request-scoped API pattern: `src/pages/api/family/create.ts:5`
- Existing dashboard state composition: `src/pages/dashboard.astro:43`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Record Pending Expenses

#### Automated

- [ ] 1.1 Pending-expense migration and pgTAP authorization tests pass.
- [x] 1.2 Expense server module and focused unit tests pass.
- [x] 1.3 Pending-expense dashboard builds and lints successfully.

#### Manual

- [x] 1.4 Create pending child-linked/N/A current and past expenses, including comma input.

### Phase 2: Approve Expenses Into the Balance

#### Automated

- [ ] 2.1 Approval RPC authorization and resolved-state tests pass.
- [ ] 2.2 Request-scoped balance loader and exact calculation tests pass.
- [ ] 2.3 Approval and balance dashboard builds and lints successfully.

#### Manual

- [ ] 2.4 The other parent approves an expense and the balance updates correctly.

### Phase 3: Decline Reasons and Completed Month Experience

#### Automated

- [ ] 3.1 Decline-reason migration/RPC/RLS tests pass.
- [ ] 3.2 Decline server validation and balance-mapping tests pass.
- [ ] 3.3 Full dashboard lint and production build pass.

#### Manual

- [ ] 3.4 Declined expenses retain required reasons and remain financially excluded.
- [ ] 3.5 The complete create/approve/decline/month flow works on desktop and narrow viewport.
