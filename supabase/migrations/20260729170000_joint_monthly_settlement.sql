alter table public.monthly_settlements
  add column approved_amount_pln numeric(12, 2),
  add column first_confirmed_contribution_pln numeric(12, 2),
  add column second_confirmed_contribution_pln numeric(12, 2),
  add column payment_from_membership_id uuid,
  add column payment_to_membership_id uuid,
  add column payment_amount_pln numeric(12, 0);

alter table public.monthly_settlements
  add foreign key (payment_from_membership_id, family_id)
    references public.family_members (id, family_id)
    on delete restrict,
  add foreign key (payment_to_membership_id, family_id)
    references public.family_members (id, family_id)
    on delete restrict;

with settlement_totals as (
  select
    monthly_settlements.id,
    coalesce(sum(expenses.amount_pln) filter (where expenses.status = 'approved'), 0)::numeric(12, 2) as approved_amount_pln,
    coalesce(sum(expenses.amount_pln) filter (
      where expenses.status = 'approved' and expenses.payer_id = monthly_settlements.first_confirmed_by
    ), 0)::numeric(12, 2) as first_confirmed_contribution_pln,
    coalesce(sum(expenses.amount_pln) filter (
      where expenses.status = 'approved' and expenses.payer_id = monthly_settlements.second_confirmed_by
    ), 0)::numeric(12, 2) as second_confirmed_contribution_pln
  from public.monthly_settlements
  left join public.expenses
    on expenses.family_id = monthly_settlements.family_id
   and date_trunc('month', expenses.expense_date)::date = monthly_settlements.report_month
  where monthly_settlements.status = 'settled'
  group by monthly_settlements.id
)
update public.monthly_settlements as settlement
set
  approved_amount_pln = totals.approved_amount_pln,
  first_confirmed_contribution_pln = totals.first_confirmed_contribution_pln,
  second_confirmed_contribution_pln = totals.second_confirmed_contribution_pln,
  payment_from_membership_id = case
    when round(abs(totals.first_confirmed_contribution_pln - totals.approved_amount_pln / 2), 0) = 0 then null
    when totals.first_confirmed_contribution_pln > totals.approved_amount_pln / 2 then settlement.second_confirmed_by
    else settlement.first_confirmed_by
  end,
  payment_to_membership_id = case
    when round(abs(totals.first_confirmed_contribution_pln - totals.approved_amount_pln / 2), 0) = 0 then null
    when totals.first_confirmed_contribution_pln > totals.approved_amount_pln / 2 then settlement.first_confirmed_by
    else settlement.second_confirmed_by
  end,
  payment_amount_pln = round(abs(totals.first_confirmed_contribution_pln - totals.approved_amount_pln / 2), 0)::numeric(12, 0)
from settlement_totals as totals
where settlement.id = totals.id;

alter table public.monthly_settlements
  add constraint monthly_settlements_snapshot_matches_status check (
    (
      status = 'open'
      and approved_amount_pln is null
      and first_confirmed_contribution_pln is null
      and second_confirmed_contribution_pln is null
      and payment_from_membership_id is null
      and payment_to_membership_id is null
      and payment_amount_pln is null
    )
    or (
      status = 'settled'
      and approved_amount_pln is not null
      and approved_amount_pln >= 0
      and first_confirmed_contribution_pln is not null
      and second_confirmed_contribution_pln is not null
      and first_confirmed_contribution_pln >= 0
      and second_confirmed_contribution_pln >= 0
      and first_confirmed_contribution_pln + second_confirmed_contribution_pln = approved_amount_pln
      and payment_amount_pln is not null
      and payment_amount_pln >= 0
      and (
        (payment_amount_pln = 0 and payment_from_membership_id is null and payment_to_membership_id is null)
        or (
          payment_amount_pln > 0
          and payment_from_membership_id is not null
          and payment_to_membership_id is not null
          and payment_from_membership_id <> payment_to_membership_id
        )
      )
    )
  );

