create function public.list_monthly_report_history(
  p_family_id uuid,
  p_before_month date
)
returns table (
  report_month date,
  status public.monthly_settlement_status,
  approved_amount numeric(12,2)
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to view report history';
  end if;

  if p_before_month is null or p_before_month <> date_trunc('month', p_before_month)::date then
    raise exception 'Report history must end at the first day of a month';
  end if;

  if not exists (
    select 1
      from public.family_members
     where family_id = p_family_id
       and user_id = auth.uid()
       and role = 'parent'
       and is_active
  ) then
    raise exception 'Family is not available';
  end if;

  return query
  with report_months as (
    select date_trunc('month', expense_date)::date as month
      from public.expenses
     where family_id = p_family_id
       and expense_date < p_before_month
    union
    select monthly_settlements.report_month as month
      from public.monthly_settlements
     where family_id = p_family_id
       and monthly_settlements.report_month < p_before_month
  )
  select
    report_months.month,
    coalesce(monthly_settlements.status, 'open'::public.monthly_settlement_status),
    coalesce(sum(expenses.amount_pln) filter (where expenses.status = 'approved'), 0)::numeric(12,2)
  from report_months
  left join public.expenses
    on expenses.family_id = p_family_id
   and date_trunc('month', expenses.expense_date)::date = report_months.month
  left join public.monthly_settlements
    on monthly_settlements.family_id = p_family_id
   and monthly_settlements.report_month = report_months.month
  group by report_months.month, monthly_settlements.status
  order by report_months.month desc;
end;
$$;

revoke all on function public.list_monthly_report_history(uuid, date) from public;
grant execute on function public.list_monthly_report_history(uuid, date) to authenticated;
