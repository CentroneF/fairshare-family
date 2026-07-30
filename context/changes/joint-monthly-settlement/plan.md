# Joint Monthly Settlement Implementation Plan

## Overview

Let both active parents jointly settle an eligible past report, record the final financial outcome, and lock the report against every expense mutation. A first confirmation immediately freezes the report; a second distinct confirmation makes the settlement final.

## Current State Analysis

`monthly_settlements` already represents an open or settled report with two distinct confirmer fields, but no command can create or update it. The dashboard exposes only a settled boolean, while the report history shows a binary Settled/Unsettled label. Expense edits and deletes already take a family-row lock before checking settlement, but create, approve, and decline do not; they could otherwise race with settlement.

## Desired End State

For an eligible past month, a parent sees the calculated transfer (or No payment needed) and can confirm through a short dialog. Their first confirmation visibly freezes that month. The other active parent can then confirm the unchanged report, creating a permanent settled record with an exact financial snapshot. The dashboard, expense controls, and report history update in the background without a page reload.

### Key Discoveries:

- The existing settlement table already enforces two distinct confirmations before `status = 'settled'`: `supabase/migrations/20260717160000_financial_rules_foundation.sql:65`.
- Eligibility is already defined as exactly two parents, a past month, at least one expense, and all expenses approved: `src/lib/financial-rules.ts:101`.
- Existing correction commands establish the required family-first lock ordering: `supabase/migrations/20260729120000_unsettled_expense_corrections.sql:69`.
- Dashboard mutations use JSON POST plus fragment replacement, preserving scroll position: `src/components/expenses/ExpenseWorkspace.astro:76`.
- History is currently outside the refreshed fragments, so settlement must extend that refresh contract to avoid a stale status badge: `src/components/expenses/ExpenseWorkspace.astro:72`.

## What We're NOT Doing

- Notifications, reminders, or email delivery when one parent has confirmed.
- Withdrawal or cancellation of a first confirmation; it remains until the other parent settles the report.
- Settlement reversal, reopening a settled report, dispute workflows, or expense audit history.
- In-app money transfers, payment-provider integration, custom splits, or recurring expenses.
- A third history status: history remains explicitly Settled or Unsettled.

## Implementation Approach

Use one forward-only migration to add a settlement-only financial snapshot, replace each expense mutation RPC with a consistent family-lock contract, and add one `SECURITY DEFINER` settlement confirmation RPC. The RPC, rather than TypeScript or client input, derives active memberships, report eligibility, contributions, and the final payment from locked database rows.

Extend the server-side workspace state with typed settlement progress and server-derived eligibility. Put the action beside the existing selected-month balance. A JSON-enhanced route follows the established mutation pattern and refreshes the balance, expense list, and history fragments together; standard form redirect remains the fallback.

## Critical Implementation Details

Every expense mutation and confirmation command must lock the same `families` row before inspecting an expense or settlement. The confirmation command must then derive eligibility again under that lock. This serializes the first-confirmation freeze, all report mutations, and final settlement without trusting stale dashboard state. Because first confirmation is intentionally irreversible, a failed or ineligible report must never create an open settlement row.

## Phase 1: Confirm and Lock an Eligible Report

### Overview

Deliver the complete happy path: each parent can confirm an all-approved past report, the second confirmation settles it with a final exact snapshot, and the resulting lock is enforced across every expense mutation.

### Changes Required:

#### 1. Settlement snapshot and authoritative command boundary

