create extension if not exists pg_cron with schema cron;

select cron.unschedule(jobid)
from cron.job
where jobname = 'materialize-current-month-recurring-expenses';

select cron.schedule(
  'materialize-current-month-recurring-expenses',
  '0 0 1 * *',
  $$select public.materialize_current_month_recurring_expenses()$$
);
