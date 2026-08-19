# Recurring expense scheduler runbook

## Purpose

The `materialize-current-month-recurring-expenses` database Cron job runs on the first day of every month at 00:00 UTC. It calls only `public.materialize_current_month_recurring_expenses()`, which handles the current month atomically and is safe to rerun.

The job never approves an expense. Each successful occurrence creates an ordinary `pending` expense that the other parent must approve through the existing workflow. Confirmation-locked and settled months produce a `skipped_locked` ledger row instead.

## Activation prerequisites

1. Deploy migrations through the normal Supabase migration workflow. The scheduler migration enables `pg_cron` when the project allows it and registers the named job.
2. In the production Supabase Dashboard, open **Integrations → Cron** and confirm that the `pg_cron` extension is enabled. If the migration cannot create the extension, enable it there and re-run the migration.
3. Confirm the scheduler timezone is UTC (the `pg_cron` default is GMT/UTC). Do not change `cron.timezone` without an infrastructure restart and an explicit scheduling decision.

```sql
show cron.timezone;

select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'materialize-current-month-recurring-expenses';
```

The job must be active, use the schedule `0 0 1 * *`, and run exactly `select public.materialize_current_month_recurring_expenses()`.

## First-run verification and safe retry

After deployment, an authorized database operator may invoke the routine once to recover the current open month. It does not create past-month records and can be executed repeatedly without duplication.

```sql
select public.materialize_current_month_recurring_expenses();

select
  recurring_expense_id,
  occurrence_month,
  outcome,
  expense_id,
  created_at
from public.recurring_expense_occurrences
where occurrence_month = date_trunc('month', current_date)::date
order by created_at;
```

Run the routine a second time and verify that the query returns the same number of rows. For each `created` outcome, confirm the linked expense is `pending`; no approval or settlement should occur as part of this operation.

## Locked and settled months

If a family has a confirmation-locked or settled current month, the routine records `outcome = 'skipped_locked'` with a null `expense_id`. This is expected and must not be "repaired" by creating a late expense or modifying the ledger. The month’s existing settlement protections remain authoritative.

## Monitoring and incident response

View the job and execution history in **Integrations → Cron**. For SQL inspection, use:

```sql
select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'materialize-current-month-recurring-expenses'
)
order by start_time desc
limit 20;
```

For a failed run, inspect the `return_message`, confirm the `pg_cron` scheduler is active, correct the underlying database issue, then use the safe current-month retry above. Do not expose this routine through an application endpoint and do not use a service-role client or Cloudflare Cron trigger.
