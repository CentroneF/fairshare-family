create type public.recurring_expense_occurrence_outcome as enum ('created', 'skipped_locked');

create table public.recurring_expense_occurrences (
  id uuid primary key default gen_random_uuid(),
  recurring_expense_id uuid not null references public.recurring_expenses (id) on delete restrict,
  occurrence_month date not null check (occurrence_month = date_trunc('month', occurrence_month)::date),
  outcome public.recurring_expense_occurrence_outcome not null,
  expense_id uuid unique references public.expenses (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    (outcome = 'created' and expense_id is not null)
    or (outcome = 'skipped_locked' and expense_id is null)
  ),
  unique (recurring_expense_id, occurrence_month)
);

create index recurring_expense_occurrences_expense_idx
  on public.recurring_expense_occurrences (expense_id)
  where expense_id is not null;

alter table public.recurring_expense_occurrences enable row level security;
alter table public.recurring_expense_occurrences force row level security;

create policy "active parents can view recurring expense occurrences"
on public.recurring_expense_occurrences for select to authenticated
using (
  exists (
    select 1
    from public.recurring_expenses
    where recurring_expenses.id = recurring_expense_occurrences.recurring_expense_id
      and public.is_active_family_member(recurring_expenses.family_id)
  )
);

grant select on public.recurring_expense_occurrences to authenticated;

create function public.materialize_current_month_recurring_expenses()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_month date := date_trunc('month', current_date)::date;
  template_record record;
  revision_record record;
  created_expense_id uuid;
begin
  for template_record in
    select id, family_id, payer_id, child_id, description, amount_pln, start_date, end_date
    from public.recurring_expenses
    where is_active
      and archived_at is null
      and date_trunc('month', start_date)::date <= current_month
      and (end_date is null or date_trunc('month', end_date)::date >= current_month)
  loop
    perform 1 from public.families where id = template_record.family_id for update;

    if not exists (
      select 1 from public.family_members
      where id = template_record.payer_id
        and family_id = template_record.family_id
        and role = 'parent'
        and is_active
    ) then
      raise exception 'Recurring expense payer is not an active parent in its family';
    end if;

    if template_record.child_id is not null and not exists (
      select 1 from public.children
      where id = template_record.child_id and family_id = template_record.family_id
    ) then
      raise exception 'Recurring expense child is not available to its family';
    end if;

    select child_id, description, amount_pln, start_date, end_date
      into revision_record
      from public.recurring_expense_revisions
      where recurring_expense_id = template_record.id
        and effective_from <= current_month
      order by effective_from desc
      limit 1;

    if revision_record is not null then
      template_record.child_id := revision_record.child_id;
      template_record.description := revision_record.description;
      template_record.amount_pln := revision_record.amount_pln;
      template_record.start_date := revision_record.start_date;
      template_record.end_date := revision_record.end_date;
    end if;

    if date_trunc('month', template_record.start_date)::date > current_month
      or (template_record.end_date is not null and date_trunc('month', template_record.end_date)::date < current_month) then
      continue;
    end if;

    if template_record.child_id is not null and not exists (
      select 1 from public.children
      where id = template_record.child_id and family_id = template_record.family_id
    ) then
      raise exception 'Recurring expense revision child is not available to its family';
    end if;

    if exists (
      select 1 from public.monthly_settlements
      where family_id = template_record.family_id
        and report_month = current_month
        and (first_confirmed_by is not null or status = 'settled')
    ) then
      insert into public.recurring_expense_occurrences (recurring_expense_id, occurrence_month, outcome)
      values (template_record.id, current_month, 'skipped_locked')
      on conflict (recurring_expense_id, occurrence_month) do nothing;
      continue;
    end if;

    insert into public.expenses (family_id, child_id, payer_id, description, expense_date, amount_pln)
    select
      template_record.family_id,
      template_record.child_id,
      template_record.payer_id,
      btrim(template_record.description),
      current_month,
      template_record.amount_pln
    where not exists (
      select 1 from public.recurring_expense_occurrences
      where recurring_expense_id = template_record.id and occurrence_month = current_month
    )
    returning id into created_expense_id;

    if created_expense_id is not null then
      insert into public.recurring_expense_occurrences (recurring_expense_id, occurrence_month, outcome, expense_id)
      values (template_record.id, current_month, 'created', created_expense_id);
    end if;
  end loop;
end;
$$;

revoke all on function public.materialize_current_month_recurring_expenses() from public;
