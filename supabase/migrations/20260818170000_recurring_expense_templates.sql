create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  payer_id uuid not null,
  child_id uuid,
  description text not null check (btrim(description) <> ''),
  amount_pln numeric(12, 2) not null check (amount_pln > 0),
  start_date date not null,
  end_date date,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (payer_id, family_id)
    references public.family_members (id, family_id) on delete restrict,
  foreign key (child_id, family_id)
    references public.children (id, family_id) on delete restrict,
  check (end_date is null or end_date >= start_date),
  check (archived_at is null or not is_active)
);

create index recurring_expenses_eligible_idx
  on public.recurring_expenses (is_active, start_date, end_date)
  where archived_at is null;
create index recurring_expenses_family_payer_idx on public.recurring_expenses (family_id, payer_id);

create trigger recurring_expenses_set_updated_at
before update on public.recurring_expenses
for each row execute procedure public.set_updated_at();

alter table public.recurring_expenses enable row level security;
alter table public.recurring_expenses force row level security;

create policy "active parents can view recurring expenses"
on public.recurring_expenses for select to authenticated
using (public.is_active_family_member(family_id));

grant select on public.recurring_expenses to authenticated;

create function public.create_recurring_expense(
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
  recurring_expense_id uuid;
  normalized_description text := btrim(p_description);
begin
  if auth.uid() is null then raise exception 'Authentication is required to create a recurring expense'; end if;
  if normalized_description is null or normalized_description = '' then raise exception 'Expense description is required'; end if;
  if p_amount_pln is null or p_amount_pln <= 0 or p_amount_pln <> trunc(p_amount_pln, 2) then
    raise exception 'Amount must be a positive PLN value with at most two decimal places';
  end if;
  if p_start_date is null then raise exception 'A recurring expense start date is required'; end if;
  if p_end_date is not null and p_end_date < p_start_date then raise exception 'Recurring expense end date must be on or after the start date'; end if;

  select family_id, id into caller_family_id, caller_membership_id
  from public.family_members where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to manage recurring expenses'; end if;
  perform 1 from public.families where id = caller_family_id for update;
  if p_child_id is not null and not exists (
    select 1 from public.children where id = p_child_id and family_id = caller_family_id
  ) then raise exception 'Selected child is not available to this family'; end if;

  insert into public.recurring_expenses (family_id, payer_id, child_id, description, amount_pln, start_date, end_date)
  values (caller_family_id, caller_membership_id, p_child_id, normalized_description, p_amount_pln, p_start_date, p_end_date)
  returning id into recurring_expense_id;
  return recurring_expense_id;
end;
$$;

create function public.update_recurring_expense(
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
  normalized_description text := btrim(p_description);
begin
  if auth.uid() is null then raise exception 'Authentication is required to update a recurring expense'; end if;
  if normalized_description is null or normalized_description = '' then raise exception 'Expense description is required'; end if;
  if p_amount_pln is null or p_amount_pln <= 0 or p_amount_pln <> trunc(p_amount_pln, 2) then
    raise exception 'Amount must be a positive PLN value with at most two decimal places';
  end if;
  if p_start_date is null then raise exception 'A recurring expense start date is required'; end if;
  if p_end_date is not null and p_end_date < p_start_date then raise exception 'Recurring expense end date must be on or after the start date'; end if;

  select family_id, id into caller_family_id, caller_membership_id
  from public.family_members where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to manage recurring expenses'; end if;
  perform 1 from public.families where id = caller_family_id for update;
  select family_id, payer_id into recurring_family_id, recurring_payer_id
  from public.recurring_expenses where id = p_recurring_expense_id for update;
  if recurring_family_id is null or recurring_family_id <> caller_family_id then raise exception 'Recurring expense is not available to this family'; end if;
  if recurring_payer_id <> caller_membership_id then raise exception 'Only the payer can manage this recurring expense'; end if;
  if p_child_id is not null and not exists (
    select 1 from public.children where id = p_child_id and family_id = caller_family_id
  ) then raise exception 'Selected child is not available to this family'; end if;

  update public.recurring_expenses
  set child_id = p_child_id, description = normalized_description, amount_pln = p_amount_pln,
      start_date = p_start_date, end_date = p_end_date
  where id = p_recurring_expense_id;
  return p_recurring_expense_id;
end;
$$;

create function public.set_recurring_expense_active(p_recurring_expense_id uuid, p_is_active boolean)
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
begin
  if auth.uid() is null then raise exception 'Authentication is required to manage a recurring expense'; end if;
  select family_id, id into caller_family_id, caller_membership_id
  from public.family_members where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to manage recurring expenses'; end if;
  perform 1 from public.families where id = caller_family_id for update;
  select family_id, payer_id into recurring_family_id, recurring_payer_id
  from public.recurring_expenses where id = p_recurring_expense_id for update;
  if recurring_family_id is null or recurring_family_id <> caller_family_id then raise exception 'Recurring expense is not available to this family'; end if;
  if recurring_payer_id <> caller_membership_id then raise exception 'Only the payer can manage this recurring expense'; end if;
  if exists (select 1 from public.recurring_expenses where id = p_recurring_expense_id and archived_at is not null) then
    raise exception 'Stopped recurring expenses cannot be resumed';
  end if;
  update public.recurring_expenses set is_active = p_is_active where id = p_recurring_expense_id;
  return p_recurring_expense_id;
end;
$$;

create function public.archive_recurring_expense(p_recurring_expense_id uuid)
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
begin
  if auth.uid() is null then raise exception 'Authentication is required to stop a recurring expense'; end if;
  select family_id, id into caller_family_id, caller_membership_id
  from public.family_members where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to manage recurring expenses'; end if;
  perform 1 from public.families where id = caller_family_id for update;
  select family_id, payer_id into recurring_family_id, recurring_payer_id
  from public.recurring_expenses where id = p_recurring_expense_id for update;
  if recurring_family_id is null or recurring_family_id <> caller_family_id then raise exception 'Recurring expense is not available to this family'; end if;
  if recurring_payer_id <> caller_membership_id then raise exception 'Only the payer can manage this recurring expense'; end if;
  update public.recurring_expenses set is_active = false, archived_at = coalesce(archived_at, now())
  where id = p_recurring_expense_id;
  return p_recurring_expense_id;
end;
$$;

revoke all on function public.create_recurring_expense(uuid, text, numeric, date, date) from public;
grant execute on function public.create_recurring_expense(uuid, text, numeric, date, date) to authenticated;
revoke all on function public.update_recurring_expense(uuid, uuid, text, numeric, date, date) from public;
grant execute on function public.update_recurring_expense(uuid, uuid, text, numeric, date, date) to authenticated;
revoke all on function public.set_recurring_expense_active(uuid, boolean) from public;
grant execute on function public.set_recurring_expense_active(uuid, boolean) to authenticated;
revoke all on function public.archive_recurring_expense(uuid) from public;
grant execute on function public.archive_recurring_expense(uuid) to authenticated;
