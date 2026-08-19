# Recurring monthly expenses implementation plan

## Overview

Deliver FR-010: a parent can configure a first-of-month recurring expense, and FairShare materializes one normal pending expense per eligible month. Each occurrence keeps the existing other-parent approval, balance, correction, and settlement protections; recurrence never approves or settles an expense automatically.

## Current State Analysis

The application has a strong one-off expense lifecycle: all writes go through authenticated `SECURITY DEFINER` RPCs, newly created expenses are pending, and the other active parent alone can approve them. The data model has no recurrence template or occurrence identity, while the dashboard only creates and displays one-off expenses.

Recurring expenses are a deliberate FR-010 backlog item. There is no existing scheduler, and the application deliberately avoids a service-role client because financial authorization is user-identity based. The established infrastructure direction is a database-local, idempotent scheduled job.

## Desired End State

On the dashboard, a paying parent can create, edit, pause, resume, and stop a recurring monthly expense. Templates have a start date and either an inclusive end date or an “until manually cancelled” end condition. They materialize on the first day of each eligible month, edits affect only future occurrences, and generated expenses are visibly marked as recurring but otherwise enter the existing list as pending and require the other parent’s fresh approval.

The monthly database job is safe to retry and backfills only the current open month. It creates at most one occurrence per template/month, records a skipped occurrence when the relevant month is confirmation-locked or settled, and never changes historical occurrence or expense data.

### Key Discoveries:

- FR-010 is a nice-to-have but explicitly requires fresh other-parent approval for every monthly occurrence: `context/foundation/prd.md:87-88`.
- Existing `expenses` already defaults to pending and existing approval commands enforce a different active parent: `supabase/migrations/20260717160000_financial_rules_foundation.sql:32-63`, `supabase/migrations/20260729180000_fix_settlement_review_commands.sql:11-35`.
- The app has no recurrence schema, occurrence generator, or scheduler: `context/changes/recourring-expenses/research.md`.
- Existing app clients must remain request/session scoped; do not introduce a service-role client: `src/lib/supabase.ts:5-27`.
- Existing settlement commands reject confirmation-locked and settled months: `supabase/migrations/20260729170000_joint_monthly_settlement.sql:110-120`.

## What We're NOT Doing

- Weekly, yearly, interval, or custom recurring schedules; FR-010 is monthly on the first day only.
- Immediate, backdated, or multi-month occurrence creation when a template is configured.
- Automatic approval, notifications, payment transfers, background sync, or a reviewer workflow separate from existing expense approval.
- Retroactive template edits or modifications to materialized expenses.
- A Cloudflare Cron Worker, an app-layer service-role client, or a new custom Worker entrypoint.
- Retroactive creation in locked/settled months; those attempts are recorded as skipped.

## Implementation Approach

Add a family-scoped recurring-template table and an append-only occurrence ledger. User-facing template commands follow the existing authenticated RPC/API pattern and store a payer-owned monthly template with a start date plus optional inclusive end date; no end date means it continues until manually cancelled. Cancelling archives the template for future eligibility while preserving historical occurrences.

Add a database-local materialization routine that uses the ledger’s unique template/month key for idempotency. A successful materialization inserts an ordinary pending expense linked to its occurrence; an ineligible locked/settled month gets a skipped ledger record instead. The production database scheduler invokes only that routine on the first of each month; manual current-month invocation supports retry recovery.

## Critical Implementation Details

The job must never call the ordinary `create_expense` RPC because that function derives payer identity from `auth.uid()`. The dedicated internal routine must validate stored template family/payer/child data, lock the relevant family/month decision boundary, and write the pending expense and occurrence ledger atomically. Its unique `(recurring_expense_id, occurrence_month)` constraint is the retry/concurrency guard.

## Phase 1: Recurring-template management

### Overview

Let a parent safely configure and manage their future first-of-month schedules from the dashboard, without yet changing the existing one-off creation flow.

### Changes Required:

#### 1. Recurrence template persistence and parent-owned commands

