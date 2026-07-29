create function public.delete_expense(p_expense_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_family_id uuid;
  caller_membership_id uuid;
  expense_family_id uuid;
  expense_payer_id uuid;
  expense_status public.expense_status;
  existing_expense_date date;
  deleted_expense_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required to delete an expense'; end if;

  select family_id, id into caller_family_id, caller_membership_id
    from public.family_members where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to delete an expense'; end if;

  perform 1 from public.families where id = caller_family_id for update;

  select family_id, payer_id, status, expense_date
    into expense_family_id, expense_payer_id, expense_status, existing_expense_date
    from public.expenses where id = p_expense_id for update;
  if expense_family_id is null or expense_family_id <> caller_family_id then raise exception 'Expense is not available to this family'; end if;
  if expense_payer_id <> caller_membership_id then raise exception 'Only the payer can delete this expense'; end if;
  if expense_status not in ('pending', 'declined') then raise exception 'Only pending or declined expenses can be deleted'; end if;
  if exists (
    select 1 from public.monthly_settlements
     where family_id = caller_family_id and status = 'settled'
       and report_month = date_trunc('month', existing_expense_date)::date
  ) then raise exception 'Expenses in a settled month cannot be deleted'; end if;

  delete from public.expenses where id = p_expense_id returning id into deleted_expense_id;
  return deleted_expense_id;
end;
$$;

revoke all on function public.delete_expense(uuid) from public;
grant execute on function public.delete_expense(uuid) to authenticated;
