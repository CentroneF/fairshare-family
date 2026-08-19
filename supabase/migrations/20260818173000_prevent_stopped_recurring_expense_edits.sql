create or replace function public.update_recurring_expense(
  p_recurring_expense_id uuid,
  p_child_id uuid,
  p_description text,
  p_amount_pln numeric,
  p_start_date date,
  p_end_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_family_id uuid;
  caller_membership_id uuid;
  recurring_family_id uuid;
  recurring_payer_id uuid;
  effective_from_date date := (date_trunc('month', current_date) + interval '1 month')::date;
  normalized_description text := btrim(p_description);
begin
  if auth.uid() is null then raise exception 'Authentication is required to update a recurring expense'; end if;
  if normalized_description is null or normalized_description = '' then raise exception 'Expense description is required'; end if;
  if p_amount_pln is null or p_amount_pln <= 0 or p_amount_pln <> trunc(p_amount_pln, 2) then
    raise exception 'Amount must be a positive PLN value with at most two decimal places';
  end if;
  if p_start_date is null then raise exception 'A recurring expense start date is required'; end if;
  if p_end_date is not null and p_end_date < greatest(p_start_date, effective_from_date) then
    raise exception 'Recurring expense end date must be on or after the next effective month';
  end if;

  select family_id, id into caller_family_id, caller_membership_id
  from public.family_members where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to manage recurring expenses'; end if;
  perform 1 from public.families where id = caller_family_id for update;
  select family_id, payer_id into recurring_family_id, recurring_payer_id
  from public.recurring_expenses where id = p_recurring_expense_id for update;
  if recurring_family_id is null or recurring_family_id <> caller_family_id then raise exception 'Recurring expense is not available to this family'; end if;
  if recurring_payer_id <> caller_membership_id then raise exception 'Only the payer can manage this recurring expense'; end if;
  if exists (select 1 from public.recurring_expenses where id = p_recurring_expense_id and archived_at is not null) then
    raise exception 'Stopped recurring expenses cannot be edited';
  end if;
  if p_child_id is not null and not exists (
    select 1 from public.children where id = p_child_id and family_id = caller_family_id
  ) then raise exception 'Selected child is not available to this family'; end if;

  insert into public.recurring_expense_revisions (
    recurring_expense_id, effective_from, child_id, description, amount_pln, start_date, end_date
  ) values (
    p_recurring_expense_id, effective_from_date, p_child_id, normalized_description, p_amount_pln,
    greatest(p_start_date, effective_from_date), p_end_date
  ) on conflict (recurring_expense_id, effective_from) do update
    set child_id = excluded.child_id,
        description = excluded.description,
        amount_pln = excluded.amount_pln,
        start_date = excluded.start_date,
        end_date = excluded.end_date;
  return p_recurring_expense_id;
end;
$$;