**Files**: new timestamped migration under `supabase/migrations/`; `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Add the family-owned template model and authenticated command surface while preserving immutable historical occurrence data.

**Contract**: A template stores family, payer membership, optional child, description, PLN amount, a start date, optional inclusive end date, active/archived state, and timestamps. A calendar month is eligible only when its first day falls on or after the start-date month and on or before the end-date month, if present. Only its paying parent in the same active family can create, edit, pause/resume, or archive it; cancellation stops future eligibility and template changes apply only to months after the current materialized period. Forced RLS, explicit function grants, child/family validation, valid date-range validation, positive two-decimal amount validation, and cross-family rejection follow the existing expense-RPC pattern. pgTAP proves authorization, ownership, validation, and no-side-effect failures.

#### 2. Authenticated template API and dashboard management UI

**Files**: new recurrence helper/module under `src/lib/`; new API routes under `src/pages/api/recurring-expenses/`; new Astro components under `src/components/expenses/`; `src/pages/recurring-expenses.astro`; dashboard navigation wiring

**Intent**: Give parents a direct in-app way to configure, review, and manage only their own future schedules.

**Contract**: Use request-scoped Supabase access and the established JSON/form error and workspace-refresh patterns. The dashboard links to a dedicated “Recurring expenses” management page with a form for description, child/N/A, amount, start date, and either a specific end date or “until manually cancelled.” It identifies the payer’s templates, date range, and paused/stopped state without exposing management controls to the other parent. Existing one-off expense form and API behavior remain unchanged.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` passes the recurrence-template authorization and validation cases.
- Focused recurrence helper tests and `npm run verify` pass.

#### Manual Verification:

- A parent can configure a schedule with a start date and either a defined end date or “until manually cancelled,” then sees the selected range in the dashboard management section.
- The other parent can view the schedule but cannot edit, pause, resume, or stop it.
- Pausing, resuming, editing, and stopping a template affect future scheduling only; ordinary expense entry still works.

**Implementation Note**: After completing this phase and automated verification, pause for human confirmation before proceeding to occurrence generation.

---

## Phase 2: Idempotent recurring occurrence generation

### Overview

Materialize safe, auditable monthly pending expenses from active templates and make their origin visible in the normal expense workflow.

### Changes Required:

#### 1. Occurrence ledger and database materialization routine

**Files**: new timestamped migration under `supabase/migrations/`; `supabase/tests/approved_expense_balance.test.sql`

**Intent**: Generate at most one pending normal expense for each active template/current-month pair, with an auditable outcome when the month cannot accept new expenses.

**Contract**: Add a recurrence-occurrence ledger with a unique template/month key, outcome (`created` or `skipped_locked`), and optional linked expense. A database-local routine materializes only the current calendar month for active templates whose start/end date range includes that month. It is idempotent across retries, validates the stored template relationship, inserts a standard pending expense with the stored payer/child/description/amount, and records `skipped_locked` rather than creating an expense if the family’s month is confirmation-locked or settled. It never creates an occurrence outside the configured date range or for earlier months, edits an existing occurrence, or bypasses the existing other-parent approval rule. pgTAP covers pending state, approval by the other parent, duplicate execution, family isolation, date-range boundaries, locked/settled skips, and unchanged balances until approval.

#### 2. Recurrence provenance in existing expense reads and list UI

**Files**: `src/lib/expense-balance.ts`, `src/lib/expense-balance.test.ts`, `src/components/expenses/ExpenseList.astro`

**Intent**: Make materialized expenses understandable without changing their existing review or correction controls.