**Files**: `supabase/migrations/<next-timestamp>_joint_monthly_settlement.sql`, `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Make joint settlement atomic, exact, and race-safe while preserving forced-RLS direct-write denial.

**Contract**: Add nullable settlement-only snapshot fields for exact approved total, each confirmed parent’s exact approved contribution, and final payment outcome (payer/payee plus whole-PLN amount, or an explicit balanced result). A settled record must require a complete valid snapshot; an open record must have no snapshot. Define `public.confirm_monthly_settlement(p_report_month date)` returning the resulting settlement state.

The command authenticates and derives the caller’s active membership/family, locks the family row, validates a first-of-month past report with exactly two active parents, at least one expense, and only approved expenses, then derives exact contributions and the rounded transfer in SQL. It records the caller as first confirmer only if no row exists; a distinct second parent changes the row to `settled`, writes both confirmation timestamps, `settled_at`, and the snapshot. Reconfirmation by the same parent and calls after settlement fail safely. Do not create an open row for an ineligible report.

Replace `create_expense`, `approve_expense`, and `decline_expense` in this forward migration so they lock the caller family before the target expense where applicable, and reject a report month with any open first confirmation or a settled settlement. Preserve the existing family-first contract in update/delete and extend their rejection to an open confirmed month. Revoke public function execution and grant only `authenticated`.

Extend pgTAP for first and second confirmation, exact snapshot values including zero-payment settlement, duplicate/outsider/same-parent denial, non-first-day/current/future/empty/pending/declined denial, and direct settlement INSERT/UPDATE/DELETE denial. Prove create, approve, decline, update, and delete all fail once the first confirmation exists and after final settlement.

#### 2. Server settlement state and confirmation route

**Files**: `src/lib/expense-balance.ts`, `src/lib/expense-balance.test.ts`, `src/lib/financial-rules.test.ts`, `src/pages/api/settlements/confirm.ts`

**Intent**: Give the dashboard a safe, typed description of eligibility, confirmation progress, and final snapshot without client-supplied financial authority.

**Contract**: Replace the workspace’s boolean-only settlement read with a typed state that distinguishes unavailable, eligible, first-confirmed-by-current-parent, first-confirmed-by-other-parent, and settled. Include only server-derived confirmation progress, lock state, eligibility reason category, and settled snapshot display data. Keep the pure financial eligibility rule aligned with the SQL contract, including an eligible balanced result.

Add a thin authenticated endpoint that accepts only the selected month, calls the RPC, returns JSON state for enhanced clients, and redirects to the selected dashboard month for normal form submission. Normalize month input and map stale/ineligible/already-confirmed/locked errors to safe user messages; never accept family IDs, parent IDs, amounts, confirmation fields, or snapshot data from the client.

#### 3. Inline confirmation card, dialog, and background refresh

**Files**: `src/components/expenses/MonthlyBalancePanel.astro`, `src/components/expenses/SettlementConfirmationDialog.astro`, `src/components/expenses/CreateExpenseForm.astro`, `src/components/expenses/ExpenseList.astro`, `src/components/expenses/ExpenseWorkspace.astro`

**Intent**: Let each parent understand and confirm the exact report outcome, then immediately see the frozen or settled state without losing scroll position.

**Contract**: Extend the selected-month balance panel with a settlement card for past reports. An eligible report shows the exact payment direction and rounded PLN amount, or `No payment needed`, and an inline Confirm settlement action. Its native dialog repeats that outcome and warns that first confirmation immediately prevents expense changes; it supports Escape/cancel, focus return, disabled submit state, inline safe errors, JSON submission, and normal POST fallback.

After success, close the dialog and call the workspace refresh helper rather than navigating. While first-confirmed, show who still needs to confirm and a clear locked message; hide or disable the create form and all expense mutation/review controls. After settlement, show the stored snapshot and permanent lock state. Add a history container ID and refresh it with the balance/list fragments so its binary status badge changes immediately.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` proves atomic two-parent confirmation, exact snapshot storage, first-confirmation and settled locks across every expense mutation, authorization, and direct-write denial.
- `npm test`, `npm run lint`, and `npm run build` pass with typed settlement-state and error-mapping coverage.

#### Manual Verification:

- With an all-approved past month, confirm as parent A and verify the report immediately becomes locked and shows that parent B is required.
- As parent B, confirm the unchanged report and verify the stored final payment/no-payment summary, settled history badge, and no full-page refresh.
- Attempt to create, approve, decline, edit, and delete in a first-confirmed or settled report; confirm the dashboard offers no action and the server rejects stale attempts.

**Implementation Note**: Pause for human confirmation before Phase 2. The first confirmation must be an end-to-end, manually visible lock—not merely a disabled UI control.

---

## Phase 2: Explain Eligibility and Preserve the Locked Report Experience

### Overview

Complete the user-visible state model for every selected past month: explain why a report cannot settle, make the freeze state unambiguous, and keep settled history and selected-report details coherent across navigation and refresh.

### Changes Required:

#### 1. Eligibility guidance and touch-friendly disabled action

