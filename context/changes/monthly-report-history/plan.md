# Monthly Report History Implementation Plan

## Overview

Add a read-only, collapsible history of prior family reports to the dashboard. Each meaningful prior month shows an exact approved total and an explicit Settled or Unsettled state; selecting it uses the existing selected-month dashboard view rather than introducing a second reporting surface.

## Current State Analysis

The dashboard already accepts `?month=YYYY-MM`, validates it as current or past, and displays that month's expenses and derived balance. Users cannot discover prior reports without manually changing the month, and there is no visible settlement state. `monthly_settlements` is already family-scoped and readable under RLS, but it has no report-history UI.

## Desired End State

An active family parent can expand a History section on the dashboard. It lists earlier months that contain expenses or a settlement record in descending order, with a clear Settled/Unsettled badge and exact approved total. Choosing a row navigates to the existing month-selected report, which remains the only detailed report view. With no qualifying earlier months, the section explains that no previous reports exist.

### Key Discoveries:

- Dashboard month navigation and report rendering are already centralized in `src/pages/dashboard.astro:27` and `src/components/expenses/ExpenseWorkspace.astro:23`.
- `monthly_settlements` has a unique family/month key and RLS-protected `SELECT`; only status `settled` locks a month (`supabase/migrations/20260717160000_financial_rules_foundation.sql:65`, `:272`).
- Amounts must stay derived from source expenses, not stored as report aggregates (`src/lib/financial-service.ts:99`; `context/changes/financial-rules-verification/plan.md:32`).
- Existing background refresh intentionally replaces only the selected report's balance/list fragments; history may update on the next navigation, by product decision (`src/components/expenses/ExpenseWorkspace.astro:73`).

## What We're NOT Doing

- Settlement confirmation, locking, or any mutation of `monthly_settlements`; S-05 owns those actions.
- A dedicated reports route, duplicated expense-list/detail UI, report snapshots, cached aggregates, pagination, or export.
- History entries for every empty calendar month.
- Immediate history-fragment refresh after background expense mutations.

## Implementation Approach

Extend the existing server-side expense-balance seam with a batched family-scoped history read model. It will query prior expense rows and settlement rows through the request-scoped RLS client, merge their month keys, derive each row's approved total through the established exact financial rules, and classify only `settled` rows as Settled. Pass that read model into a small Astro history component inside `ExpenseWorkspace`; each row is a normal dashboard month link, preserving the existing GET fallback and selected report.

## Critical Implementation Details

History must exclude the current calendar month even when the currently selected dashboard month is historical. A missing settlement row and an `open` row are both Unsettled. Keep the history outside `refreshExpenseWorkspace()` replacement targets: the agreed behavior is that it updates on a subsequent dashboard navigation, while the selected balance/list retain their background-refresh behavior.

## Phase 1: Build the Historical Report Read Model

### Overview

Create one exact, family-scoped source of prior report rows without adding a migration, mutation endpoint, or cached totals.

### Changes Required:

#### 1. History state and batched repository reads

**Files**: `src/lib/expense-balance.ts`, `src/lib/financial-service.ts`

**Intent**: Load the available prior report months efficiently and consistently with the dashboard's existing financial rules.

**Contract**: Add a typed history entry containing `month`, `status: "settled" | "unsettled"`, and exact `approvedAmount`. Query only the current family through the request-scoped Supabase client: prior expense rows supply date, amount, payer, and status; prior settlement rows supply month/status. Union their first-of-month keys, exclude the current month, sort descending, and derive each approved total through the existing Decimal-safe financial rule path. A matching `settled` row is Settled; an `open` or absent row is Unsettled. Extend `ExpenseWorkspaceState` (or a focused companion loader) without trusting a client-supplied family or status.

#### 2. Read-model tests

**Files**: `src/lib/expense-balance.test.ts`, `src/lib/financial-service.test.ts`

**Intent**: Protect exact summary, month-selection, and status semantics before UI wiring.

**Contract**: Cover descending prior-month grouping, exclusion of the current month, approved-only totals (pending/declined excluded), exact two-decimal amounts, settlement-only months, and open/missing-versus-settled classification. Keep test doubles at the existing repository/client seam; do not introduce float arithmetic.

### Success Criteria:

#### Automated Verification:

- Unit tests prove prior-month filtering, descending order, exact approved totals, and settlement status mapping.
- `npm test` and `npm run lint` pass.

#### Manual Verification:

- With multiple prior months, inspect the loaded history data and confirm only meaningful earlier months are present in newest-first order.

**Implementation Note**: Pause for manual confirmation before Phase 2. This phase is read-only; no migration, route, or direct table-write policy is permitted.

---

## Phase 2: Add the Collapsible Dashboard History

### Overview

Expose history as a concise, accessible dashboard section that navigates the existing monthly report.

### Changes Required:

#### 1. History component and workspace integration

**Files**: `src/components/expenses/MonthlyReportHistory.astro`, `src/components/expenses/ExpenseWorkspace.astro`

**Intent**: Let parents discover and browse historical reports without duplicating the selected-month balance or expense list.

**Contract**: Render a collapsed-by-default native disclosure section below the selected-month report. For each history entry show a human-readable month, text badge `Settled` or `Unsettled` (with an optional supporting lock cue), and the exact approved total in PLN. Each entry is a normal `/dashboard?month=YYYY-MM` link; the selected historical month is visibly identified. Render the agreed empty message when the collection is empty. Keep narrow-screen layout single-column/tap-friendly and do not add client-side navigation state.

#### 2. Dashboard regression coverage

**Files**: `src/components/expenses/MonthlyReportHistory.astro`, `src/components/expenses/ExpenseWorkspace.astro`, relevant unit tests under `src/lib/`

