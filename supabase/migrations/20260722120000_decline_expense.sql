alter table public.expenses add column decline_reason text;

alter table public.expenses add constraint expenses_decline_reason_matches_status check (
  (status in ('pending', 'approved') and decline_reason is null)
  or (
    status = 'declined'
    and decline_reason is not null
    and decline_reason = btrim(decline_reason)
    and decline_reason <> ''
    and char_length(decline_reason) <= 500
  )
);

create function public.decline_expense(p_expense_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  caller_family_id uuid; caller_membership_id uuid; active_parent_count integer;
  expense_family_id uuid; expense_payer_id uuid; expense_status public.expense_status;
  declined_expense_id uuid; normalized_reason text := btrim(p_reason);
begin
  if auth.uid() is null then raise exception 'Authentication is required to decline an expense'; end if;
  if normalized_reason is null or normalized_reason = '' or char_length(normalized_reason) > 500 then
    raise exception 'A decline reason between 1 and 500 characters is required';
  end if;
  select family_id, id into caller_family_id, caller_membership_id from public.family_members
   where user_id = auth.uid() and role = 'parent' and is_active;
  if caller_family_id is null then raise exception 'An active family membership is required to decline an expense'; end if;
  select count(*) into active_parent_count from public.family_members
   where family_id = caller_family_id and role = 'parent' and is_active;
  if active_parent_count <> 2 then raise exception 'Exactly two active parents are required to decline an expense'; end if;
  select family_id, payer_id, status into expense_family_id, expense_payer_id, expense_status from public.expenses
   where id = p_expense_id for update;
  if expense_family_id is null or expense_family_id <> caller_family_id then raise exception 'Expense is not available to this family'; end if;
  if expense_payer_id = caller_membership_id then raise exception 'Only the other parent can decline an expense'; end if;
  if expense_status <> 'pending' then raise exception 'Expense has already been reviewed'; end if;
  update public.expenses set status = 'declined', reviewed_by = caller_membership_id, reviewed_at = now(), decline_reason = normalized_reason
   where id = p_expense_id and status = 'pending' returning id into declined_expense_id;
  if declined_expense_id is null then raise exception 'Expense has already been reviewed'; end if;
  return declined_expense_id;
end;
$$;

revoke all on function public.decline_expense(uuid, text) from public;
grant execute on function public.decline_expense(uuid, text) to authenticated;
