<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Recurring monthly expenses implementation plan

- **Plan**: context/changes/recourring-expenses/plan.md
- **Scope**: All completed phases (3 of 3)
- **Date**: 2026-08-19
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 5 warnings, 0 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | WARNING |

## Findings

### F1 — Future end-date revisions can prevent materialization

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260819110000_recurring_expense_occurrences.sql:49
- **Detail**: The generator filters candidates using the base template's `start_date` and `end_date` before reading an effective-dated revision. A payer who changes an August-ending template in August to run through September (or without an end date) creates a valid September revision, but the September execution excludes the base row and never reads that revision. This violates the future-only template-edit contract.
- **Fix**: Select the effective revision before determining month eligibility, then add pgTAP coverage for extending and removing an end date.
  - Strength: Preserves the effective-dated model and makes the scheduler use the scheduled values consistently.
  - Tradeoff: The materialization query becomes more involved and needs boundary tests.
  - Confidence: HIGH — the failure follows directly from the base-date `WHERE` clause preceding revision lookup.
  - Blind spot: None significant.
- **Decision**: FIXED — resolved the effective revision before month eligibility and added a pgTAP regression case.

### F2 — Pause or stop can race with materialization

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260819110000_recurring_expense_occurrences.sql:49
- **Detail**: The routine reads active templates before it takes the family lock and never rechecks `is_active` or `archived_at`. If a pause or stop completes while the routine waits for that lock, it can still create one occurrence from a stale active snapshot. This can produce an expense after the payer has successfully stopped future scheduling.
- **Fix**: Re-read and validate the template after acquiring the family lock, or lock/recheck templates in a consistent order; add a regression test for the revalidation boundary.
  - Strength: Makes the lifecycle command and scheduler observe a single consistent decision boundary.
  - Tradeoff: Requires careful lock ordering to preserve concurrency.
  - Confidence: HIGH — the current query and lock order make the stale read observable.
  - Blind spot: A deterministic pgTAP concurrency harness may need separate transaction sessions.
- **Decision**: SKIPPED

### F3 — Concurrent retries can fail instead of completing idempotently

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260819110000_recurring_expense_occurrences.sql:116
- **Detail**: The occurrence-existence check occurs before inserting the expense, and the subsequent ledger insert has no conflict handler. Two concurrent executions can both reach the expense insert; one later fails at the unique occurrence key and rolls back. That avoids a persisted duplicate, but does not provide the retry-safe successful completion specified by the plan's concurrency guard.
- **Fix**: Claim the template/month ledger row first with `INSERT ... ON CONFLICT DO NOTHING`, then create and link the expense only for the successful claimant; add a concurrent-execution regression test.
  - Strength: Uses the ledger's unique key as the intended atomic guard and makes duplicate calls harmless.
  - Tradeoff: Requires a controlled intermediate ledger state or an atomic helper design.
  - Confidence: HIGH — the current `NOT EXISTS` then insert sequence is not an atomic claim.
  - Blind spot: The final transaction rollback prevents duplicate persisted expenses today.
- **Decision**: FIXED — the occurrence ledger now atomically claims the generated expense ID before its linked expense is inserted.

### F4 — Pause and stop do not have a future-only effective boundary

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: supabase/migrations/20260818170000_recurring_expense_templates.sql:145
- **Detail**: Edits are effective from the next month, but pause and archive immediately toggle the base template. A payer can pause or stop on the first day before the scheduler runs and suppress that month’s occurrence, despite the plan and manual criterion requiring these management actions to affect future scheduling only.
- **Fix**: Represent pause/stop with a next-month effective state (or explicitly revise the approved behavior and tests if immediate cessation is the intended product decision).
  - Strength: Aligns every management action with the documented future-only contract.
  - Tradeoff: Introduces lifecycle versioning beyond value revisions.
  - Confidence: HIGH — current functions update `is_active`/`archived_at` immediately.
  - Blind spot: The product intent for a not-yet-materialized current-month occurrence should be confirmed.
- **Decision**: SKIPPED

### F5 — Required recurrence boundary coverage is incomplete

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/tests/approved_expense_balance.test.sql:740
- **Detail**: The pgTAP suite proves creation, pending state, sequential retry, other-parent approval, and confirmation-locked skips. It does not explicitly prove family isolation, start/end-date boundaries, a settled-only skip, or the balance remaining unchanged before approval and changing afterward, all of which Phase 2 names as required coverage.
- **Fix**: Add focused pgTAP cases for each missing boundary and financial-state assertion.
- **Decision**: SKIPPED
