---
date: 2026-08-04T09:47:06+02:00
researcher: Codex
git_commit: 2f2012a36e9ae5c18745f779001a42653855b54f
branch: main
repository: fairshare-family
topic: "Testing expense settlement state protections"
tags: [research, testing, expenses, settlements, pgTAP, vitest]
status: complete
last_updated: 2026-08-04
last_updated_by: Codex
---

# Research: Testing expense settlement state protections

**Date**: 2026-08-04T09:47:06+02:00  
**Researcher**: Codex  
**Git Commit**: 2f2012a36e9ae5c18745f779001a42653855b54f  
**Branch**: main  
**Repository**: fairshare-family

## Research Question

Identify the current expense and monthly-settlement state protections, their most valuable regression-test seams, and the focused work needed for Phase 1 of the risk-based test plan.

## Summary

The financial trust boundary already lives at the database RPC layer, not in the UI. All expense commands and settlement confirmation acquire the same family-row lock, then reject reports with either a first confirmation or a final settlement. The current pgTAP suite covers the primary lifecycle well: first and second confirmation, same-parent denial, lock rejection for each mutation category, exact final snapshots, and pending/declined ineligibility.

Phase 1 should therefore strengthen proof of immutability rather than reproduce happy paths. The highest-signal additions are: assert no persisted side effects after rejected commands; cover lock checks for both source and destination months during an edit; make the all-three-status exact-total oracle explicit; and keep the pure balance/eligibility table tests aligned with the persisted correction lifecycle. A two-session concurrency test is deliberately outside this phase: serialization is established by `FOR UPDATE`, but pgTAP’s single-session harness cannot prove a race cheaply.

## Detailed Findings

### Authoritative mutation and lock boundary

- RLS is enabled and forced, while authenticated users receive read access rather than direct expense or settlement writes. The database tests exercise direct-write denial. [Foundation migration](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/migrations/20260717160000_financial_rules_foundation.sql#L241), [direct-write tests](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/tests/financial_rules_foundation.test.sql#L25)
- The settlement migration is the command authority. `create_expense`, review commands, edit, delete, and `confirm_monthly_settlement` lock the family before checking the report’s settlement state. [Command definitions](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/migrations/20260729170000_joint_monthly_settlement.sql#L87), [final review-command fixes](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/migrations/20260729180000_fix_settlement_review_commands.sql#L1)
- UI lock states are a useful user-facing guard but not the security proof: `ExpenseList` hides controls using `isMonthLocked`, while the route invokes the RPC and the database still decides. [Expense list](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/src/components/expenses/ExpenseList.astro#L28), [create route](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/src/pages/api/expenses/create.ts#L20)

### Joint confirmation and immutable settlement snapshots

- Confirmation requires a past month, two active parents, at least one expense, and only approved expenses. A first caller stores the first confirmation; only a distinct second caller writes the final immutable snapshot. [Confirmation RPC](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/migrations/20260729170000_joint_monthly_settlement.sql#L280)
- Database constraints require distinct confirmations and a complete confirmation pair for settled state; snapshot constraints enforce valid payment parties. [Settlement constraints](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/migrations/20260717160000_financial_rules_foundation.sql#L84), [snapshot constraints](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/migrations/20260729170000_joint_monthly_settlement.sql#L53)
- The pgTAP suite already proves first-confirmation state, duplicate confirmation rejection, distinct-second-parent finalization, payment snapshots, and zero-payment settlement. [Settlement lifecycle tests](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/tests/approved_expense_balance.test.sql#L291)

### Expense correction states and financial inclusion

- Updating an approved or declined expense changes it back to pending and clears reviewer metadata; deletion allows only pending or declined expenses. [Update and delete RPCs](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/migrations/20260729170000_joint_monthly_settlement.sql#L208)
- The pure financial rule is the correct exact-total oracle: approved expenses contribute to the payment calculation, pending expenses only to the review total, and declined expenses are excluded. Eligibility also requires all expenses to be approved. [Financial rules](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/src/lib/financial-rules.ts#L36), [eligibility predicate](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/src/lib/financial-rules.ts#L101)
- Existing tests cover representative corrections and status handling, but a single all-three-status fixture would give a clearer regression oracle across totals and settlement eligibility. [Correction tests](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/tests/approved_expense_balance.test.sql#L178), [unit status tests](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/src/lib/financial-rules.test.ts#L19)

### Current test infrastructure

- Unit tests use Vitest and run through `npm test`; the Phase 1 seams are in `financial-rules.test.ts` and `expense-balance.test.ts`. [Package scripts](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/package.json#L4), [expense balance tests](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/src/lib/expense-balance.test.ts#L83)
- Database integration uses pgTAP in `supabase/tests/approved_expense_balance.test.sql` and runs with `npx supabase test db` after the local Supabase stack is started. [Suite setup](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/supabase/tests/approved_expense_balance.test.sql#L1), [repository command guidance](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/AGENTS.md#L22)

## Recommended Phase-1 Test Seams

1. In `supabase/tests/approved_expense_balance.test.sql`, pair each failed mutation after first confirmation or settlement with a persisted-state assertion: unchanged row count for create, expense row fields/status for review and edit, row survival for delete, and settlement confirmation/snapshot fields after a duplicate confirmation.
2. Add first-confirmation edit cases where the locked month is both the source and the destination. Existing settled-month coverage proves the analogous condition but leaves this branch-specific regression gap.
3. Add a table-driven unit test for a month containing approved, pending, and declined expenses; assert exact totals, balance/settlement result, and ineligibility. Add correction-to-pending and removal cases to connect the pure oracle to the intended lifecycle.
4. Retain existing pgTAP lifecycle coverage rather than duplicating UI tests. Do not treat hidden or disabled controls as evidence that a mutation is prevented.

## Architecture Insights

- The project correctly separates advisory UI state from the authoritative transaction boundary: server-derived workspace state improves usability, while SECURITY DEFINER RPCs, forced RLS, and family locks protect data integrity.
- The family row is the shared serialization point for every financial write in a family. It gives a clear contract for confirmation-versus-mutation ordering without adding separate optimistic-locking state.
- Calculation belongs in pure TypeScript and persistence transitions belong in SQL. Tests should use the former for exact amount expectations and the latter for authorization, lock, and no-side-effect guarantees.

## Historical Context

- The financial foundation deliberately made balance calculation, eligibility, RLS, and direct-write denial testable before UI flows were added. [Financial rules plan](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/context/archive/2026-07-17-financial-rules-verification/plan.md#L101)
- The correction slice established that edits to resolved expenses must return to pending/re-review, and that source and destination report months must respect locks. [Corrections plan](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/context/archive/2026-07-22-unsettled-expense-corrections/plan.md#L48)
- The joint-settlement slice explicitly chose first-confirmation locking, a distinct second confirmer, and a final snapshot while requiring the same family lock for all financial mutations. [Joint-settlement plan](https://github.com/CentroneF/fairshare-family/blob/2f2012a36e9ae5c18745f779001a42653855b54f/context/archive/2026-07-29-joint-monthly-settlement/plan.md#L41)

## Related Research

- No prior `research.md` artifact covers this test-rollout phase directly.

## Open Questions

- Is a genuine two-session concurrency test warranted when the lock order or settlement RPC changes? It is not justified for this initial regression floor because the present pgTAP harness is sequential.
- Should `payment_to_membership_id` be included in the server read model? The database enforces the snapshot, but the current UI state does not independently expose payment direction from that stored field.