**Files**: `src/lib/expense-balance.ts`, `src/lib/expense-balance.test.ts`, `src/components/expenses/MonthlyBalancePanel.astro`, `src/components/expenses/ExpenseWorkspace.astro`

**Intent**: Make settlement discoverable even when unavailable, while explaining the shortest correct path to eligibility.

**Contract**: Map server state into concise non-sensitive reasons for current month, missing second parent, no expenses, pending expenses, or declined expenses. Render a disabled settlement button whenever the report is not eligible, accompanied by visible text as well as a tooltip/title so the explanation works on touch devices. Keep expense correction/review actions available only when there is no first-confirmation or settled lock; do not imply that a disabled settlement button itself prevents changes.

#### 2. Settled snapshot presentation and history regression coverage

**Files**: `src/components/expenses/MonthlyBalancePanel.astro`, `src/components/expenses/MonthlyReportHistory.astro`, `src/components/expenses/ExpenseWorkspace.astro`, `src/lib/expense-balance.test.ts`

**Intent**: Make completed reports understandable without expanding report history beyond its agreed binary status.

**Contract**: Render the stored settlement snapshot in the selected settled report: exact approved total, each parent contribution, both confirmation progress, final payment direction and rounded amount, or no-payment result. Keep history rows limited to Settled/Unsettled and existing approved-total content. Ensure a refreshed history fragment preserves the native disclosure’s expected server-rendered fallback and that normal month links continue to navigate the canonical detailed report.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, and `npm run build` pass with eligible, ineligible, first-confirmed, balanced, payment, and settled snapshot state coverage.
- `npx supabase test db` passes after adding regression assertions that locked rows remain readable only to their family and report history stays binary.

#### Manual Verification:

- View current, pending, declined, empty, and one-parent reports; confirm each has a disabled settlement action with understandable visible and tooltip guidance.
- On desktop and a narrow Android-sized viewport, confirm the first-confirmation and settled snapshot states are readable and controls cannot be mistaken for available mutations.
- Settle a past report and verify its selected report and expanded history status update in the background without resetting the page scroll position.

**Implementation Note**: Pause for final human confirmation before Phase 3. The disabled control must explain ineligibility without becoming the only accessibility channel for that explanation.

---

## Phase 3: Prove the Complete Two-Parent Settlement Boundary

### Overview

Consolidate the full two-parent workflow into durable database and dashboard regression coverage, including stale attempts and the irreversible first-confirmation decision.

### Changes Required:

#### 1. Settlement lifecycle and concurrency-oriented database coverage

**Files**: `supabase/tests/approved_expense_balance.test.sql`, `supabase/tests/financial_rules_foundation.test.sql`

**Intent**: Protect the financial trust boundary against future changes to settlement or expense commands.

**Contract**: Cover create → approve → first confirmation → rejected mutation attempts → second confirmation; the balanced-result variant; declined/edit/re-approve before confirmation; family isolation; first/second confirmation identity rules; and read-only direct table access. Express serialization expectations through the shared family lock contract rather than timing-dependent test sleeps. Do not add direct mutation policies.

#### 2. Complete dashboard workflow regression checks

**Files**: `src/lib/financial-rules.test.ts`, `src/lib/expense-balance.test.ts`, settlement-related Astro components

**Intent**: Keep the visible settlement explanation, exact financial display, and background-refresh behavior aligned with the authoritative database contract.

