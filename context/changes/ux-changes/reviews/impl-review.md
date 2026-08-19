<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: UX Changes Implementation Plan

- **Plan**: context/changes/ux-changes/plan.md
- **Scope**: Phases 1–4 of 4
- **Date**: 2026-08-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Signup endpoint accepts invalid display names

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/auth/signup.ts:4
- **Detail**: The endpoint type-asserts `displayName` and only the client validates it. A direct request without the field throws at `displayName.trim()`, and an invalid non-empty value creates an Auth account whose create/join flow later rejects its metadata. The dashboard completion form is only available after membership, leaving that account without a UI recovery path.
- **Fix**: Validate with the shared `formValue` and `normalizeDisplayName` boundary before `auth.signUp`, redirect with its mapped validation error, and add direct-POST coverage.
  - Strength: Reuses the established onboarding contract and prevents invalid metadata from entering the account flow.
  - Tradeoff: Requires an API-level test and explicit redirect error handling.
  - Confidence: HIGH — the shared normalizer already defines the required 5–15-character contract.
  - Blind spot: None significant.
- **Decision**: FIXED — server-side validation added on 2026-08-19.

### F2 — Current-month settlement has no explanation

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/expenses/MonthlyBalancePanel.astro:75
- **Detail**: The current-month branch correctly removes `SettlementConfirmationDialog`, but it bypasses both the disabled CTA and `unavailableSettlementMessage`. The remaining balance guidance only describes who owes whom, so it does not explain that settlement becomes available after the month ends, contrary to the Phase 3 contract.
- **Fix**: Render the existing current-month unavailable message as standalone explanatory text while omitting the confirmation dialog and disabled CTA.
  - Strength: Meets the requested UX without changing settlement eligibility or historical-report behavior.
  - Tradeoff: Needs a focused presentation-boundary test in addition to the existing helper test.
  - Confidence: HIGH — `unavailableSettlementMessage` is already computed for this state.
  - Blind spot: None significant.
- **Decision**: SKIPPED

### F3 — Desktop identity is not presented on separate lines

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/DashboardNavigation.astro:17
- **Detail**: Phase 4 requires desktop navigation to show display name, then email on its own line, then Sign out. The implementation uses one wrapping flex row and parenthesizes the email, so line placement varies with sidebar width.
- **Fix**: Replace the desktop identity flex row with stacked name and email text elements.
- **Decision**: FIXED — plan corrected to require the implemented flex-row identity layout on 2026-08-19.

### F4 — Phase 4 changed the mobile navigation drawer

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/components/DashboardNavigation.astro:85
- **Detail**: The Phase 4 contract explicitly keeps the mobile drawer unchanged, but it changes the identity from two lines to inline parenthesized email and alters mobile navigation link layout at lines 119–128. The desktop-only change therefore expands into mobile behavior.
- **Fix**: Restore the mobile identity and link markup/classes from before commit `f30a4b0`; retain only the desktop identity update.
- **Decision**: FIXED — Phase 4 plan updated to include the implemented mobile drawer layout on 2026-08-19.

### F5 — Profile RPC can report success after a racing update

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260819153000_distinguish_display_name_completion_errors.sql:32
- **Detail**: The immutable-name RPC selects the current value, then conditionally updates only a null value, but does not check whether that update affected a row. Two concurrent submissions can both see null; the losing request then returns success despite saving nothing.
- **Fix**: Check `FOUND` after the `UPDATE` and raise the existing already-set error when no row changed; add a zero-row/concurrency regression test.
  - Strength: Preserves one-time immutability and makes API success truthful.
  - Tradeoff: Concurrency is difficult to reproduce in the current database test harness.
  - Confidence: HIGH — PostgreSQL exposes `FOUND` for precisely this update result.
  - Blind spot: Exact concurrent-client behavior has not been exercised against the local stack.
- **Decision**: SKIPPED

### F6 — Necessary Phase 1 support changes are unlisted

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: src/pages/api/family/create.ts:12
- **Detail**: The implementation also updates the create/join API adapters, two corrective display-name migrations, and an existing onboarding database test. These are functionally necessary to pass display names through the planned RPC contracts and enforce immutability, but they are not in the plan's file lists.
- **Fix**: Add a concise plan addendum listing the support adapters, corrective migrations, and test update.
- **Decision**: FIXED — Phase 1 plan addendum added on 2026-08-19.

### F7 — Completed manual checks have no recorded evidence

- **Severity**: 👁️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/ux-changes/plan.md:376
- **Detail**: All four manual-verification checkboxes are marked complete, but the commits and change notes contain no screenshots, test-session notes, or other observable evidence for the responsive and browser-only checks. The code supports the intended behavior, but the completion marks cannot be independently verified from the repository.
- **Fix**: Add concise manual-test evidence to the change notes (viewport/state checked and result) or rerun and record it.
- **Decision**: SKIPPED

## Verification

| Command | Result | Output |
|---------|--------|--------|
| `npx supabase test db` | PASS | 6 files, 223 tests successful. |
| `npm test` | PASS | 8 files, 50 tests passed. |
| `npm run lint` | PASS with warnings | 0 errors; 2 existing `no-console` warnings in `src/worker.ts`, outside this change. |
| `npm run build` | PASS | Astro production build, PWA generation, and PWA verification completed. |

## Scope Evidence

- Reviewed implementation commits: `f47670e`, `50bdcbb`, `8a162a1`, `f30a4b0`.
- All 17 plan-listed implementation files have corresponding changes; no planned file is missing.
- Database and unit-test gates cover display-name validation, one-time update authorization, existing RLS boundaries, onboarding state, expense mapping, and settlement-state logic.
