alter table public.expenses add column previous_decline_reason text;

alter table public.expenses drop constraint expenses_decline_reason_matches_status;

alter table public.expenses add constraint expenses_decline_reasons_are_valid check (
  (decline_reason is null or (
    decline_reason = btrim(decline_reason)
    and decline_reason <> ''
    and char_length(decline_reason) <= 500
  ))
  and (previous_decline_reason is null or (
    previous_decline_reason = btrim(previous_decline_reason)
    and previous_decline_reason <> ''
    and char_length(previous_decline_reason) <= 500
  ))
  and ((status in ('pending', 'approved') and decline_reason is null) or status = 'declined')
);

create function public.update_expense(
  p_expense_id uuid,
  p_child_id uuid,
  p_description text,
  p_expense_date date,
  p_amount_pln numeric
)
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
  active_decline_reason text;
  updated_expense_id uuid;
  normalized_description text := btrim(p_description);
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to update an expense';
  end if;

  if normalized_description is null or normalized_description = '' then
    raise exception 'Expense description is required';
  end if;

  if p_amount_pln is null or p_amount_pln <= 0 or p_amount_pln <> trunc(p_amount_pln, 2) then
    raise exception 'Amount must be a positive PLN value with at most two decimal places';
  end if;

  if p_expense_date is null or p_expense_date > current_date then
    raise exception 'Expense date cannot be in the future';
  end if;

  select family_id, id
    into caller_family_id, caller_membership_id
    from public.family_members
   where user_id = auth.uid()
     and role = 'parent'
     and is_active;

  if caller_family_id is null then
    raise exception 'An active family membership is required to update an expense';
  end if;

  perform 1
    from public.families
   where id = caller_family_id
   for update;

  select family_id, payer_id, status, expense_date, decline_reason
    into expense_family_id, expense_payer_id, expense_status, existing_expense_date, active_decline_reason
    from public.expenses
   where id = p_expense_id
   for update;

  if expense_family_id is null or expense_family_id <> caller_family_id then
    raise exception 'Expense is not available to this family';
  end if;

  if expense_payer_id <> caller_membership_id then
    raise exception 'Only the payer can update this expense';
  end if;

  if p_child_id is not null and not exists (
    select 1 from public.children where id = p_child_id and family_id = caller_family_id
  ) then
    raise exception 'Selected child is not available to this family';
  end if;

  if exists (
    select 1
      from public.monthly_settlements
     where family_id = caller_family_id
       and status = 'settled'
       and report_month in (date_trunc('month', existing_expense_date)::date, date_trunc('month', p_expense_date)::date)
  ) then
    raise exception 'Expenses in a settled month cannot be updated';
  end if;

  update public.expenses
     set child_id = p_child_id,
         description = normalized_description,
         expense_date = p_expense_date,
         amount_pln = p_amount_pln,
         status = 'pending',
         reviewed_by = null,
         reviewed_at = null,
         decline_reason = null,
         previous_decline_reason = case
           when expense_status = 'declined' then active_decline_reason
           else previous_decline_reason
         end
   where id = p_expense_id
  returning id into updated_expense_id;

  return updated_expense_id;
end;
$$;

revoke all on function public.update_expense(uuid, uuid, text, date, numeric) from public;
grant execute on function public.update_expense(uuid, uuid, text, date, numeric) to authenticated;