**Intent**: Preserve the existing selected-month report and background submission behavior while adding a static history surface.

**Contract**: Ensure the history component receives server-derived rows only, keeps its normal-link fallback, and is not replaced by `refreshExpenseWorkspace()`. Retain the existing balance/list fragment IDs and month URL behavior. Add focused component-adjacent assertions only where supported by current test conventions; do not add a browser E2E framework.

### Success Criteria:

#### Automated Verification:

- `npm test`, `npm run lint`, and `npm run build` pass.

#### Manual Verification:

- Expand and collapse History on desktop and a narrow Android-sized viewport; status badges and approved totals remain readable.
- Select a prior row and confirm the existing dashboard switches to that month with its expense list and balance.
- Confirm the empty state appears for a family with no qualifying earlier report months.

**Implementation Note**: Pause for manual confirmation before Phase 3. A history-row navigation is intentionally a normal GET navigation; background form submissions keep their existing no-full-page-refresh behavior.

---

## Phase 3: Prove Family Visibility and Reporting Boundaries

### Overview

Exercise the complete history behavior against the real RLS boundary and guard the settled/unsettled reporting contract for future settlement work.

### Changes Required:

#### 1. Family-scoped history integration fixtures

**Files**: `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Demonstrate that history source rows remain family-private and that settlement status can be read without granting mutations.

**Contract**: Extend the existing multi-family fixtures with prior expense and settlement cases. Under authenticated parent claims, prove own-family prior expense/settlement rows are readable and another family's rows are not. Cover a settled row, an open or absent row, and a prior expense month. Preserve assertions that direct settlement mutation is denied; do not add an RPC or migration.

#### 2. End-to-end report-history regression checks

**Files**: `src/lib/expense-balance.test.ts`, `src/components/expenses/MonthlyReportHistory.astro`, `src/components/expenses/ExpenseWorkspace.astro`

**Intent**: Keep the history contract aligned with exact financial calculations and the dashboard's selected-month behavior.

**Contract**: Exercise representative approved, pending, and declined source data across multiple months, then verify the history read model and rendered inputs preserve approved-only totals and state labels. Maintain the rule that history does not synchronously refresh after a background expense mutation; a subsequent month navigation supplies fresh server-rendered history.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` proves family-only read visibility and unchanged direct settlement-write denial.
- `npm test`, `npm run lint`, and `npm run build` pass with multi-month history regression coverage.

#### Manual Verification:

- As each parent in a family, browse the same history and confirm no other family's report month can appear.
- Verify settled and unsettled rows remain clearly distinguishable after navigating between past months.
- Submit an expense change in the background, then navigate to a month and confirm history is freshly server-rendered without losing the selected report's background-refresh behavior.

**Implementation Note**: Pause for final manual confirmation before treating this change as complete.

## Testing Strategy

### Unit Tests:

- Prior-month union/grouping, current-month exclusion, descending order, and no-report empty input.
- Exact approved totals with pending and declined rows excluded.
- `settled` versus `open`/missing settlement classification.

### Integration Tests:

- Authenticated family members can read only their family's expense and settlement source rows.
- Direct authenticated settlement mutations remain unavailable.
- Existing current/past month selection keeps its validation boundary.

### Manual Testing Steps:

1. Create or use prior-month expense data, open the collapsed History section, and check newest-first month, badge, and approved total values.
2. Follow a history row and confirm the existing dashboard shows that month’s balance and expenses.
3. Check the empty state on a family with no prior expenses or settlement rows.
4. Check history on desktop and narrow Android-sized viewport.
5. Confirm a background expense mutation retains its current balance/list refresh and history reflects new data after the next dashboard navigation.

## Performance Considerations

The MVP makes two bounded family-scoped history reads rather than one balance request per month: a projected prior-expense read and a settlement read, then groups in server-side TypeScript. The existing `(family_id, expense_date, status)` and `(family_id, report_month)` indexes support these reads. Do not add aggregate storage or N+1 monthly balance queries without evidence of a volume need.

## Migration Notes

No migration is required. `monthly_settlements` already supplies the protected read state, and its absence deliberately means Unsettled. Do not alter existing applied migrations, RLS policies, or grants.

## References

- Product requirement: `context/foundation/prd.md:90`
- Roadmap slice: `context/foundation/roadmap.md:113`
- Dashboard month routing: `src/pages/dashboard.astro:27`
- Existing selected-month workspace: `src/components/expenses/ExpenseWorkspace.astro:23`
- Exact financial calculations: `src/lib/financial-rules.ts:36`
- Family-only settlement RLS: `supabase/migrations/20260717160000_financial_rules_foundation.sql:272`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Build the Historical Report Read Model

#### Automated

- [x] 1.1 History read-model unit tests prove prior-month filtering, exact approved totals, and settlement status mapping. — 138229d
- [x] 1.2 History server-state lint passes. — 138229d

#### Manual

- [x] 1.3 Inspect multiple prior report rows and confirm meaningful months appear newest first. — 138229d

### Phase 2: Add the Collapsible Dashboard History

#### Automated

- [x] 2.1 Dashboard history component and selected-month regression tests pass. — 60015f9
- [x] 2.2 History UI lint and production build pass. — 60015f9

#### Manual

- [x] 2.3 Check collapsed history, row navigation, and empty state on desktop and narrow viewport. — 60015f9

### Phase 3: Prove Family Visibility and Reporting Boundaries

#### Automated

- [x] 3.1 Database history-source visibility and direct-settlement-denial tests pass.
- [x] 3.2 Complete multi-month history unit tests, lint, and production build pass.

#### Manual

- [x] 3.3 Confirm both parents see only their family’s settled/unsettled history and navigation remains correct.
- [x] 3.4 Confirm background expense refresh remains intact and history refreshes on later navigation.