**Contract**: Extend the expense display mapping with recurrence provenance derived from the occurrence link. The existing list labels generated items as recurring while retaining the exact pending/approve/decline/edit/delete semantics and declined-item ordering. No new client-side financial calculations are introduced.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` proves one occurrence per template/month, retry safety, date-range eligibility, pending status, other-parent-only approval, and locked/settled skip recording.
- Focused display-mapping tests and `npm run verify` pass.

#### Manual Verification:

- Running the materialization routine for an eligible current month creates one visibly recurring pending expense; repeating it creates no duplicate.
- The other parent approves that expense through the existing UI and the monthly balance changes only after approval.
- A locked or settled month shows an auditable skipped occurrence and receives no new expense.

**Implementation Note**: After completing this phase and automated verification, pause for human confirmation before scheduler activation.

---

## Phase 3: Monthly scheduler activation and operations handoff

### Overview

Connect the tested materialization routine to the production database’s monthly schedule and document safe activation, recovery, and monitoring.

### Changes Required:

#### 1. Scheduler migration and production runbook

**Files**: new timestamped migration under `supabase/migrations/`; `context/changes/recourring-expenses/scheduler-runbook.md`

**Intent**: Schedule the database-local routine on the first day of each month in UTC and make the operational setup/recovery process explicit.

**Contract**: The migration defines the database Cron job that invokes only the idempotent materialization routine. The runbook records the exact production activation prerequisites, first-run verification, current-month retry/backfill procedure, skipped-locked outcome, and job-failure inspection path. It must not add a Cloudflare trigger, application service-role credentials, or a user-accessible endpoint for arbitrary month generation.

### Success Criteria:

#### Automated Verification:

- `npx supabase test db` confirms scheduler registration and that an explicit routine invocation remains idempotent.
- `npm run verify` passes.

#### Manual Verification:

- In the production Supabase project, the monthly job is enabled and its next first-of-month UTC run is visible.
- An authorized operator follows the runbook to verify a current-month retry does not duplicate an occurrence.
- Job execution/failure history is accessible to the operating team.

**Implementation Note**: After completing this phase and automated verification, pause for human confirmation of production scheduler activation before closing the change.

## Testing Strategy

### Unit Tests:

- Test recurrence view-model mapping and any app-owned input/date normalization.
- Retain financial calculation tests; generated expenses must affect totals solely through the existing pending/approved lifecycle.

### Integration Tests:

- Extend the existing pgTAP two-family fixture rather than creating untrusted direct table writes.
- Verify RLS/RPC ownership, exactly-one occurrence, date-range eligibility, no current-month duplicate on retry, other-parent approval, locked/settled skip recording, and no financial side effect before approval.
- Run `npx supabase test db` after every migration/RLS/RPC change.

### Manual Testing Steps:

1. Configure a recurring expense with a start date and both a fixed-end and manually-cancelled variant; confirm the other parent cannot manage either template.
2. Materialize the current month twice and confirm exactly one pending generated expense appears with a recurring label.
3. Approve it as the other parent and confirm the normal balance update.
4. Pause/edit/stop a template and confirm only future periods are affected.
5. Test a confirmation-locked or settled month and confirm a skipped audit outcome without an expense.
6. Enable the production monthly database job and inspect its next run and history.

## Performance Considerations

The job scans only active templates eligible for the current month and uses a unique occurrence key, so normal runs are bounded by active family templates rather than historical expenses. Index template eligibility and occurrence uniqueness for the job query; do not load recurrence history into normal monthly balance calculation.

## Migration Notes

All schema changes are additive. Existing expenses remain one-off and unchanged. Disabling the database job and pausing templates stop future generation without deleting historical occurrences or expenses; rollback must not remove already materialized financial records.

## References

- Research: `context/changes/recourring-expenses/research.md`
- Product requirement: `context/foundation/prd.md:87-88`
- Parked roadmap item: `context/foundation/roadmap.md:154-160`
- Existing expense commands: `supabase/migrations/20260729170000_joint_monthly_settlement.sql:87-131`
- Existing test pattern: `supabase/tests/approved_expense_balance.test.sql:1-145`
- Existing dashboard workspace: `src/components/expenses/ExpenseWorkspace.astro:1-100`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Recurring-template management

#### Automated

- [x] 1.1 Add the recurring-template schema, parent-owned commands, and database authorization tests. — 3624396
- [x] 1.2 Add authenticated template APIs, helper mapping, and dashboard management UI. — 3624396
- [x] 1.3 Run focused recurrence checks, `npx supabase test db`, and `npm run verify`. — 3624396

#### Manual

- [x] 1.4 Verify template ownership and future-only dashboard management in a browser. — 3624396

### Phase 2: Idempotent recurring occurrence generation

#### Automated

- [x] 2.1 Add the occurrence ledger and idempotent current-month materialization routine with database tests. — 1061022
- [x] 2.2 Display recurring provenance in the existing expense list with focused mapping tests. — 1061022
- [x] 2.3 Run focused recurrence checks, `npx supabase test db`, and `npm run verify`. — 1061022

#### Manual

- [x] 2.4 Verify generated pending expense approval, retry safety, and locked-month skips. — 1061022

### Phase 3: Monthly scheduler activation and operations handoff

#### Automated

- [x] 3.1 Register the monthly database scheduler and document the activation/recovery runbook. — 44139a0
- [x] 3.2 Run `npx supabase test db` and `npm run verify`. — 44139a0

#### Manual

- [x] 3.3 Verify the production scheduler, retry behavior, and job history. — 44139a0
