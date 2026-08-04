# Family Authorization and Migration Boundaries Implementation Plan

## Overview

Add a focused pgTAP database-integration suite that protects family isolation
against final-schema and future-migration regressions. The suite will prove
that RLS filters all family-owned data, direct authenticated writes remain
unavailable, and database RPCs cannot mutate another family’s expense or
settlement state.

## Current State Analysis

The current database already implements the security contract: forced RLS
filters core tables by active family membership, while authenticated mutations
flow through `SECURITY DEFINER` RPCs that derive caller identity from
`auth.uid()`. Existing pgTAP coverage proves parts of that contract, but the
proof is split between the foundation and financial-lifecycle suites. It lacks
foreign-expense update coverage, a complete direct-read matrix, and a
caller-scoped settlement regression test.

## Desired End State

`npx supabase test db` runs an independently readable authorization-boundary
suite against the full migration chain. A parent can see their own family’s
fixtures, cannot see another family’s records, cannot directly mutate protected
tables, cannot update another family’s expense, and cannot affect another
family’s same-month settlement. Each denial also proves victim data is
unchanged.

### Key Discoveries

- Forced RLS and the active-parent predicate protect the five core family-owned
  tables: `supabase/migrations/20260717160000_financial_rules_foundation.sql:200-277`.
- `update_expense` derives the caller family and rejects a foreign expense before
  any mutation: `supabase/migrations/20260729170000_joint_monthly_settlement.sql:208-247`.
- `confirm_monthly_settlement` takes only a report month and derives the family
  from the caller, so the meaningful negative case is cross-family isolation,
  not a synthetic foreign-ID error: `supabase/migrations/20260729170000_joint_monthly_settlement.sql:280-344`.
- Existing suites establish transactional fixtures, JWT actor switching, and
  independent no-side-effect assertions:
  `supabase/tests/financial_rules_foundation.test.sql:1-65` and
  `supabase/tests/approved_expense_balance.test.sql:397-419,627-646`.

## What We're NOT Doing

- Changing production migrations, RLS policies, RPC implementations, grants, or
  Astro API routes.
- Adding endpoint mocks, browser/e2e tests, visual tests, or an AI-native test
  layer where pgTAP already provides the direct signal.
- Building an incremental migration-upgrade fixture without a migration that
  transforms persisted family data.
- Repeating financial lifecycle assertions already owned by
  `approved_expense_balance.test.sql` unless they establish an authorization
  postcondition.

## Implementation Approach

Create one self-contained `family_authorization_boundaries.test.sql` suite.
Seed two families and authenticated parents under a privileged fixture role,
then switch JWT subjects under the authenticated role to run the same database
paths production callers use. Use independent database state as the oracle:
visible-row counts for RLS, permission denial for direct DML, exact domain
errors for foreign expense mutations, and persisted victim-state assertions
after every rejected or isolated operation.

## Critical Implementation Details

Settlement confirmation has no caller-supplied family ID. The test must not
invent a foreign-family rejection contract; instead, give both families an
eligible past-month fixture, confirm as the second family, and prove only that
family’s settlement changes while the first family’s equivalent-month record
remains absent or unchanged.

## Phase 1: Focused Family Authorization Boundary Suite

### Overview

Add a dedicated transactional pgTAP suite that makes the complete ownership
contract easy to review and resistant to final-migration changes.

### Changes Required

#### 1. Standalone authorization integration suite

**File**: `supabase/tests/family_authorization_boundaries.test.sql`

**Intent**: Create deterministic two-family fixtures and exercise all
authorization behavior under real authenticated JWT claims, separate from the
financial lifecycle suite.

**Contract**: Follow the repository’s `begin` → `plan(N)` → `finish()` →
`rollback` convention. Seed two families, two active parents per family, child,
expense, and eligible past-month settlement inputs while privileged; then use
`set local role authenticated` and transaction-local `request.jwt.claim.sub`
and `.role` settings for each actor. Keep all fixture IDs and actor switches
inside this suite; do not introduce shared SQL test helpers.

#### 2. RLS, direct-DML, and RPC ownership matrix

**File**: `supabase/tests/family_authorization_boundaries.test.sql`

**Intent**: Prove the user-facing safety property that a signed-in parent can
work with their own family but cannot read or alter another family’s resources.

**Contract**: Assert an owned-family positive read, then assert a foreign
family’s rows are invisible across `families`, `family_members`, `children`,
`expenses`, and `monthly_settlements`. Assert direct authenticated DML remains
denied. Under the foreign parent, call `update_expense` using the victim expense
ID and assert `P0001` / `Expense is not available to this family`, followed by
an owner-visible assertion that description, date, amount, status, review, and
decline fields did not change. Exercise foreign child IDs in create/update only
where they add a distinct relationship-isolation signal. Do not mirror policy
SQL or substitute same-family happy paths for the foreign-actor contract.

#### 3. Caller-scoped settlement isolation

**File**: `supabase/tests/family_authorization_boundaries.test.sql`

