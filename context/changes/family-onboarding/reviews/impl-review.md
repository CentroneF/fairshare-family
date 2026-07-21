<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Family Onboarding Implementation Plan

- **Plan**: context/changes/family-onboarding/plan.md
- **Scope**: Phases 1–3 of 3
- **Date**: 2026-07-21
- **Verdict**: APPROVED
- **Findings**: 0 critical, 0 unresolved; 2 fixed

## Verification Evidence

- `npm test` — PASS: 2 files, 10 tests.
- `npx supabase test db` — PASS: 2 files, 34 tests.
- `npm run lint` — PASS.
- `npm run build` — PASS.
- After triage: `npm test`, `npm run lint`, and `npm run build` — PASS.
- All Phase 3 manual Progress rows are marked complete. The user confirmed the manual flow during this review session; however, F1 shows one recorded manual behavior is absent from the final source.

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Unsaved child rows cannot be removed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Plan Adherence / Success Criteria
- **Location**: src/components/family/FamilySetupPanel.astro:44
- **Detail**: Phase 3 requires the setup panel to permit adding and removing unsaved child rows. The final server-rendered panel can append inputs with `Add another child`, but provides no removal control. Every added input is `required`, so a user who adds a row accidentally must fill it before submitting. This also conflicts with the completed 3.6 manual Progress row.
- **Fix**: Add a labelled remove button next to each dynamically added child input; keep the first row and remove only added unsaved rows.
  - Strength: Restores the explicit Phase 3 interaction without changing the database or API contract.
  - Tradeoff: Small client-side DOM update and a focused manual retest.
  - Confidence: HIGH — the earlier React implementation already used this interaction.
  - Blind spot: None significant.
- **Decision**: FIXED — added removable, labelled unsaved-child rows.

### F2 — Join-confirmation dialog does not contain keyboard focus

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped.
- **Dimension**: Safety & Quality
- **Location**: src/components/family/JoinFamilyForm.tsx:71
- **Detail**: The dialog sets `role="dialog"`, `aria-modal="true"`, focuses the confirm button, and supports Escape, but Tab can move focus to controls behind the overlay. The Phase 3 contract explicitly requires focus management for the dialog; moving initial focus alone does not keep keyboard interaction within a modal dialog.
- **Fix**: Add a small focus trap for Tab/Shift+Tab and return focus to the code input when the dialog closes.
  - Strength: Meets the modal interaction contract while preserving the current POST confirmation flow.
  - Tradeoff: A small amount of keyboard-event handling to test manually.
  - Confidence: HIGH — the dialog has exactly two focusable controls.
  - Blind spot: None significant.
- **Decision**: FIXED — added modal Tab/Shift+Tab handling and focus return to the code field.
