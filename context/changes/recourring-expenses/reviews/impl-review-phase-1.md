<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Recurring monthly expenses implementation plan

- **Plan**: context/changes/recourring-expenses/plan.md
- **Scope**: Phase 1 of 3
- **Date**: 2026-08-18
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 1 observation

## Verification evidence

- `npx supabase test db` — PASS: 4 files, 184 tests.
- `npm run verify` — PASS: Vitest (6 files, 40 tests), ESLint, and production build including PWA verification.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Current-month template edits are permitted

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260818171000_allow_current_month_recurring_template_edits.sql:41
- **Detail**: The plan requires edits to affect only months after the current materialized period. `update_recurring_expense` updates the schedule and financial fields without a current/future-period guard; the pgTAP suite explicitly accepts a current-month edit at `supabase/tests/approved_expense_balance.test.sql:697`. This permits changing a template after its current-month occurrence has been materialized in Phase 2, weakening the occurrence's audit meaning.
- **Fix**: Reject edits to the current materialized month (or make all edits effective from next month) and add no-side-effect pgTAP coverage.
  - Strength: Preserves the template/occurrence boundary that Phase 2 depends on.
  - Tradeoff: The UI must explain when a changed schedule first takes effect.
  - Confidence: HIGH — the contract explicitly requires future-only effects.
  - Blind spot: The exact Phase 2 occurrence schema is not implemented yet.
- **Decision**: FIXED — effective-dated revisions added in `20260818172000_effective_dated_recurring_expense_revisions.sql`; edits now create or replace a next-month revision, leave the current template unchanged, and display the scheduled effective month.

### F2 — Stopped templates remain editable through the RPC

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260818171000_allow_current_month_recurring_template_edits.sql:33
- **Detail**: `set_recurring_expense_active` rejects a resumed archived template, but `update_recurring_expense` does not check `archived_at`. A payer can therefore call the granted update RPC and rewrite a stopped template's description, child, amount, and date range.
- **Fix**: Reject updates when `archived_at IS NOT NULL`, with a pgTAP assertion that the row is unchanged after the failed call.
- **Decision**: FIXED — `20260818173000_prevent_stopped_recurring_expense_edits.sql` rejects updates to archived templates; pgTAP proves the rejected call preserves the scheduled revision.

### F3 — The management UI diverges from the planned workspace integration

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: src/components/expenses/ExpenseWorkspace.astro:1
- **Detail**: The plan requires a “Recurring expenses” section in `ExpenseWorkspace.astro`. That component was not changed; the implementation instead adds a separate `/recurring-expenses` page plus navigation links. The behavior is largely present, but the dashboard location and existing workspace integration specified in the plan are not.
- **Fix**: Either integrate the management section into `ExpenseWorkspace.astro`, or amend the approved plan to explicitly adopt the standalone page and navigation route.
  - Strength: Restores a single, reviewable source of truth for the chosen product flow.
  - Tradeoff: Integration changes the delivered navigation, while a plan amendment accepts the separate page.
  - Confidence: HIGH — the current component diff confirms the plan's named integration point was untouched.
  - Blind spot: No user-feedback evidence identifies which location users prefer.
- **Decision**: FIXED — plan amended to explicitly adopt the standalone `/recurring-expenses` management page and dashboard navigation wiring.

### F4 — Update, pause/resume, and stop endpoints lack the established form fallback

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/pages/api/recurring-expenses/update.ts:5
- **Detail**: These endpoints always return JSON. The analogous expense handlers negotiate the `Accept` header and redirect ordinary form submissions. The plan explicitly calls for established JSON/form error patterns; without JavaScript, the recurrence controls expose raw JSON instead of returning to the management view.
- **Fix**: Add the existing `acceptsJson` branching and redirect success/error handling to the recurrence-management view for update, status, and stop.
- **Decision**: SKIPPED

### F5 — Required negative authorization and no-side-effect coverage is incomplete

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: supabase/tests/approved_expense_balance.test.sql:670
- **Detail**: The pgTAP additions cover cross-family child validation and the other parent, but do not demonstrate that an outsider/cross-family caller cannot manage a template or that rejected mutation calls leave the template unchanged. Both are explicit Phase 1 contract requirements.
- **Fix**: Extend the fixture tests with outsider/cross-family target-template mutations and before/after row assertions for rejected calls.
  - Strength: Directly proves the authorization and atomicity requirements stated in Phase 1.
  - Tradeoff: Adds fixture setup and several integration assertions.
  - Confidence: HIGH — the existing two-family test structure already supports these boundaries.
  - Blind spot: None significant.
- **Decision**: SKIPPED — deferred for now

### F6 — Manual verification is marked complete without reviewable evidence

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/recourring-expenses/plan.md:212
- **Detail**: Progress marks the browser verification complete, but the Phase 1 implementation commit contains no browser test, screenshot, or recorded manual-test result to substantiate payer/other-parent UI behavior. Automated checks passed, but this review cannot independently verify the completed manual criterion.
- **Fix**: Record the manual test evidence (accounts/steps/results and screenshots if available) in the change notes or test artifact.
- **Decision**: SKIPPED
