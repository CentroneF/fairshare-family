# Current-month named contribution split Implementation Plan

## Overview

Show the live, approved-only contribution split for both parents in the current month's existing balance card. The feature makes the current report as understandable as settled historical reports while retaining the distinction between a live balance and an immutable settlement snapshot.

## Current State Analysis

The dashboard passes the UTC current month to the shared `ExpenseWorkspace`; historical reports pass a past month to that same component. `loadExpenseWorkspaceState` derives a `MonthlyBalance`, whose `contributions` map already contains exact approved totals for each active parent. The current `MonthlyBalancePanel` renders aggregate totals and settlement guidance but does not receive parent display names or render contribution rows.

Past settled reports render stored contribution snapshots from `monthly_settlements`. Those snapshots are not appropriate for the current month, where no settled row exists and amounts must continue to derive live from approved expenses.

## Desired End State

On the dashboard for a two-parent family, the Monthly balance card shows both parents' display names and each person's approved contribution, including `0.00 PLN` where applicable. Pending expenses remain only in To review, declined expenses remain excluded, and background expense actions refresh the new split together with the existing totals. Historical reports and the hidden current-month settlement action retain their present behavior.

### Key Discoveries:

- `deriveMonthlyBalance` already maintains exact approved contributions keyed by parent membership ID in `src/lib/financial-rules.ts:36`.
- `ExpenseWorkspace` is shared by the dashboard and `/reports/[month]`, so the current-month guard must be explicit in `src/components/expenses/ExpenseWorkspace.astro:31`.
- The financial repository currently loads only parent IDs in `src/lib/financial-service.ts:65`; display names are available on `family_members` and already used for expense attribution in `src/lib/expense-balance.ts:547`.
- Current-month settlement presentation is intentionally suppressed by `shouldRenderUnavailableSettlementPanel` in `src/lib/expense-balance.ts:419` and must remain so.

## What We're NOT Doing

- Changing balance, approval, rounding, or settlement calculations.
- Including pending or declined expenses in either parent's contribution.
- Changing past-month, open-settlement, or settled-report contribution presentation.
- Adding a database migration, RPC, new route, or client-side state store.
- Reintroducing a current-month settlement button or dialog.

## Implementation Approach

Extend the existing family-member read model to expose the two active parents' display names alongside their membership IDs, carry that metadata through the expense workspace state, and use the balance's existing contribution map to render named rows only when the workspace month is the current UTC month. Keep the balance derivation as the single source of financial truth; the presentation layer only formats its exact Decimal values.

## Phase 1: Named Current-Month Split

### Overview

Deliver the complete dashboard-visible split, including its server read model and regression coverage, in one manually verifiable vertical slice.

### Changes Required:

#### 1. Active-parent balance read model

**Files**: `src/lib/financial-service.ts`, `src/lib/expense-balance.ts`

**Intent**: Return the active parents' stable membership IDs and display names with the existing family-scoped balance inputs, then expose those parents in `ExpenseWorkspaceState` without altering financial calculations or authorization boundaries.

**Contract**: The active-parent repository seam preserves its deterministic membership order and family/role/active filters while selecting `display_name`; `loadMonthlyBalance` continues to derive totals and contributions from the two membership IDs only. Workspace state supplies the two named parent records needed to render `balance.contributions`, with a safe generic fallback only for an unexpected missing display name.

#### 2. Current-month balance presentation

**Files**: `src/components/expenses/ExpenseWorkspace.astro`, `src/components/expenses/MonthlyBalancePanel.astro`

**Intent**: Pass named active-parent metadata and the current-month condition into the existing balance card, then show both approved contribution rows below the aggregate totals and before balance guidance on the dashboard.

**Contract**: Render the section only when the displayed month equals the workspace's UTC current month and a two-parent balance exists. Each row shows the active parent's display name and its exact `balance.contributions` amount formatted to two PLN decimals; a missing approved contribution is displayed as `0.00 PLN`. Do not render it in historical workspaces, and preserve the existing total, approved, to-review, settlement guidance, responsive layout, and current-month settlement-action suppression.

#### 3. Focused regression coverage

**Files**: `src/lib/financial-rules.test.ts`, `src/lib/expense-balance.test.ts`, plus a focused new or colocated presentation test if the repository's Astro test setup supports it

**Intent**: Lock down the named current split's source data and the behavior boundaries that prevent it leaking into past reports or counting unreviewed expenses.

**Contract**: Cover two named parents with unequal approved contributions, one parent with no approved contribution, pending and declined exclusion, and metadata mapping from the family-member repository seam. Add a rendering-level assertion where supported that current workspaces show both names and exact values while historical workspaces do not; retain the current-month settlement suppression assertion.

### Success Criteria:

#### Automated Verification:

- Focused financial and workspace-state tests prove exact approved-only contribution totals, named active-parent metadata, and zero contribution handling.
- A component/render test, or the closest existing test seam, proves the current-month-only display guard and preserves historical behavior.
- Full project verification passes: `npm run verify`.

#### Manual Verification:

- Open the dashboard as either parent and confirm the Monthly balance card shows both names and correct approved totals, including a zero row if only one parent has approved expenses.
- Add or review an expense and confirm the background refresh updates the split, totals, and To review without a page reload.
- Open a prior-month report and confirm its existing presentation is unchanged and no live named split is shown.

**Implementation Note**: After completing this phase and all automated verification passes, pause for human confirmation that the dashboard and historical-report checks succeeded before considering the change complete.

---

## Testing Strategy

### Unit Tests:

- Preserve Decimal-safe contribution aggregation for approved expenses.
- Verify pending expenses contribute only to To review and declined expenses remain excluded.
- Verify both active parents receive a displayed row when one contribution is zero.
- Verify active-parent metadata remains family-scoped and ordered consistently with the financial calculation.

### Integration Tests:

- Exercise the existing repository seam with two active parent records containing display names and monthly expense rows.
- Confirm a rendered current workspace receives named parent contributions while a selected past workspace does not.

### Manual Testing Steps:

1. Sign in to a two-parent family and open `/dashboard`.
2. Compare the two displayed contributions with approved expenses for the current month.
3. Create or approve an expense and verify the updated split arrives through the existing background refresh.
4. Navigate to `/reports/<past-month>` and verify the new section is absent.

## Performance Considerations

The change extends an existing small active-parent query (at most two rows) with `display_name`; it adds no new per-expense queries, client-side polling, or database writes.

## Migration Notes

No migration is required. `family_members.display_name` is an existing field, and current contributions continue to be derived from approved expense rows rather than settlement snapshots.

## References

- Balance derivation: `src/lib/financial-rules.ts:36`
- Financial repository: `src/lib/financial-service.ts:65`
- Workspace composition and refresh: `src/components/expenses/ExpenseWorkspace.astro:31`
- Current balance presentation: `src/components/expenses/MonthlyBalancePanel.astro:35`
- Historical workspace route: `src/pages/reports/[month].astro:18`
- Settlement snapshot contract: `supabase/migrations/20260729170000_joint_monthly_settlement.sql:1`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Named Current-Month Split

#### Automated

- [x] 1.1 Add named active-parent metadata to the balance workspace state. — be739af
- [x] 1.2 Render exact approved contributions only for the current-month balance card. — be739af
- [x] 1.3 Add focused split and display-boundary regression coverage. — be739af
- [x] 1.4 Run `npm run verify`. — be739af

#### Manual

- [x] 1.5 Verify both named contributions and background refresh on the dashboard. — be739af
- [x] 1.6 Verify historical reports remain unchanged. — be739af
