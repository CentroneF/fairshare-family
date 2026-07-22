create function public.approve_expense(p_expense_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  caller_family_id uuid;
  caller_membership_id uuid;
  active_parent_count integer;
  expense_family_id uuid;
  expense_payer_id uuid;
  expense_status public.expense_status;
  approved_expense_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to approve an expense';
  end if;

  select family_id, id
    into caller_family_id, caller_membership_id
    from public.family_members
   where user_id = auth.uid()
     and role = 'parent'
     and is_active;

  if caller_family_id is null then
    raise exception 'An active family membership is required to approve an expense';
  end if;

  select count(*)
    into active_parent_count
    from public.family_members
   where family_id = caller_family_id
     and role = 'parent'
     and is_active;

  if active_parent_count <> 2 then
    raise exception 'Exactly two active parents are required to approve an expense';
  end if;

  select family_id, payer_id, status
    into expense_family_id, expense_payer_id, expense_status
    from public.expenses
   where id = p_expense_id
   for update;

  if expense_family_id is null or expense_family_id <> caller_family_id then
    raise exception 'Expense is not available to this family';
  end if;

  if expense_payer_id = caller_membership_id then
    raise exception 'Only the other parent can approve an expense';
  end if;

  if expense_status <> 'pending' then
    raise exception 'Expense has already been reviewed';
  end if;

  update public.expenses
     set status = 'approved',
         reviewed_by = caller_membership_id,
         reviewed_at = now()
   where id = p_expense_id
     and status = 'pending'
  returning id into approved_expense_id;

  if approved_expense_id is null then
    raise exception 'Expense has already been reviewed';
  end if;

  return approved_expense_id;
end;
$$;

revoke all on function public.approve_expense(uuid) from public;
grant execute on function public.approve_expense(uuid) to authenticated;