create or replace function public.create_expense(
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
  target_family_id uuid;
  payer_membership_id uuid;
  created_expense_id uuid;
  normalized_description text := btrim(p_description);
begin
  if auth.uid() is null then raise exception 'Authentication is required to create an expense'; end if;
  if normalized_description is null or normalized_description = '' then raise exception 'Expense description is required'; end if;
  if p_amount_pln is null or p_amount_pln <= 0 or p_amount_pln <> trunc(p_amount_pln, 2) then
    raise exception 'Amount must be a positive PLN value with at most two decimal places';
  end if;
  if p_expense_date is null or p_expense_date > current_date then raise exception 'Expense date cannot be in the future'; end if;

  select family_id, id into target_family_id, payer_membership_id
    from public.family_members where user_id = auth.uid() and role = 'parent' and is_active;
  if target_family_id is null then raise exception 'An active family membership is required to create an expense'; end if;

  perform 1 from public.families where id = target_family_id for update;
  if exists (
    select 1 from public.monthly_settlements
     where family_id = target_family_id
       and report_month = date_trunc('month', p_expense_date)::date
       and (first_confirmed_by is not null or status = 'settled')
  ) then raise exception 'Expenses in a confirmation-locked or settled month cannot be changed'; end if;

  if p_child_id is not null and not exists (
    select 1 from public.children where id = p_child_id and family_id = target_family_id
  ) then raise exception 'Selected child is not available to this family'; end if;

  insert into public.expenses (family_id, child_id, payer_id, description, expense_date, amount_pln)
  values (target_family_id, p_child_id, payer_membership_id, normalized_description, p_expense_date, p_amount_pln)
  returning id into created_expense_id;
  return created_expense_id;
end;
$$;

create or replace function public.approve_expense(p_expense_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_family_id uuid; caller_membership_id uuid; active_parent_count integer;
  expense_family_id uuid; expense_payer_id uuid; expense_status public.expense_status; expense_date date; approved_expense_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required to approve an expense'; end if;
  select family_id, id into caller_family_id, caller_membership_id from public.family_members
   where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to approve an expense'; end if;
  perform 1 from public.families where id = caller_family_id for update;
  select count(*) into active_parent_count from public.family_members
   where family_id = caller_family_id and role = 'parent' and is_active;
  if active_parent_count <> 2 then raise exception 'Exactly two active parents are required to approve an expense'; end if;
  select family_id, payer_id, status, expense_date into expense_family_id, expense_payer_id, expense_status, expense_date
   from public.expenses where id = p_expense_id for update;
  if expense_family_id is null or expense_family_id <> caller_family_id then raise exception 'Expense is not available to this family'; end if;
  if expense_payer_id = caller_membership_id then raise exception 'Only the other parent can approve an expense'; end if;
  if expense_status <> 'pending' then raise exception 'Expense has already been reviewed'; end if;
  if exists (
    select 1 from public.monthly_settlements
     where family_id = caller_family_id and report_month = date_trunc('month', expense_date)::date
       and (first_confirmed_by is not null or status = 'settled')
  ) then raise exception 'Expenses in a confirmation-locked or settled month cannot be changed'; end if;
  update public.expenses set status = 'approved', reviewed_by = caller_membership_id, reviewed_at = now()
   where id = p_expense_id and status = 'pending' returning id into approved_expense_id;
  if approved_expense_id is null then raise exception 'Expense has already been reviewed'; end if;
  return approved_expense_id;
end;
$$;

create or replace function public.decline_expense(p_expense_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_family_id uuid; caller_membership_id uuid; active_parent_count integer;
  expense_family_id uuid; expense_payer_id uuid; expense_status public.expense_status; expense_date date;
  declined_expense_id uuid; normalized_reason text := btrim(p_reason);
begin
  if auth.uid() is null then raise exception 'Authentication is required to decline an expense'; end if;
  if normalized_reason is null or normalized_reason = '' or char_length(normalized_reason) > 500 then
    raise exception 'A decline reason between 1 and 500 characters is required';
  end if;
  select family_id, id into caller_family_id, caller_membership_id from public.family_members
   where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to decline an expense'; end if;
  perform 1 from public.families where id = caller_family_id for update;
  select count(*) into active_parent_count from public.family_members
   where family_id = caller_family_id and role = 'parent' and is_active;
  if active_parent_count <> 2 then raise exception 'Exactly two active parents are required to decline an expense'; end if;
  select family_id, payer_id, status, expense_date into expense_family_id, expense_payer_id, expense_status, expense_date
   from public.expenses where id = p_expense_id for update;
  if expense_family_id is null or expense_family_id <> caller_family_id then raise exception 'Expense is not available to this family'; end if;
  if expense_payer_id = caller_membership_id then raise exception 'Only the other parent can decline an expense'; end if;
  if expense_status <> 'pending' then raise exception 'Expense has already been reviewed'; end if;
  if exists (
    select 1 from public.monthly_settlements
     where family_id = caller_family_id and report_month = date_trunc('month', expense_date)::date
       and (first_confirmed_by is not null or status = 'settled')
  ) then raise exception 'Expenses in a confirmation-locked or settled month cannot be changed'; end if;
  update public.expenses set status = 'declined', reviewed_by = caller_membership_id, reviewed_at = now(), decline_reason = normalized_reason
   where id = p_expense_id and status = 'pending' returning id into declined_expense_id;
  if declined_expense_id is null then raise exception 'Expense has already been reviewed'; end if;
  return declined_expense_id;
end;
$$;

create or replace function public.update_expense(
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
  caller_family_id uuid; caller_membership_id uuid; expense_family_id uuid; expense_payer_id uuid;
  expense_status public.expense_status; existing_expense_date date; active_decline_reason text; updated_expense_id uuid;
  normalized_description text := btrim(p_description);
begin
  if auth.uid() is null then raise exception 'Authentication is required to update an expense'; end if;
  if normalized_description is null or normalized_description = '' then raise exception 'Expense description is required'; end if;
  if p_amount_pln is null or p_amount_pln <= 0 or p_amount_pln <> trunc(p_amount_pln, 2) then raise exception 'Amount must be a positive PLN value with at most two decimal places'; end if;
  if p_expense_date is null or p_expense_date > current_date then raise exception 'Expense date cannot be in the future'; end if;
  select family_id, id into caller_family_id, caller_membership_id from public.family_members where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to update an expense'; end if;
  perform 1 from public.families where id = caller_family_id for update;
  select family_id, payer_id, status, expense_date, decline_reason into expense_family_id, expense_payer_id, expense_status, existing_expense_date, active_decline_reason
    from public.expenses where id = p_expense_id for update;
  if expense_family_id is null or expense_family_id <> caller_family_id then raise exception 'Expense is not available to this family'; end if;
  if expense_payer_id <> caller_membership_id then raise exception 'Only the payer can update this expense'; end if;
  if p_child_id is not null and not exists (select 1 from public.children where id = p_child_id and family_id = caller_family_id) then raise exception 'Selected child is not available to this family'; end if;
  if exists (
    select 1 from public.monthly_settlements
     where family_id = caller_family_id
       and report_month in (date_trunc('month', existing_expense_date)::date, date_trunc('month', p_expense_date)::date)
       and (first_confirmed_by is not null or status = 'settled')
  ) then raise exception 'Expenses in a confirmation-locked or settled month cannot be changed'; end if;
  update public.expenses set child_id = p_child_id, description = normalized_description, expense_date = p_expense_date,
    amount_pln = p_amount_pln, status = 'pending', reviewed_by = null, reviewed_at = null, decline_reason = null,
    previous_decline_reason = case when expense_status = 'declined' then active_decline_reason else previous_decline_reason end
   where id = p_expense_id returning id into updated_expense_id;
  return updated_expense_id;
end;
$$;

create or replace function public.delete_expense(p_expense_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_family_id uuid; caller_membership_id uuid; expense_family_id uuid; expense_payer_id uuid;
  expense_status public.expense_status; existing_expense_date date; deleted_expense_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required to delete an expense'; end if;
  select family_id, id into caller_family_id, caller_membership_id from public.family_members where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to delete an expense'; end if;
  perform 1 from public.families where id = caller_family_id for update;
  select family_id, payer_id, status, expense_date into expense_family_id, expense_payer_id, expense_status, existing_expense_date
    from public.expenses where id = p_expense_id for update;
  if expense_family_id is null or expense_family_id <> caller_family_id then raise exception 'Expense is not available to this family'; end if;
  if expense_payer_id <> caller_membership_id then raise exception 'Only the payer can delete this expense'; end if;
  if expense_status not in ('pending', 'declined') then raise exception 'Only pending or declined expenses can be deleted'; end if;
  if exists (
    select 1 from public.monthly_settlements
     where family_id = caller_family_id and report_month = date_trunc('month', existing_expense_date)::date
       and (first_confirmed_by is not null or status = 'settled')
  ) then raise exception 'Expenses in a confirmation-locked or settled month cannot be changed'; end if;
  delete from public.expenses where id = p_expense_id returning id into deleted_expense_id;
  return deleted_expense_id;
end;
$$;

create function public.confirm_monthly_settlement(p_report_month date)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_family_id uuid; caller_membership_id uuid; active_parent_count integer;
  existing_settlement_id uuid; existing_status public.monthly_settlement_status; existing_first_confirmer uuid;
  first_parent_id uuid; second_parent_id uuid; expense_count integer; unresolved_expense_count integer;
  approved_amount numeric(12, 2); first_contribution numeric(12, 2); second_contribution numeric(12, 2);
  payment_amount numeric(12, 0); payment_from_id uuid; payment_to_id uuid; settlement_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication is required to confirm settlement'; end if;
  if p_report_month is null or p_report_month <> date_trunc('month', p_report_month)::date then
    raise exception 'Settlement month must be the first day of a month';
  end if;
  if p_report_month >= date_trunc('month', current_date)::date then raise exception 'Only past months can be settled'; end if;
  select family_id, id into caller_family_id, caller_membership_id from public.family_members
   where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to confirm settlement'; end if;
  perform 1 from public.families where id = caller_family_id for update;
  select count(*) into active_parent_count from public.family_members
   where family_id = caller_family_id and role = 'parent' and is_active;
  if active_parent_count <> 2 then raise exception 'Exactly two active parents are required to settle a month'; end if;
  select id into first_parent_id from public.family_members
   where family_id = caller_family_id and role = 'parent' and is_active order by created_at, id limit 1;
  select id into second_parent_id from public.family_members
   where family_id = caller_family_id and role = 'parent' and is_active and id <> first_parent_id order by created_at, id limit 1;
  select count(*), count(*) filter (where status <> 'approved') into expense_count, unresolved_expense_count
   from public.expenses where family_id = caller_family_id and date_trunc('month', expense_date)::date = p_report_month;
  if expense_count = 0 then raise exception 'A month with no expenses cannot be settled'; end if;
  if unresolved_expense_count <> 0 then raise exception 'All expenses must be approved before settlement'; end if;
  select id, status, first_confirmed_by into existing_settlement_id, existing_status, existing_first_confirmer
   from public.monthly_settlements where family_id = caller_family_id and report_month = p_report_month for update;
  if existing_status = 'settled' then raise exception 'This month has already been settled'; end if;
  if existing_settlement_id is not null and existing_first_confirmer = caller_membership_id then
    raise exception 'You have already confirmed this settlement';
  end if;
  if existing_settlement_id is null then
    insert into public.monthly_settlements (family_id, report_month, first_confirmed_by, first_confirmed_at)
    values (caller_family_id, p_report_month, caller_membership_id, now()) returning id into settlement_id;
    return settlement_id;
  end if;

  select coalesce(sum(amount_pln), 0)::numeric(12, 2),
    coalesce(sum(amount_pln) filter (where payer_id = existing_first_confirmer), 0)::numeric(12, 2),
    coalesce(sum(amount_pln) filter (where payer_id = caller_membership_id), 0)::numeric(12, 2)
   into approved_amount, first_contribution, second_contribution
   from public.expenses where family_id = caller_family_id and date_trunc('month', expense_date)::date = p_report_month and status = 'approved';
  payment_amount := round(abs(first_contribution - approved_amount / 2), 0)::numeric(12, 0);
  if payment_amount = 0 then
    payment_from_id := null; payment_to_id := null;
  elsif first_contribution > approved_amount / 2 then
    payment_from_id := caller_membership_id; payment_to_id := existing_first_confirmer;
  else
    payment_from_id := existing_first_confirmer; payment_to_id := caller_membership_id;
  end if;
  update public.monthly_settlements set
    status = 'settled', second_confirmed_by = caller_membership_id, second_confirmed_at = now(), settled_at = now(),
    approved_amount_pln = approved_amount, first_confirmed_contribution_pln = first_contribution,
    second_confirmed_contribution_pln = second_contribution, payment_from_membership_id = payment_from_id,
    payment_to_membership_id = payment_to_id, payment_amount_pln = payment_amount
   where id = existing_settlement_id returning id into settlement_id;
  return settlement_id;
end;
$$;

revoke all on function public.create_expense(uuid, text, date, numeric) from public;
grant execute on function public.create_expense(uuid, text, date, numeric) to authenticated;
revoke all on function public.approve_expense(uuid) from public;
grant execute on function public.approve_expense(uuid) to authenticated;
revoke all on function public.decline_expense(uuid, text) from public;
grant execute on function public.decline_expense(uuid, text) to authenticated;
revoke all on function public.update_expense(uuid, uuid, text, date, numeric) from public;
grant execute on function public.update_expense(uuid, uuid, text, date, numeric) to authenticated;
revoke all on function public.delete_expense(uuid) from public;
grant execute on function public.delete_expense(uuid) to authenticated;
revoke all on function public.confirm_monthly_settlement(date) from public;
grant execute on function public.confirm_monthly_settlement(date) to authenticated;
