# Recurring monthly expenses — Plan Brief

> Full plan: `context/changes/recourring-expenses/plan.md`
> Research: `context/changes/recourring-expenses/research.md`

## What & Why

FR-010 lets a parent configure a recurring monthly expense without bypassing FairShare's shared financial controls. Every generated occurrence becomes an ordinary pending expense, so the other parent must still approve it before it affects the balance.

## Starting Point

The app has safe one-off expense creation, review, correction, and settlement, but no recurrence identity, scheduler, or template-management UI. Recurrence was intentionally parked until this core lifecycle existed.

## Desired End State

Parents manage their own first-of-month templates on the dashboard, each with a start date and either an inclusive end date or an “until manually cancelled” condition. Active templates generate one pending, visibly recurring expense for each eligible month; retries do not duplicate it, and locked/settled months record a skip instead of receiving a late expense.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Cadence | First day of each month | Delivers FR-010 with a simple, unambiguous schedule. | Plan |
| Template duration | Start date plus optional end date | Supports bounded schedules and “until manually cancelled” without deleting history. | Plan |
| Template owner | Paying parent only | Matches current expense-change ownership. | Plan |
| Start and edits | Next month; future-only edits | Preserves predictable history and review records. | Plan |
| Retry policy | Current open month only | Recovers transient failures without flooding old reviews. | Plan |
| Locked months | Auditable skip | Preserves settlement immutability. | Plan |
| Job boundary | Database-local Cron routine | Avoids an application service-role client and supports atomic idempotency. | Research |

## Scope

**In scope:**

- Monthly template management with date ranges, occurrence ledger, pending-expense materialization, recurring labels, database scheduler, and runbook.
- Database-level authorization, idempotency, approval, and settlement-safety proof.

**Out of scope:**

- Non-monthly schedules, automatic approval, notifications, retroactive generation, Cloudflare Cron, or service-role application code.

## Architecture / Approach

Templates are family-owned records; an append-only occurrence ledger owns the unique template/month decision. A database routine creates a normal pending expense or a skipped-locked record, and Supabase Cron invokes that routine monthly. Existing approval and financial calculation paths remain authoritative.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Template management | Parent-owned recurring schedules in dashboard | Cross-family or co-parent edits |
| 2. Occurrence generation | Idempotent pending expenses and provenance | Duplicates or settlement bypass |
| 3. Scheduler activation | Monthly production job and recovery runbook | Operational misconfiguration |

**Prerequisites:** Supabase project supports database Cron and an operator can enable/inspect the production job.
**Estimated effort:** ~3–5 implementation sessions across three phases.

## Open Risks & Assumptions

- Database Cron activation and job-history access are production-platform operations, not currently represented in repository configuration.
- The family model has no timezone preference, so monthly scheduling is intentionally UTC.

## Success Criteria (Summary)

- A parent controls only their future template; the other parent freshly approves every resulting expense.
- Retry-safe materialization never duplicates or changes locked/settled months.
- The production job is enabled, observable, and documented for recovery.