**Intent**: Guard against a migration changing settlement lookup or write scope
from caller family to a globally matched report month.

**Contract**: With matching eligible past-month fixture data for both families,
confirm the report as one family’s parent and assert the other family’s
same-month settlement remains absent or unchanged. Include a positive
caller-family postcondition. Do not assert a nonexistent “foreign family” RPC
error because the RPC accepts no family identifier.

### Success Criteria

#### Automated Verification

- The new suite has a correct pgTAP assertion plan, transactional cleanup, and
  deterministic two-family/JWT fixtures.
- `npx supabase test db` passes against the local Supabase stack with the full
  migration chain applied.
- `npm test`, `npm run lint`, and `npm run build` pass without unrelated changes.

#### Manual Verification

- Review the pgTAP output to confirm each assertion names an ownership behavior
  or persisted-state consequence rather than a migration implementation detail.
- Inspect the suite after completion to confirm it rolls back fixtures and does
  not alter migrations, production SQL routines, or application routes.

**Implementation Note**: After automated verification passes, pause for human
confirmation that the named test cases express the intended family-isolation
contract before completing the rollout phase.

---

## Phase 2: Capture the RLS and Migration Regression Pattern

### Overview

Record the shipped database-test convention in the test-plan cookbook so future
RLS or RPC migrations extend the right seam rather than adding weak route mocks.

### Changes Required

#### 1. Authorization-boundary cookbook entry

**File**: `context/foundation/test-plan.md`

**Intent**: Replace the Phase 2 placeholder with the canonical location,
naming, fixture/actor-switching approach, assertions, and run command for
family-isolation regression tests.

**Contract**: In §6.2, name
`supabase/tests/family_authorization_boundaries.test.sql` as the reference
suite; state that it uses two isolated families and real JWT role switching,
tests own-family positive controls plus foreign-family invisibility, and pairs
every denied or isolated mutation with a persisted-state assertion. Preserve
the strategy’s rule that risks are scenarios, not code locations.

### Success Criteria

#### Automated Verification

- `git diff --check` passes for the new suite and cookbook update.
- The documented `npx supabase test db` command succeeds with the local stack
  running.

#### Manual Verification

- Read §6.2 as a fresh contributor and confirm it states where to add a future
  family/RLS test, what behavior to name, and the cheapest test layer.

**Implementation Note**: This documentation phase completes only after the
database suite is green; it describes the shipped pattern, not a hypothetical
one.

---

## Testing Strategy

### Unit Tests

- None. The behaviors depend on PostgreSQL role, JWT, RLS, grants, and
  `SECURITY DEFINER` execution; a unit seam would not provide meaningful signal.

### Integration Tests

- Two-family RLS visibility matrix across all core family-owned tables.
- Direct authenticated DML denial with no persisted side effects.
- Foreign-parent expense update denial with an unchanged victim expense.
- Caller-scoped settlement confirmation with matching-month isolation.
- Positive own-family controls for each protected path.

### Manual Testing Steps

1. Start local Supabase and run `npx supabase test db`.
2. Review the pgTAP names and postconditions for all foreign-actor cases.
3. Confirm the suite leaves no fixtures after rollback and Phase 2 cookbook
   guidance points to it as the canonical authorization test seam.

## Performance Considerations

The suite uses a small fixed fixture set in one transaction. It has no
application runtime cost and should remain isolated from the larger financial
lifecycle suite for faster diagnosis.

## Migration Notes

No migration is required. The suite must execute against the complete local
migration sequence because later `CREATE OR REPLACE` function definitions and
grants are the regression surface. If a future migration backfills or transforms
existing family data, open a separate change to add an upgrade-fixture contract.

## References

- Research: `context/changes/testing-family-authorization-migration-boundaries/research.md`
- Test plan: `context/foundation/test-plan.md`
- Existing pgTAP pattern: `supabase/tests/financial_rules_foundation.test.sql:1-65`
- Existing rejection/postcondition pattern: `supabase/tests/approved_expense_balance.test.sql:397-419,627-646`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Focused Family Authorization Boundary Suite

#### Automated

- [x] 1.1 Add the standalone transactional two-family pgTAP authorization suite — b30a6ab
- [x] 1.2 Cover complete RLS/direct-DML/foreign-expense ownership matrix with persisted-state assertions — b30a6ab
- [x] 1.3 Cover caller-scoped settlement isolation and positive control — b30a6ab
- [x] 1.4 Run `npx supabase test db`, `npm test`, `npm run lint`, and `npm run build` — b30a6ab

#### Manual

- [x] 1.5 Review test names, ownership oracles, and fixture rollback behavior — b30a6ab

### Phase 2: Capture the RLS and Migration Regression Pattern

#### Automated

- [x] 2.1 Update §6.2 with the shipped authorization-boundary cookbook pattern — 96ae5d9
- [x] 2.2 Run `git diff --check` and the documented database-test command — 96ae5d9

#### Manual

- [x] 2.3 Confirm §6.2 is actionable for a fresh contributor — 96ae5d9
