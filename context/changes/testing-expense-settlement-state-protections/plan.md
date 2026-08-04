# Expense and Settlement State Protections Implementation Plan

## Overview

Strengthen the Phase-1 regression floor for financial state transitions and settlement locks. This change adds focused unit and pgTAP assertions that prove financial-state calculations are exact and that failed mutations do not alter locked reports, then records the established pattern in the test-plan cookbook.

## Current State Analysis

The database is already the authority for expense and settlement mutations: all commands take the same family-row lock and reject first-confirmed or settled report months. The current pgTAP lifecycle suite proves most error outcomes, but several rejected actions lack a following assertion that persisted expense or settlement state stayed unchanged. Vitest already uses exact decimal strings and explicit dates for financial rules, but the three expense states are not yet tied together in a small exact-total and eligibility matrix.

## Desired End State

The test suite explicitly demonstrates that approved, pending, and declined expenses have the correct totals and eligibility effects, and that rejected locked-state actions have no persisted side effect. Contributors can then follow a documented cookbook pattern to add future financial state-transition tests using Vitest and pgTAP.

### Key Discoveries

- `deriveMonthlyBalance` and `isSettlementEligible` are the pure, public exact-value and eligibility seams in `src/lib/financial-rules.ts:36` and `src/lib/financial-rules.ts:101`.
- `supabase/tests/approved_expense_balance.test.sql` is the existing linear pgTAP lifecycle suite; it uses deterministic fixtures, `throws_ok`, and post-condition assertions under one transaction.
- First confirmation and settlement use the same family lock as every expense write in `supabase/migrations/20260729170000_joint_monthly_settlement.sql:115-346`.
- `context/foundation/test-plan.md` Phase 1 calls for unit plus database-integration protection and requires its cookbook to grow as rollout phases ship.

## What We're NOT Doing

- Changing migrations, SQL RPCs, RLS policies, API routes, Astro components, or the settlement read model.
- Adding e2e/browser tests or treating hidden/disabled controls as proof of data protection.
- Building a two-session concurrency harness; the existing family-row lock remains the documented serialization contract.
- Exhaustively testing every operation × expense-status × lock-state permutation.

## Implementation Approach

Use the cheapest authoritative signal for each risk. A small Vitest state table owns exact financial semantics and settlement eligibility. The existing pgTAP suite owns persisted lock and no-side-effect guarantees, keeping fixtures adjacent to the lifecycle they exercise. Finish by making the patterns and commands discoverable in the quality contract.

## Critical Implementation Details

Keep no-side-effect assertions stable: compare business fields, statuses, identities, and exact snapshot values, rather than `now()`-derived timestamps. In the pgTAP suite, create otherwise unreachable lock-state fixtures as `postgres`, restore the authenticated caller before invoking a command, and clean up every temporary fixture in the existing transaction.

## Phase 1: Exact financial state oracle

### Overview

Make the pure financial contract unambiguous for each expense status before asserting database transitions against it.

### Changes Required

#### 1. Financial-rule unit coverage

**File**: `src/lib/financial-rules.test.ts`

**Intent**: Add a compact, table-driven regression test that makes each approved, pending, and declined state’s exact totals and settlement eligibility visible independently.

**Contract**: Use fixed past-month and today dates plus PLN decimal strings. For each one-expense case, call both `deriveMonthlyBalance` and `isSettlementEligible`; assert `totalAmount`, `approvedAmount`, and `toReviewAmount` via `Decimal#toString`, then assert eligibility. Preserve the existing mixed-state test as a composition smoke test rather than duplicating its purpose.

### Success Criteria

#### Automated Verification

- The focused Vitest file passes with exact approved, pending, and declined totals plus eligibility assertions.
- The complete Vitest suite passes without changing production source files.

#### Manual Verification

- Review the new case names and expected strings to confirm they state the financial contract without deriving expectations from production helpers.

---

## Phase 2: Locked-report immutability

### Overview

Extend the authoritative database regression suite so every selected rejection demonstrates both the error and unchanged persisted state.

### Changes Required

#### 1. First-confirmation lock assertions

**File**: `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Strengthen the first-confirmation lifecycle so a duplicate confirmation and blocked expense mutations prove that settlement and expense records have not changed.

**Contract**: After the existing `throws_ok` calls, assert: a duplicate confirmation preserves open state, the first confirmer, absent second confirmer, and absent snapshot fields; blocked creation creates no row; blocked update preserves editable fields and status; blocked delete retains its declined row; and blocked approval/decline preserve pending, unreviewed fields. Add two deterministic privileged fixtures to prove a first-confirmed month blocks edits when it is either the source or destination month, and clean them up in the existing fixture cleanup block.

#### 2. Settled-report invariant assertions

**File**: `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Make completed-settlement immutability explicit after duplicate confirmation and post-settlement mutation denials.

**Contract**: Assert the final settlement’s status, both confirmer identities, exact totals/contributions/payment, and payment direction remain unchanged after a duplicate confirmation. Assert rejected creation leaves no row and rejected review actions preserve their pending/review metadata. Extend the existing settled edit and delete rejection cases with narrow retention checks where they do not already prove persistence.

