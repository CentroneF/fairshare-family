---
title: Monthly report confirmation invariant — aggregate refactor plan
created: 2026-08-11
type: refactor-plan
---

# Monthly report confirmation invariant — aggregate refactor plan

## 0. Discovery

FairShare Family exists to give separated co-parents a reliable end-of-month view and reduce conflict ([PRD](../foundation/prd.md:18)). Its primary success criterion requires both parents to agree before a report becomes `SETTLED`; its guardrails require financially accurate reports and forbid unilateral settlement ([PRD](../foundation/prd.md:28)). The detailed rule is stronger: a past month can be jointly settled only after every expense is approved; a declined expense must be corrected and re-approved or deleted ([PRD](../foundation/prd.md:98)), and pending amounts are deliberately outside the settlement calculation ([PRD](../foundation/prd.md:108)).

The stack is an Astro 6, React 19, TypeScript, Tailwind, Supabase, and Cloudflare Workers web application ([README](../../README.md:7)). Business logic currently spans:

- **UI** — Astro components derive eligible/locked controls and submit forms.
- **API/application adapters** — Astro API routes parse forms and invoke TypeScript adapters.
- **TypeScript read/policy layer** — `expense-balance.ts`, `financial-service.ts`, and `financial-rules.ts` calculate/display policy and map errors.
- **Authoritative persistence/command layer** — PostgreSQL tables, RLS, constraints, and `SECURITY DEFINER` RPC functions in `supabase/migrations/`.

Supabase is the actual write authority: all domain tables have forced RLS ([foundation migration](../../supabase/migrations/20260717160000_financial_rules_foundation.sql:241)) and authenticated users receive only `SELECT` table grants ([foundation migration](../../supabase/migrations/20260717160000_financial_rules_foundation.sql:277)). The existing `confirm_monthly_settlement` RPC is therefore the closest current aggregate boundary, but the same confirmation-lock rule is duplicated into five other write commands.

## 1. Identified business invariants

| Invariant | Verified business/code source | Current enforcement |
| --- | --- | --- |
| A user belongs to at most one family; a family has at most two active parents. | [PRD](../foundation/prd.md:70); `family_members.user_id` is unique and a trigger rejects a third active parent ([migration](../../supabase/migrations/20260717160000_financial_rules_foundation.sql:11), [trigger](../../supabase/migrations/20260717160000_financial_rules_foundation.sql:143)). | Database-enforced and fail-fast. |
| An expense is a positive two-decimal PLN cost; only the other active parent may review it; editing returns it to pending review. | [PRD](../foundation/prd.md:79), [PRD](../foundation/prd.md:81), [PRD](../foundation/prd.md:85); schema and review-pair check ([migration](../../supabase/migrations/20260717160000_financial_rules_foundation.sql:32)); review RPC checks ([migration](../../supabase/migrations/20260729180000_fix_settlement_review_commands.sql:11)). | Database command- and constraint-enforced. |
| Only approved costs contribute to the 50/50 balance; pending is separate and declined is excluded; only the final transfer is whole-PLN rounded half-up. | [PRD](../foundation/prd.md:104), [PRD](../foundation/prd.md:108); TypeScript calculation ([financial rules](../../src/lib/financial-rules.ts:48)); SQL settlement calculation ([settlement migration](../../supabase/migrations/20260729170000_joint_monthly_settlement.sql:325)). | Declared/calculated in two implementations; final persisted snapshot is constrained, but presentation calculation is duplicated. |
| **A past monthly report may become settled only after two distinct active parents confirm a non-empty, wholly approved report; the first confirmation freezes its expenses, and the second atomically records the final snapshot.** | [PRD](../foundation/prd.md:32), [PRD](../foundation/prd.md:40), [PRD](../foundation/prd.md:98), [PRD](../foundation/prd.md:122); confirmation RPC ([settlement migration](../../supabase/migrations/20260729170000_joint_monthly_settlement.sql:280)). | Strong for today’s RPCs, but procedurally smeared across UI, read policy, five expense commands, confirmation command, and constraints. The intermediate frozen state is represented as `status = open` plus a nullable column, not as an explicit state. |
| A settled snapshot is internally coherent: contributions sum to approved total and payment parties are either both distinct or both absent for zero payment. | Snapshot check ([settlement migration](../../supabase/migrations/20260729170000_joint_monthly_settlement.sql:53)). | Database constraint-enforced. |
| A parent can read only their active family’s financial workspace. | [PRD](../foundation/prd.md:103); forced RLS/select policies ([foundation migration](../../supabase/migrations/20260717160000_financial_rules_foundation.sql:241)). | Database-enforced. |