**Contract**: Exercise state mapping for stale results, confirmation errors, zero-payment and payment snapshots, current/past date boundaries, and first-confirmation locks. Preserve normal form redirect fallbacks alongside the enhanced JSON path; do not introduce a browser E2E framework.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` passes with complete two-parent lifecycle, mutation-lock, RLS, and snapshot assertions.
- `npm test`, `npm run lint`, and `npm run build` pass with settlement state and exact amount regressions.

#### Manual Verification:

- Using two active parents, complete a payment settlement and a balanced settlement; verify only the second distinct confirmation finalizes each month.
- Verify an accidental/stale confirmation or any mutation attempt after first confirmation receives safe feedback and does not change the report.
- Verify the complete flow on desktop and narrow viewport, including background refresh, retained scroll position, selected-month navigation, and binary history badge.

**Implementation Note**: Treat this change as complete only after both-parent manual confirmation and the full database suite pass against the incrementally migrated local Supabase project.

## Testing Strategy

### Unit Tests:

- Exact eligibility, payment/no-payment derivation, month normalization, settlement-state parsing, and safe error mapping.
- Snapshot display data for both payment directions, equal balances, and server-derived confirmation identity.
- Current/past, no-expense, one-parent, pending, declined, first-confirmed, and settled UI-state mapping.

### Integration Tests:

- First and second distinct parent confirmation through the RPC, with exact snapshot persistence only at final settlement.
- Rejection of duplicate, cross-family, unauthenticated, non-first-day, current/future, empty, pending, and declined cases.
- Rejection of create/approve/decline/update/delete after first confirmation and after final settlement.
- Forced RLS and denied direct settlement/expense mutations remain intact.

### Manual Testing Steps:

1. Prepare an approved expense in a past month, inspect the payment/no-payment result, and confirm as parent A.
2. Confirm the first-confirmation lock hides or disables every mutation action and tells parent B that their confirmation is required.
3. Sign in as parent B, confirm the same month, and verify the settled snapshot and history badge update without a page reload.
4. Check disabled settlement guidance for current, empty, one-parent, pending, and declined reports.
5. On desktop and narrow viewport, verify dialog keyboard behavior, readable snapshots, normal report-history navigation, and retained scroll position after the background refresh.

## Performance Considerations

Settlement is one family/month command and one selected-month state read. The shared family-row lock serializes only financial mutations in the same family, which is appropriate for the two-parent MVP and avoids unsafe optimistic concurrency. Do not add polling, notifications, cached balances, or per-month N+1 queries.

## Migration Notes

Create a new forward-only migration; never modify applied migrations. Apply it incrementally with the local Supabase stack running—do not run `supabase db reset`, because it deletes local auth users. Existing open and settled rows predate snapshots: the migration must preserve their validity and only require snapshots for newly settled records, unless a safe deterministic backfill can be derived from immutable historical expenses. No rollback migration is needed for the MVP; a deployed settled report is deliberately irreversible.

## References

- Product requirement: `context/foundation/prd.md:107`
- Roadmap slice: `context/foundation/roadmap.md:127`
- Settlement schema and RLS: `supabase/migrations/20260717160000_financial_rules_foundation.sql:65`
- Exact financial rules: `src/lib/financial-rules.ts:33`
- Existing correction locking: `supabase/migrations/20260729120000_unsettled_expense_corrections.sql:69`
- Background workspace refresh: `src/components/expenses/ExpenseWorkspace.astro:76`
- Vertical-phase rule: `context/foundation/lessons.md:11`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Confirm and Lock an Eligible Report

#### Automated

- [x] 1.1 Settlement RPC, snapshot, authorization, and complete expense-mutation lock pgTAP coverage pass. — 38823a8
- [x] 1.2 Settlement server state, route, unit tests, lint, and production build pass. — 38823a8

#### Manual

- [x] 1.3 First parent confirmation visibly locks an eligible past report without a page refresh. — 38823a8
- [x] 1.4 Second parent confirmation settles the report, records the payment/no-payment snapshot, and refreshes history. — 38823a8
- [x] 1.5 Confirm no expense mutation is available or succeeds after first confirmation or settlement. — 38823a8

### Phase 2: Explain Eligibility and Preserve the Locked Report Experience

#### Automated

- [x] 2.1 Eligibility, lock, snapshot, and binary-history state regressions pass with lint and production build.
- [x] 2.2 Database family-read and binary-history regressions pass.

#### Manual

- [x] 2.3 Ineligible reports expose a disabled action with clear visible and touch-accessible guidance.
- [x] 2.4 First-confirmed and settled report states are clear and immutable on desktop and narrow viewport.
- [x] 2.5 Selected report and history refresh in the background without losing scroll position.

### Phase 3: Prove the Complete Two-Parent Settlement Boundary

#### Automated

- [ ] 3.1 Complete two-parent settlement lifecycle, snapshot, locking, and direct-write-denial pgTAP suite passes.
- [ ] 3.2 Settlement state and exact financial unit regressions, lint, and production build pass.

#### Manual

- [ ] 3.3 Two parents complete payment and balanced settlements; only a second distinct confirmation finalizes each.
- [ ] 3.4 Stale confirmation and mutation attempts fail safely across desktop and narrow viewport without full-page refresh.