#### 3. pgTAP assertion accounting

**File**: `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Keep the suite’s declared test plan accurate after adding invariant checks.

**Contract**: Increase `plan(103)` by the exact number of newly added assertions and retain the single `begin` / `finish` / `rollback` lifecycle. Do not count setup statements as tests.

### Success Criteria

#### Automated Verification

- `npx supabase test db` passes against the local Supabase stack with the adjusted pgTAP plan count.
- The new first-confirmed and settled rejection cases each assert a concrete unchanged persistence invariant in addition to their expected error.

#### Manual Verification

- Review the SQL test sequence to confirm authenticated RPC calls—not privileged fixture setup—exercise every rejection.
- Inspect the test output to confirm the pgTAP plan count and executed assertion count agree.

---

## Phase 3: Cookbook and regression handoff

### Overview

Document the shipped state-transition patterns and run the project’s relevant quality gates.

### Changes Required

#### 1. Financial state-transition cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the Phase-1 placeholder in §6.1 with the repeatable location, naming, reference-test, and command guidance contributors need for financial state regressions.

**Contract**: Document `src/lib/financial-rules.test.ts` as the exact-total/eligibility unit seam and `supabase/tests/approved_expense_balance.test.sql` as the RPC lock/no-side-effect integration seam. Specify behavior-first test names, explicit date boundaries, PLN strings, `Decimal#toString`/`toFixed(2)` assertions, and the focused/full Vitest plus local-Supabase pgTAP commands. Link the new tests as the reference examples.

### Success Criteria

#### Automated Verification

- `npm test -- src/lib/financial-rules.test.ts` passes.
- `npm test` passes.
- `npx supabase test db` passes after the local Supabase stack is started.
- `npm run lint` and `npm run build` pass.

#### Manual Verification

- Read §6.1 as a new contributor and confirm it answers where to place a financial state test, how to name/assert it, and how to run it.
- Confirm the final diff contains only targeted tests and the Phase-1 cookbook documentation.

## Testing Strategy

### Unit Tests

- Test one approved, one pending, and one declined expense against exact total, approved, and review amounts.
- Assert that only the approved past-month case is settlement eligible under the same explicit dates.
- Keep expected monetary values as strings and compare Decimal outputs without JavaScript-number coercion.

### Integration Tests

- Test duplicate first and final settlement confirmation leaves settlement state and snapshot fields unchanged.
- Test rejected create, approve, decline, update, and delete actions leave their relevant expense state unchanged after first confirmation or settlement.
- Test first-confirmed locks when an edit originates in or moves into the locked month.

### Manual Testing Steps

1. Review the focused Vitest output and verify each state’s behavior is legible from its test name and expected values.
2. Run the pgTAP suite against local Supabase and inspect that each lock rejection is followed by an invariant assertion.
3. Read the updated cookbook and follow its focused commands from a clean shell.

## Performance Considerations

No production code or runtime path changes. The added tests remain deterministic, transaction-scoped, and reuse the existing fixture model.

## Migration Notes

No migration is created or modified. Start the local Supabase stack and apply existing migrations incrementally before the pgTAP command; do not run `supabase db reset` for this change.

## References

- Related research: `context/changes/testing-expense-settlement-state-protections/research.md`
- Quality contract: `context/foundation/test-plan.md`
- Existing database lifecycle suite: `supabase/tests/approved_expense_balance.test.sql:1-552`
- Existing financial unit tests: `src/lib/financial-rules.test.ts:1-72`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Exact financial state oracle

#### Automated

- [x] 1.1 Focused Vitest file passes with exact approved, pending, and declined totals plus eligibility assertions — 5947142
- [x] 1.2 Complete Vitest suite passes without production source changes — 5947142

#### Manual

- [x] 1.3 Review case names and expected strings as an independent financial contract — 5947142

### Phase 2: Locked-report immutability

#### Automated

- [x] 2.1 Local pgTAP suite passes with the adjusted assertion count — 3ef2c96
- [x] 2.2 First-confirmed and settled rejection cases assert unchanged persisted state as well as expected errors — 3ef2c96

#### Manual

- [x] 2.3 Review the SQL sequence to verify authenticated RPC behavior drives rejection checks — 3ef2c96
- [x] 2.4 Confirm the pgTAP plan count matches executed assertions — 3ef2c96

### Phase 3: Cookbook and regression handoff

#### Automated

- [x] 3.1 Focused financial-rules Vitest command passes — e6e7d33
- [x] 3.2 Complete Vitest suite passes — e6e7d33
- [x] 3.3 Local pgTAP suite passes — e6e7d33
- [x] 3.4 Lint and production build pass — e6e7d33

#### Manual

- [x] 3.5 Confirm §6.1 answers placement, naming/assertion, reference-test, and command questions — e6e7d33
- [x] 3.6 Confirm the final diff contains only targeted tests and Phase-1 cookbook documentation — e6e7d33
