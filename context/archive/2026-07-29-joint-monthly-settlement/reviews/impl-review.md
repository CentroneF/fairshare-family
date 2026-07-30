<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Joint Monthly Settlement Implementation Plan

- **Plan**: `context/changes/joint-monthly-settlement/plan.md`
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-07-30
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | FAIL |

## Verification Evidence

- `npm test -- --run`: PASS — 3 files, 25 tests
- `npm run lint`: PASS
- `npm run build`: PASS
- `npx supabase test db`: PASS — 3 files, 135 assertions
- Manual Progress rows: all marked complete; Phase 3 stale-edit feedback was explicitly retested and confirmed by the user.

## Findings

### F1 — Create form remains available after background settlement confirmation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `src/components/expenses/ExpenseWorkspace.astro:51`
- **Detail**: The create-expense region has no stable refresh container, while `refreshExpenseWorkspace()` replaces only the balance, expense list, and history at lines 89–105. After the first confirmation succeeds in the background, the balance and list show the lock but the existing create form remains visible and enabled until a full reload. The RPC safely rejects submission, but the plan requires the report to freeze visibly and expose no mutation action immediately.
- **Fix**: Add a stable create-region container and include it in workspace fragment refresh; move create-form submission to the always-present delegated workspace script so a replaced form retains background behavior.
  - Strength: Makes the entire workspace reflect the lock atomically and follows the established settlement/edit handling pattern.
  - Tradeoff: Moves another component-local handler into the workspace coordinator and adds one refreshed fragment.
  - Confidence: HIGH — the same fragment-script issue was reproduced and fixed for settlement and edit dialogs.
  - Blind spot: A browser-level regression test is still manual because the plan excludes a new E2E framework.
- **Decision**: SKIPPED

### F2 — One-parent settlement guidance is derived but never rendered

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: `src/components/expenses/ExpenseWorkspace.astro:62`
- **Detail**: `loadExpenseWorkspaceState()` intentionally sets `balance` to null unless exactly two parents exist (`src/lib/expense-balance.ts:484`), and the workspace renders `MonthlyBalancePanel` only when `state.balance` is present. Although the server derives `settlement.reason = "one-parent"`, a one-parent family sees neither the disabled Confirm settlement action nor its required visible and tooltip guidance.
- **Fix**: Render a dedicated unavailable-settlement card for the null-balance/one-parent state, reusing the existing reason text and disabled-action accessibility contract.
  - Strength: Satisfies the planned guidance without inventing a financially misleading one-parent balance.
  - Tradeoff: Adds a small presentation branch outside the balance panel.
  - Confidence: HIGH — the render gate and null-balance branch make the missing state deterministic.
  - Blind spot: The final placement should be checked once on the narrow viewport.
- **Decision**: SKIPPED

### F3 — Migrated unconfirmed open rows cannot receive a first confirmation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20260729170000_joint_monthly_settlement.sql:313`
- **Detail**: A pre-existing valid `open` settlement row with `first_confirmed_by IS NULL` bypasses the “insert first confirmation” branch because its row ID already exists. The function then takes the finalization path and attempts a settled row with no first confirmer, violating the original settled-state constraint. The migration notes explicitly require existing open rows to remain valid.
- **Fix**: Add a new forward-only migration that replaces the RPC so an existing unconfirmed open row is updated with the caller as first confirmer and returned; add a pgTAP fixture for this migrated state.
  - Strength: Preserves incremental migration safety and repairs the exact legacy state without editing an applied migration.
  - Tradeoff: Adds another migration and one compatibility branch to the RPC.
  - Confidence: HIGH — the current branch conditions deterministically reach the constraint violation.
  - Blind spot: Production may contain no such rows, but the schema allowed them before this feature.
- **Decision**: SKIPPED

### F4 — Successful confirmation followed by refresh failure gives invisible, misleading feedback

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: `src/components/expenses/ExpenseWorkspace.astro:193`
- **Detail**: The confirmation handler closes the dialog immediately after the POST succeeds, then refreshes fragments. If that GET, parse, or replacement fails, the catch writes an error into the already-closed dialog. The page remains stale with no visible feedback; retrying can then report “already confirmed,” even though the original confirmation succeeded.
- **Fix**: Track POST success separately, close the dialog only after refresh succeeds, and show a visible “confirmed, but the view could not refresh—reload” recovery message when only the refresh fails.
  - Strength: Accurately distinguishes command failure from view-refresh failure and prevents a hidden error.
  - Tradeoff: Adds a small two-stage state path to the client handler.
  - Confidence: HIGH — the current close-before-await ordering directly produces the hidden state.
  - Blind spot: Network-failure behavior remains manually verified without browser fault injection.
- **Decision**: FIXED

### F5 — Final-settlement mutation coverage is not complete for every command

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: `supabase/tests/approved_expense_balance.test.sql:394`
- **Detail**: pgTAP directly exercises all five mutation commands after first confirmation, and exercises create plus older update/delete cases for settled months. It does not directly assert approve and decline rejection after final settlement, despite the testing strategy promising all five commands after both lock states.
- **Fix**: Add focused settled-month pending fixtures and assert both `approve_expense` and `decline_expense` return the lock error.
- **Decision**: FIXED
