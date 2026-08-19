create or replace function public.materialize_current_month_recurring_expenses()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_month date := date_trunc('month', current_date)::date;
  template_record record;
  created_expense_id uuid;
begin
  for template_record in
    select
      template.id,
      template.family_id,
      template.payer_id,
      case when revision.id is null then template.child_id else revision.child_id end as child_id,
      case when revision.id is null then template.description else revision.description end as description,
      case when revision.id is null then template.amount_pln else revision.amount_pln end as amount_pln,
      case when revision.id is null then template.start_date else revision.start_date end as start_date,
      case when revision.id is null then template.end_date else revision.end_date end as end_date
    from public.recurring_expenses as template
    left join lateral (
      select id, child_id, description, amount_pln, start_date, end_date
      from public.recurring_expense_revisions
      where recurring_expense_id = template.id
        and effective_from <= current_month
      order by effective_from desc
      limit 1
    ) as revision on true
    where template.is_active
      and template.archived_at is null
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

    if date_trunc('month', template_record.start_date)::date > current_month
      or (template_record.end_date is not null and date_trunc('month', template_record.end_date)::date < current_month) then
      continue;
    end if;

    if template_record.child_id is not null and not exists (
      select 1 from public.children
      where id = template_record.child_id and family_id = template_record.family_id
    ) then
      raise exception 'Recurring expense child is not available to its family';
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

    created_expense_id := null;
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