## 2. Classification and choice

Scores use **high / medium / low**; “enforcement” distinguishes intrinsic persistence protection from a rule protected only by a known list of procedural callers.

| Invariant | Core to product purpose | Spread across layers | Enforcement assessment |
| --- | --- | --- | --- |
| Family membership limits | Medium — setup/access support | Low | Strong/intrinsic: uniqueness plus trigger. |
| Expense review lifecycle | High — feeds trusted balances | High | Strong, though command-specific. |
| 50/50 calculation and rounding | High — financial accuracy | Medium | Medium: TypeScript and SQL duplicate it; the final snapshot is constrained but UI calculation is advisory. |
| **Joint confirmation, freeze, and snapshot** | **Highest — the product’s conflict-reducing agreement** | **Very high — UI, API, TypeScript, six SQL commands, schema, and tests** | **Medium/fragile as a model:** current callers enforce it correctly, but no single persisted state names “frozen”; every future expense mutation must remember the predicate. |
| Snapshot internal consistency | High | Low | Strong/intrinsic check constraint. |
| Family workspace authorization | Medium, security-critical | Low | Strong/intrinsic RLS. |

### Chosen #1: the joint-confirmation freeze and settlement invariant

This is the most core invariant because it is exactly the primary promise: mutually agreed, accurate month-end settlement rather than unilateral bookkeeping. It is the most weakly enforced **among the core irreversible rules**: not because the present database commands are unsafe—they are well protected—but because the essential state transition is an unnamed protocol split among six procedures. The database permits an `open` settlement with `first_confirmed_by` populated ([foundation migration](../../supabase/migrations/20260717160000_financial_rules_foundation.sql:84)); the meaning “immutable pending second confirmation” must be re-inferred in every writer and reader. That makes it violable by the next privileged mutation function that omits the repeated `(first_confirmed_by is not null or status = 'settled')` guard.

## 3. Diagnosis: where the chosen rule lives today

### Current rule and state machine

```text
Mutable report --first valid confirmation--> Frozen pending co-parent
Frozen pending co-parent --distinct second confirmation--> Settled snapshot
```

The persistence enum only exposes `open | settled` ([foundation migration](../../supabase/migrations/20260717160000_financial_rules_foundation.sql:1)); `Frozen pending co-parent` is encoded indirectly as `open` plus `first_confirmed_by`. That is the central modelling smell.

