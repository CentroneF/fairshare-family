create function public.create_expense(
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
  if auth.uid() is null then
    raise exception 'Authentication is required to create an expense';
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
    into target_family_id, payer_membership_id
    from public.family_members
   where user_id = auth.uid()
     and role = 'parent'
     and is_active;

  if target_family_id is null then
    raise exception 'An active family membership is required to create an expense';
  end if;

  if p_child_id is not null and not exists (
    select 1 from public.children where id = p_child_id and family_id = target_family_id
  ) then
    raise exception 'Selected child is not available to this family';
  end if;

  insert into public.expenses (family_id, child_id, payer_id, description, expense_date, amount_pln)
  values (target_family_id, p_child_id, payer_membership_id, normalized_description, p_expense_date, p_amount_pln)
  returning id into created_expense_id;

  return created_expense_id;
end;
$$;

revoke all on function public.create_expense(uuid, text, date, numeric) from public;
grant execute on function public.create_expense(uuid, text, date, numeric) to authenticated;
