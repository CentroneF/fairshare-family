<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Financial Rules Verification Implementation Plan

- **Plan**: `context/changes/financial-rules-verification/plan.md`
- **Scope**: Full plan (4 of 4 phases)
- **Date**: 2026-07-17
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 2 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|---|---|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | WARNING |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — pgTAP suite does not exercise RLS or financial constraints

- **Severity**: ⚠️ WARNING
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Plan Adherence
- **Location**: `supabase/tests/financial_rules_foundation.test.sql:1`
- **Detail**: The approved plan requires isolated auth users, two families, fixtures, denied direct writes, cross-family access checks, self-review, and two-parent-cap checks. The current four tests only assert table existence, RLS flags, and the absence of mutation policies. They do not prove RLS behavior under authenticated JWT roles or the migration constraints.
- **Fix ⭐ Recommended**: Add transactional fixtures and pgTAP assertions that switch authenticated identities and exercise the stated constraints.
  - Strength: Verifies the actual security boundary rather than its catalog configuration.
  - Tradeoff: Adds SQL test setup and uses Supabase auth/JWT test helpers.
  - Confidence: HIGH — this is explicitly required by the approved plan.
  - Blind spot: Exact local helper syntax must be confirmed against the installed pgTAP/Supabase test image.
- **Decision**: IMPLEMENTED — Phase 5 (`132c9e2`)

### F2 — Financial service lacks the planned Supabase repository adapter

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: `src/lib/financial-service.ts:17`
- **Detail**: The plan calls for a server-only module that accepts a request-scoped Supabase client and loads only user-visible records. The implementation defines a `FinancialRepository` interface and accepts a caller-supplied `userId`, but no adapter accepts the existing `createClient()` result or performs the family/month queries. The future S-02 caller would still need to build that missing boundary.
- **Fix ⭐ Recommended**: Add a server-only Supabase-backed repository factory using the request-scoped client, while retaining the small interface for tests.
  - Strength: Meets the planned integration contract and keeps unit tests simple.
  - Tradeoff: Requires typing/select mapping for the new tables before generated database types exist.
  - Confidence: HIGH — the existing `src/lib/supabase.ts` helper was named as the intended integration point.
  - Blind spot: The exact data-loading shape may evolve with S-02’s route design.
- **Decision**: PENDING