| Layer | Verified location | What it does today | Gap / inconsistency |
| --- | --- | --- | --- |
| Product rule | [PRD](../foundation/prd.md:98) and [PRD](../foundation/prd.md:120) | Requires two-parent agreement and no unresolved expense before lock/settlement. | Does not name the first-confirmation frozen state. |
| UI eligibility | [`getSettlementUnavailableReason`](../../src/lib/expense-balance.ts:401) and [`deriveSettlementState`](../../src/lib/expense-balance.ts:415) | Recalculates past-month, two-parent, non-empty, pending/declined eligibility and derives lock status from a row. | Advisory duplicate of the command’s eligibility; it must never be treated as authority. |
| UI controls | [`ExpenseList`](../../src/components/expenses/ExpenseList.astro:28), [`MonthlyBalancePanel`](../../src/components/expenses/MonthlyBalancePanel.astro:74), and [`SettlementConfirmationDialog`](../../src/components/expenses/SettlementConfirmationDialog.astro:23) | Hides mutation controls while `isMonthLocked`, labels first confirmation as immediately locking the month, and exposes second confirmation. | The UI is a convenience guardian only; stale forms can still be submitted. |
| Thin API | [`POST /api/settlements/confirm`](../../src/pages/api/settlements/confirm.ts:5) | Parses the selected month, calls the adapter, maps failures to 400/redirect. | Correctly thin, but maps string messages rather than typed domain errors. |
| TypeScript adapter | [`confirmMonthlySettlement`](../../src/lib/expense-balance.ts:338) | Sends only the selected month to the RPC; no client financial authority. | Error ownership leaks: generic mapping uses database message text ([`mapSettlementError`](../../src/lib/expense-balance.ts:161)). |
| Confirmation command | [`confirm_monthly_settlement`](../../supabase/migrations/20260729170000_joint_monthly_settlement.sql:280) | Locks family row; validates caller, past month, two parents, non-empty/all-approved expenses; records first confirmation or atomically finalizes snapshot. | Closest aggregate root, but its state semantics are not captured as domain methods or an explicit aggregate state. |
| Expense commands | Create ([migration](../../supabase/migrations/20260729170000_joint_monthly_settlement.sql:87)), approve ([migration](../../supabase/migrations/20260729180000_fix_settlement_review_commands.sql:1)), decline ([migration](../../supabase/migrations/20260729180000_fix_settlement_review_commands.sql:37)), update ([migration](../../supabase/migrations/20260729170000_joint_monthly_settlement.sql:208)), delete ([migration](../../supabase/migrations/20260729170000_joint_monthly_settlement.sql:251)) | Each separately locks the family row then repeats a confirmation-lock check. Update checks both source and destination months. | Repetition is the vulnerability: one omitted guard creates a new bypass. |
| Persistence constraints | Settlement identity/state check ([foundation migration](../../supabase/migrations/20260717160000_financial_rules_foundation.sql:77)); snapshot coherence ([settlement migration](../../supabase/migrations/20260729170000_joint_monthly_settlement.sql:53)) | Requires distinct confirmations when settled; requires a consistent snapshot. | Does not make “first confirmation means immutable” an intrinsic state constraint. |
| Regression proof | First confirmation and frozen mutations ([database test](../../supabase/tests/approved_expense_balance.test.sql:316)); final snapshot ([database test](../../supabase/tests/approved_expense_balance.test.sql:446)); rejection scenarios ([database test](../../supabase/tests/approved_expense_balance.test.sql:578)) | Proves current procedure list rejects stale/illegal operations. | Protects today’s list, not future write paths by construction. |

No server-side command silently proceeds after an illegal settlement action: PostgreSQL raises before a write, and the API returns an error. One read-side fail-open seam should nevertheless be fixed during refactoring: `loadSettlementRow` returns `null` for malformed persisted data ([expense balance](../../src/lib/expense-balance.ts:381)), which can make it look like no settlement exists and lets UI policy derive eligibility. It should throw `MalformedMonthlySettlementReadModelError`; an invalid authoritative row must stop the read rather than be downgraded to absence. The refresh catch after a successful confirmation is not a domain swallow: it records success and tells the user to reload ([workspace](../../src/components/expenses/ExpenseWorkspace.astro:190)).

## 4. Design: `MonthlyReport` guardian aggregate

### Boundary and state

Create a server-only domain module with **`MonthlyReport`** as aggregate root, identified by `(familyId, reportMonth)`. It owns the two active parent memberships, that month’s expense states, confirmation progress, and (only once settled) the payment snapshot. `Expense` remains an entity outside this aggregate for ordinary lifecycle work; an expense command that can alter a month must load that month’s report aggregate and ask it for permission. The aggregate’s explicit state replaces the nullable-column protocol:

```ts
type MonthlyReportState =
  | { kind: "mutable" }
  | { kind: "frozen"; confirmedBy: MembershipId; confirmedAt: Instant }
  | { kind: "settled"; confirmations: readonly [Confirmation, Confirmation]; snapshot: SettlementSnapshot };

class MonthlyReport {
  confirmBy(actor: MembershipId, now: Instant): ConfirmationResult;
  assertExpenseMutationAllowed(): void;
  settleWithSecondConfirmation(actor: MembershipId, now: Instant): SettlementSnapshot;
}
```

`confirmBy` is the only command API exposed to the confirmation route. It validates, in this order: report month is past; active parents are exactly two; there is at least one expense; every expense is approved; actor is active; the report is mutable or frozen by the *other* parent. It then either transitions `mutable → frozen` or `frozen → settled`, computing the immutable snapshot from the loaded approved expenses. A caller confirming twice throws `DuplicateSettlementConfirmationError`; confirming a settled report throws `MonthlyReportAlreadySettledError`.

```ts
confirmBy(actor, now) {
  this.assertPastMonth(now);
  this.assertExactlyTwoActiveParents();
  this.assertHasExpenses();
  this.assertAllExpensesApproved();
  this.assertActorIsActiveParent(actor);

  if (this.state.kind === "settled") throw new MonthlyReportAlreadySettledError();
  if (this.state.kind === "mutable") {
    this.state = { kind: "frozen", confirmedBy: actor, confirmedAt: now };
    return { kind: "awaiting-other-parent" };
  }
  if (this.state.confirmedBy === actor) throw new DuplicateSettlementConfirmationError();

  const snapshot = SettlementSnapshot.fromApprovedExpenses(this.expenses, this.parents);
  this.state = { kind: "settled", confirmations: [this.firstConfirmation, { actor, at: now }], snapshot };
  return { kind: "settled", snapshot };
}

assertExpenseMutationAllowed() {
  if (this.state.kind === "frozen") throw new MonthlyReportConfirmationLockedError();
  if (this.state.kind === "settled") throw new MonthlyReportAlreadySettledError();
}
```

Domain errors are named and fail-fast: `SettlementMonthNotPastError`, `SettlementRequiresExactlyTwoParentsError`, `SettlementRequiresExpenseError`, `SettlementHasUnresolvedExpensesError`, `DuplicateSettlementConfirmationError`, `MonthlyReportConfirmationLockedError`, `MonthlyReportAlreadySettledError`, and `MalformedMonthlySettlementReadModelError`. Do not use `boolean` eligibility as the command contract and do not log-and-continue on these errors.

### Repository and one transaction

Introduce a `MonthlyReportRepository` whose command-side API is deliberately narrow:

```ts
interface MonthlyReportRepository {
  withinTransaction<T>(work: (tx: MonthlyReportTransaction) => Promise<T>): Promise<T>;
}
interface MonthlyReportTransaction {
  loadForUpdate(familyId: FamilyId, month: ReportMonth): Promise<MonthlyReport>;
  save(report: MonthlyReport): Promise<void>;
}
```

`loadForUpdate` must load the family, exactly active parents, month expenses, and settlement row under the existing family-row serialization lock plus `FOR UPDATE` on the settlement row. `save` persists only the aggregate transition. In Supabase/PostgreSQL this belongs in one new `SECURITY DEFINER` RPC (or a database-resident repository function) because the browser client cannot hold a multi-query transaction. Keep RLS/select-only direct writes; the function executes `load → confirmBy → save` atomically, so the second confirmation snapshots the same expense set that the first confirmation froze. Do **not** move authority to TypeScript or the client.

Expense create/approve/decline/update/delete become application commands that load the affected source/destination `MonthlyReport` aggregate(s) in the same transaction and call `assertExpenseMutationAllowed()` before changing an expense. This replaces five copied SQL predicates with one guardian policy. For a cross-month edit, load both reports in stable `(reportMonth)` order to avoid deadlocks, then require both to be mutable.

### Thin API after refactor

```ts
POST /api/settlements/confirm
  month = parseReportMonth(form.month)       // shape only
  result = settlementService.confirm({ actor: context.locals.user.id, month })
  return 200 { state: result.kind }          // no ids, amounts, confirmations, or snapshot accepted from client

catch (error)
  SettlementMonthNotPastError              -> 422
  SettlementRequires* | SettlementHas*     -> 409
  DuplicateSettlementConfirmationError     -> 409
  MonthlyReport*Locked/AlreadySettledError -> 409
  Authentication/authorization             -> 401/403
```

The UI keeps rendering state and submitting a single month, but no longer owns eligibility or locking authority. A stale visible action receives a named server rejection and leaves state unchanged.

## 5. Before → after and refactoring phases

| Current location | Before | After |
| --- | --- | --- |
| `monthly_settlements` row | `open` ambiguously includes mutable and first-confirmed/frozen. | Explicit aggregate state; persist a named `frozen` state (or an equivalent constrained `state` value) rather than infer it from nullability. |
| `confirm_monthly_settlement` | Procedure mixes load, policy, state transition, and snapshot SQL. | Transactional repository loads `MonthlyReport`; `confirmBy` owns the transition; persistence adapter saves it atomically. |
| Five expense RPCs | Each repeats a lock predicate. | Each asks loaded report(s) `assertExpenseMutationAllowed()`; one guardian rule. |
| `expense-balance.ts` | Recomputes eligibility and maps message text; malformed rows become `null`. | Read-model mapper exposes aggregate state; typed error mapper; malformed authoritative rows throw. |
| API route | Maps broad exception strings to 400. | Maps named domain errors to stable 409/422 responses. |
| Astro UI | Hides/disabled actions using independently derived eligibility. | Uses server-provided state for affordances; remains non-authoritative and handles conflict responses. |
| pgTAP/Vitest | Tests functions and UI state separately. | Tests aggregate legal/illegal transitions first, then one transaction adapter, then route/UI mapping. |

### Plan phases

1. **Test-first — name and characterize the aggregate.** Add pure Vitest tests for the state machine and snapshot derivation before extracting logic. Preserve current financial behavior, including final half-up rounding. Add the domain errors and `MonthlyReport` without changing routes.
2. **Test-first — transactional persistence boundary.** Add a forward-only migration (never edit applied migrations) that makes `mutable`, `frozen`, and `settled` explicit and constrains their confirmation/snapshot shapes. Implement the one-RPC transactional repository with family serialization and direct-write denial retained. Run `npx supabase test db` with local Supabase.
3. **Test-first — route the settlement command through the aggregate.** Replace the current confirmation RPC internals with the repository/aggregate operation; keep the route input to month only and map typed failures. Verify existing settlement snapshots remain readable; use an incremental compatibility/backfill decision before making new state constraints mandatory.
4. **Test-first — route all expense mutations through the same guardian.** Convert create, approve, decline, update, and delete one vertical slice at a time; cross-month edits must load/check both monthly reports. Remove each copied procedural lock predicate only after its replacement test passes.
5. **Read/UI integration and hardening.** Replace duplicate eligibility logic with server-owned report state, make malformed rows fail closed, retain accessible guidance and normal form fallback, then run `npm run verify` and the database suite. Manually verify first confirmation freezes the UI and stale submissions receive a server rejection.

### Load-bearing tests

- Mutable + valid past all-approved report: first active parent produces `frozen`, no snapshot, and cannot confirm twice.
- Frozen report: only the other active parent produces `settled`; its snapshot has exact approved total/contributions and correct half-up payment or zero-payment form.
- Current/future/non-first-of-month report, fewer/more than two active parents, empty report, pending report, and declined report each throw the specific error and persist no confirmation.
- Every expense mutation (create, approve, decline, update, delete) fails after first confirmation and after settlement; a cross-month edit fails if either report is frozen/settled.
- Same-parent second confirmation, inactive/outsider actor, and already-settled confirmation fail without state changes.
- Concurrent confirmation/mutation attempts serialize on the family/report lock: no mutation can enter the frozen set and final snapshot derives from the frozen approved set.
- Direct authenticated `INSERT`/`UPDATE`/`DELETE` of expenses and settlement state remain denied.
- A malformed settlement record produces `MalformedMonthlySettlementReadModelError`, never an apparently mutable/eligible report.
- Route tests assert only month is accepted; stable domain-error-to-HTTP mapping; UI tests assert server state drives controls but stale submission error is visible.

### Contract registry

No contract registry exists under `context/` (only the existing domain distillation was found), so there is nothing to register today. If one is introduced, register: `MonthlyReport`, `MonthlyReportState` (`mutable | frozen | settled`), `MonthlyReportRepository`, `SettlementSnapshot`, `ReportMonth`, `Confirmation`, and the eight named domain errors above. Do not add an informal synonym such as “confirmation lock” without mapping it to `frozen`.

## Summary

FairShare Family’s central invariant is the jointly confirmed, immutable monthly report, because it delivers the product’s promise of an accurate conflict-reducing settlement. The current Supabase commands enforce it well for existing paths, but its critical frozen state is implicit and its guard is duplicated across five expense mutations, read logic, UI, and a settlement procedure. The proposed `MonthlyReport` aggregate makes mutable, frozen, and settled states explicit and gives `confirmBy` and `assertExpenseMutationAllowed` sole domain ownership. A transactional repository/RPC remains the authority, retaining PostgreSQL locking, RLS, and atomic snapshot persistence rather than moving enforcement to the browser. The API stays thin and maps named fail-fast domain errors to stable responses, while UI state remains advisory. The refactor should be test-first, beginning with transition tests, then database transaction/constraint tests, then one mutation path at a time. No production code is changed by this plan.
