begin;

select plan(156);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('51000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'expense-parent-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('52000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'expense-parent-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('53000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'expense-outsider@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('56000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'expense-outsider-partner@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.families (id, created_by, name)
values
  ('54000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'Expense family'),
  ('55000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001', 'Other family');

insert into public.family_members (id, family_id, user_id)
values
  ('54100000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001'),
  ('54200000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001'),
  ('55100000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000001'),
  ('55200000-0000-0000-0000-000000000001', '55000000-0000-0000-0000-000000000001', '56000000-0000-0000-0000-000000000001');

insert into public.children (id, family_id, name)
values ('54300000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000001', 'Child A');

insert into public.monthly_settlements (
  family_id, report_month, status, first_confirmed_by, first_confirmed_at, second_confirmed_by, second_confirmed_at, settled_at,
  approved_amount_pln, first_confirmed_contribution_pln, second_confirmed_contribution_pln, payment_amount_pln
)
values
  (
    '54000000-0000-0000-0000-000000000001', date_trunc('month', current_date - interval '2 months')::date, 'settled',
    '54100000-0000-0000-0000-000000000001', now(), '54200000-0000-0000-0000-000000000001', now(), now(),
    0.00, 0.00, 0.00, 0
  ),
  (
    '54000000-0000-0000-0000-000000000001', date_trunc('month', current_date - interval '3 months')::date, 'settled',
    '54100000-0000-0000-0000-000000000001', now(), '54200000-0000-0000-0000-000000000001', now(), now(),
    0.00, 0.00, 0.00, 0
  );

insert into public.expenses (
  family_id, payer_id, description, expense_date, amount_pln, status, reviewed_by, reviewed_at
)
values
  (
    '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001', 'History approved one',
    (current_date - interval '1 month')::date, 10.25, 'approved', '54200000-0000-0000-0000-000000000001', now()
  ),
  (
    '54000000-0000-0000-0000-000000000001', '54200000-0000-0000-0000-000000000001', 'History approved two',
    (current_date - interval '1 month')::date, 0.10, 'approved', '54100000-0000-0000-0000-000000000001', now()
  ),
  (
    '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001', 'Settled correction candidate',
    (current_date - interval '3 months')::date, 10.00, 'pending', null, null
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (
    select approved_amount::text
      from public.list_monthly_report_history(
        '54000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date
      )
     where report_month = date_trunc('month', current_date - interval '1 month')::date
  ),
  '10.35',
  'report history aggregates approved amounts exactly by month'
);
select throws_ok(
  $$select public.list_monthly_report_history('54000000-0000-0000-0000-000000000001', (date_trunc('month', current_date) + interval '1 month')::date)$$,
  'P0001', 'Report history cannot end in the future', 'report history rejects a future cutoff'
);
select is(
  (
    select status::text
      from public.list_monthly_report_history(
        '54000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date
      )
     where report_month = date_trunc('month', current_date - interval '2 months')::date
  ),
  'settled',
  'report history retains a settled month status'
);

select lives_ok(
  $$select public.create_expense('54300000-0000-0000-0000-000000000001', 'School supplies', current_date, 12.50)$$,
  'an active parent creates a child-linked pending expense'
);
select is((select amount_pln::text from public.expenses where description = 'School supplies'), '12.50', 'expense keeps exact decimal amount');
select is((select status::text from public.expenses where description = 'School supplies'), 'pending', 'created expense is pending');
select is((select child_id from public.expenses where description = 'School supplies'), '54300000-0000-0000-0000-000000000001'::uuid, 'expense keeps selected child');
select lives_ok(
  $$select public.create_expense(null, 'Shared transport', current_date - 1, 1.00)$$,
  'an active parent creates a past N/A expense'
);
select throws_ok(
  $$select public.create_expense(null, 'Future', current_date + 1, 1.00)$$,
  'P0001', 'Expense date cannot be in the future', 'future dates are rejected'
);
select throws_ok(
  $$select public.create_expense(null, 'Too precise', current_date, 1.001)$$,
  'P0001', 'Amount must be a positive PLN value with at most two decimal places', 'three-decimal amounts are rejected'
);
select throws_ok(
  $$select public.create_expense('00000000-0000-0000-0000-000000000001', 'Wrong child', current_date, 1.00)$$,
  'P0001', 'Selected child is not available to this family', 'cross-family children are rejected'
);
select lives_ok(
  $$select public.create_expense(null, 'Approval candidate', current_date, 20.00)$$,
  'a pending expense can be prepared for approval'
);
select throws_ok(
  $$select public.approve_expense((select id from public.expenses where description = 'Approval candidate'))$$,
  'P0001', 'Only the other parent can approve an expense', 'a payer cannot approve their own expense'
);

select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.approve_expense((select id from public.expenses where description = 'Approval candidate'))$$,
  'the other active parent approves a pending expense'
);
select is((select status::text from public.expenses where description = 'Approval candidate'), 'approved', 'approval resolves the expense');
select is((select reviewed_by from public.expenses where description = 'Approval candidate'), '54200000-0000-0000-0000-000000000001'::uuid, 'approval records the other parent as reviewer');
select throws_ok(
  $$select public.approve_expense((select id from public.expenses where description = 'Approval candidate'))$$,
  'P0001', 'Expense has already been reviewed', 'a resolved expense cannot be approved again'
);

select set_config('request.jwt.claim.sub', '56000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.approve_expense((select id from public.expenses where description = 'Approval candidate'))$$,
  'P0001', 'Expense is not available to this family', 'an active parent cannot approve another family expense'
);

select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.approve_expense('00000000-0000-0000-0000-000000000009')$$,
  'P0001', 'Expense is not available to this family', 'a missing expense is rejected safely'
);

select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.create_expense(null, 'Decline candidate', current_date, 18.00)$$,
  'a pending expense can be prepared for decline'
);
select throws_ok(
  $$select public.decline_expense((select id from public.expenses where description = 'Decline candidate'), 'Duplicate')$$,
  'P0001', 'Only the other parent can decline an expense', 'a payer cannot decline their own expense'
);

select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.decline_expense((select id from public.expenses where description = 'Decline candidate'), ' ')$$,
  'P0001', 'A decline reason between 1 and 500 characters is required', 'a blank decline reason is rejected'
);
select throws_ok(
  $$select public.decline_expense((select id from public.expenses where description = 'Decline candidate'), repeat('x', 501))$$,
  'P0001', 'A decline reason between 1 and 500 characters is required', 'an oversized decline reason is rejected'
);
select lives_ok(
  $$select public.decline_expense((select id from public.expenses where description = 'Decline candidate'), ' Duplicate charge ')$$,
  'the other active parent declines a pending expense with a reason'
);
select is((select status::text from public.expenses where description = 'Decline candidate'), 'declined', 'decline resolves the expense');
select is((select decline_reason from public.expenses where description = 'Decline candidate'), 'Duplicate charge', 'decline stores a trimmed reason');
select is((select reviewed_by from public.expenses where description = 'Decline candidate'), '54200000-0000-0000-0000-000000000001'::uuid, 'decline records the other parent as reviewer');
select throws_ok(
  $$select public.decline_expense((select id from public.expenses where description = 'Decline candidate'), 'Another reason')$$,
  'P0001', 'Expense has already been reviewed', 'a resolved expense cannot be declined again'
);

select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.update_expense((select id from public.expenses where description = 'Approval candidate'), null, 'Updated approval candidate', current_date - 1, 21.00)$$,
  'the payer can edit an approved expense'
);
select is((select status::text from public.expenses where description = 'Updated approval candidate'), 'pending', 'editing approved resets it to pending');
select is((select reviewed_by from public.expenses where description = 'Updated approval candidate'), null::uuid, 'editing approved clears reviewer metadata');
select is((select amount_pln::text from public.expenses where description = 'Updated approval candidate'), '21.00', 'editing approved changes allowed fields');
select lives_ok(
  $$select public.update_expense((select id from public.expenses where description = 'Decline candidate'), null, 'Updated decline candidate', current_date - 1, 19.00)$$,
  'the payer can edit a declined expense'
);
select is((select status::text from public.expenses where description = 'Updated decline candidate'), 'pending', 'editing declined resets it to pending');
select is((select decline_reason from public.expenses where description = 'Updated decline candidate'), null::text, 'editing declined clears the active reason');
select is((select previous_decline_reason from public.expenses where description = 'Updated decline candidate'), 'Duplicate charge', 'editing declined retains the prior reason');
select throws_ok(
  $$select public.update_expense((select id from public.expenses where description = 'Updated decline candidate'), '00000000-0000-0000-0000-000000000001', 'Wrong child', current_date - 1, 19.00)$$,
  'P0001', 'Selected child is not available to this family', 'editing rejects a cross-family child'
);
select throws_ok(
  $$select public.update_expense((select id from public.expenses where description = 'Updated decline candidate'), null, 'Future edit', current_date + 1, 19.00)$$,
  'P0001', 'Expense date cannot be in the future', 'editing rejects a future date'
);
select lives_ok(
  $$select public.create_expense(null, 'Open correction candidate', (current_date - interval '1 month')::date, 11.00)$$,
  'an open-month expense can be prepared for destination-settlement testing'
);
select throws_ok(
  $$select public.update_expense((select id from public.expenses where description = 'Open correction candidate'), null, 'Blocked destination', (current_date - interval '2 months')::date, 11.00)$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'editing rejects a settled destination month'
);
select is(
  (select description || ':' || expense_date::text || ':' || amount_pln::text || ':' || status::text
     from public.expenses where description = 'Open correction candidate'),
  'Open correction candidate:' || (current_date - interval '1 month')::date::text || ':11.00:pending',
  'blocked settled destination edit preserves its expense'
);
select throws_ok(
  $$select public.update_expense((select id from public.expenses where description = 'Settled correction candidate'), null, 'Blocked source', (current_date - interval '1 month')::date, 10.00)$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'editing rejects a settled source month'
);
select is(
  (select description || ':' || expense_date::text || ':' || amount_pln::text || ':' || status::text
     from public.expenses where description = 'Settled correction candidate'),
  'Settled correction candidate:' || (current_date - interval '3 months')::date::text || ':10.00:pending',
  'blocked settled source edit preserves its expense'
);

select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.update_expense((select id from public.expenses where description = 'Updated decline candidate'), null, 'Not payer', current_date - 1, 19.00)$$,
  'P0001', 'Only the payer can update this expense', 'the other parent cannot edit the payer expense'
);

select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.create_expense(null, 'Delete pending candidate', current_date - 1, 7.00)$$,
  'a pending expense can be prepared for deletion'
);
select lives_ok(
  $$select public.delete_expense((select id from public.expenses where description = 'Delete pending candidate'))$$,
  'the payer can delete a pending expense'
);
select is_empty($$select 1 from public.expenses where description = 'Delete pending candidate'$$, 'pending deletion removes the expense');
select lives_ok(
  $$select public.create_expense(null, 'Delete declined candidate', current_date - 1, 8.00)$$,
  'a pending expense can be prepared for declined deletion'
);
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.decline_expense((select id from public.expenses where description = 'Delete declined candidate'), 'Duplicate')$$,
  'the other parent can decline a deletable expense'
);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.delete_expense((select id from public.expenses where description = 'Delete declined candidate'))$$,
  'the payer can delete a declined expense'
);
select is_empty($$select 1 from public.expenses where description = 'Delete declined candidate'$$, 'declined deletion removes the expense');
select lives_ok(
  $$select public.create_expense(null, 'Delete approved candidate', current_date - 1, 9.00)$$,
  'a pending expense can be prepared for approved-delete denial'
);
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.approve_expense((select id from public.expenses where description = 'Delete approved candidate'))$$,
  'the other parent approves the protected expense'
);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.delete_expense((select id from public.expenses where description = 'Delete approved candidate'))$$,
  'P0001', 'Only pending or declined expenses can be deleted', 'approved expenses cannot be deleted'
);
select throws_ok(
  $$select public.delete_expense((select id from public.expenses where description = 'Settled correction candidate'))$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'settled-month expenses cannot be deleted'
);
select is(
  (select status::text || ':' || amount_pln::text from public.expenses where description = 'Settled correction candidate'),
  'pending:10.00', 'blocked settled deletion retains its expense'
);
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.delete_expense((select id from public.expenses where description = 'Updated decline candidate'))$$,
  'P0001', 'Only the payer can delete this expense', 'the other parent cannot delete the payer expense'
);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select set_config('test.decline_candidate_id', (select id::text from public.expenses where description = 'Updated decline candidate'), true);
select throws_ok(
  $$update public.expenses set description = 'Tampered decline candidate' where description = 'Updated decline candidate'$$,
  '42501', 'permission denied for table expenses', 'direct authenticated expense updates are denied'
);
select throws_ok(
  $$delete from public.expenses where description = 'Updated decline candidate'$$,
  '42501', 'permission denied for table expenses', 'direct authenticated expense deletes are denied'
);
select throws_ok(
  $$update public.monthly_settlements set status = 'open' where family_id = '54000000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table monthly_settlements', 'direct authenticated settlement updates are denied'
);
select throws_ok(
  $$insert into public.monthly_settlements (family_id, report_month) values ('54000000-0000-0000-0000-000000000001', date_trunc('month', current_date - interval '5 months')::date)$$,
  '42501', 'permission denied for table monthly_settlements', 'direct authenticated settlement inserts are denied'
);
select throws_ok(
  $$delete from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table monthly_settlements', 'direct authenticated settlement deletes are denied'
);

select lives_ok(
  $$select public.create_expense(null, 'Settlement confirmation candidate', (current_date - interval '4 months')::date, 10.00)$$,
  'an unsettled past expense can be prepared for joint settlement'
);
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.approve_expense((select id from public.expenses where description = 'Settlement confirmation candidate'))$$,
  'the other parent approves a settlement candidate'
);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date - interval '4 months')::date)$$,
  'the first parent confirms an eligible past month'
);
select is(
  (select status::text from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001' and report_month = date_trunc('month', current_date - interval '4 months')::date),
  'open', 'the first confirmation leaves the settlement open'
);
select is(
  (select first_confirmed_by from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001' and report_month = date_trunc('month', current_date - interval '4 months')::date),
  '54100000-0000-0000-0000-000000000001'::uuid, 'the first confirmation records parent A'
);
select is(
  (select second_confirmed_by from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001' and report_month = date_trunc('month', current_date - interval '4 months')::date),
  null::uuid, 'the first confirmation does not pre-fill the second parent'
);
select throws_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date - interval '4 months')::date)$$,
  'P0001', 'You have already confirmed this settlement', 'the first parent cannot confirm twice'
);
select is(
  (select status::text || ':' || first_confirmed_by::text || ':' || coalesce(second_confirmed_by::text, 'null') || ':' || coalesce(approved_amount_pln::text, 'null') || ':' || coalesce(first_confirmed_contribution_pln::text, 'null') || ':' || coalesce(second_confirmed_contribution_pln::text, 'null') || ':' || coalesce(payment_amount_pln::text, 'null') || ':' || coalesce(payment_from_membership_id::text, 'null') || ':' || coalesce(payment_to_membership_id::text, 'null')
    from public.monthly_settlements
   where family_id = '54000000-0000-0000-0000-000000000001'
     and report_month = date_trunc('month', current_date - interval '4 months')::date),
  'open:54100000-0000-0000-0000-000000000001:null:null:null:null:null:null:null',
  'duplicate first confirmation preserves open state, first confirmer, and empty snapshots'
);
select throws_ok(
  $$select public.create_expense(null, 'Blocked after confirmation', (current_date - interval '4 months')::date, 1.00)$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'first confirmation locks expense creation'
);
select is_empty(
  $$select 1 from public.expenses where description = 'Blocked after confirmation'$$,
  'blocked first-confirmed creation leaves no expense row'
);
select throws_ok(
  $$select public.update_expense((select id from public.expenses where description = 'Settlement confirmation candidate'), null, 'Blocked update after confirmation', (current_date - interval '4 months')::date, 10.00)$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'first confirmation locks expense updates'
);
select is(
  (select description || ':' || expense_date::text || ':' || amount_pln::text || ':' || status::text
     from public.expenses where description = 'Settlement confirmation candidate'),
  'Settlement confirmation candidate:' || (current_date - interval '4 months')::date::text || ':10.00:approved',
  'blocked first-confirmed update preserves editable fields and status'
);

set local role postgres;
insert into public.expenses (
  family_id, payer_id, description, expense_date, amount_pln, status, reviewed_by, reviewed_at, decline_reason
)
values
  (
    '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001',
    'Locked approval candidate', (current_date - interval '4 months')::date, 2.00, 'pending', null, null, null
  ),
  (
    '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001',
    'Locked decline candidate', (current_date - interval '4 months')::date, 3.00, 'pending', null, null, null
  ),
  (
    '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001',
    'Locked delete candidate', (current_date - interval '4 months')::date, 4.00, 'declined',
    '54200000-0000-0000-0000-000000000001', now(), 'Duplicate'
  ),
  (
    '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001',
    'First-confirmed source edit candidate', (current_date - interval '4 months')::date, 5.00, 'pending', null, null, null
  ),
  (
    '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001',
    'First-confirmed destination edit candidate', (current_date - interval '1 month')::date, 6.00, 'pending', null, null, null
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.delete_expense((select id from public.expenses where description = 'Locked delete candidate'))$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'first confirmation locks expense deletion'
);
select is(
  (select status::text || ':' || decline_reason from public.expenses where description = 'Locked delete candidate'),
  'declined:Duplicate', 'blocked first-confirmed deletion retains its declined expense'
);
select throws_ok(
  $$select public.update_expense((select id from public.expenses where description = 'First-confirmed source edit candidate'), null, 'Moved from first-confirmed month', (current_date - interval '1 month')::date, 5.00)$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'editing rejects a first-confirmed source month'
);
select is(
  (select description || ':' || expense_date::text || ':' || amount_pln::text || ':' || status::text
     from public.expenses where description = 'First-confirmed source edit candidate'),
  'First-confirmed source edit candidate:' || (current_date - interval '4 months')::date::text || ':5.00:pending',
  'blocked first-confirmed source edit preserves its expense'
);
select throws_ok(
  $$select public.update_expense((select id from public.expenses where description = 'First-confirmed destination edit candidate'), null, 'Moved into first-confirmed month', (current_date - interval '4 months')::date, 6.00)$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'editing rejects a first-confirmed destination month'
);
select is(
  (select description || ':' || expense_date::text || ':' || amount_pln::text || ':' || status::text
     from public.expenses where description = 'First-confirmed destination edit candidate'),
  'First-confirmed destination edit candidate:' || (current_date - interval '1 month')::date::text || ':6.00:pending',
  'blocked first-confirmed destination edit preserves its expense'
);
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.approve_expense((select id from public.expenses where description = 'Locked approval candidate'))$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'first confirmation locks expense approval'
);
select is(
  (select status::text || ':' || coalesce(reviewed_by::text, 'null') || ':' || coalesce(reviewed_at::text, 'null')
     from public.expenses where description = 'Locked approval candidate'),
  'pending:null:null', 'blocked first-confirmed approval preserves pending review metadata'
);
select throws_ok(
  $$select public.decline_expense((select id from public.expenses where description = 'Locked decline candidate'), 'Still wrong')$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'first confirmation locks expense decline'
);
select is(
  (select status::text || ':' || coalesce(reviewed_by::text, 'null') || ':' || coalesce(reviewed_at::text, 'null') || ':' || coalesce(decline_reason, 'null')
     from public.expenses where description = 'Locked decline candidate'),
  'pending:null:null:null', 'blocked first-confirmed decline preserves pending review metadata'
);

set local role postgres;
delete from public.expenses
 where description in ('Locked approval candidate', 'Locked decline candidate', 'Locked delete candidate', 'First-confirmed source edit candidate', 'First-confirmed destination edit candidate');

set local role authenticated;
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date - interval '4 months')::date)$$,
  'the second parent settles the unchanged month'
);
select is(
  (select status::text from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001' and report_month = date_trunc('month', current_date - interval '4 months')::date),
  'settled', 'the second confirmation settles the month'
);
select is(
  (select approved_amount_pln::text || ':' || first_confirmed_contribution_pln::text || ':' || second_confirmed_contribution_pln::text || ':' || payment_amount_pln::text
    from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001' and report_month = date_trunc('month', current_date - interval '4 months')::date),
  '10.00:10.00:0.00:5', 'final settlement stores the exact amount and both contributions'
);
select is(
  (select second_confirmed_by from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001' and report_month = date_trunc('month', current_date - interval '4 months')::date),
  '54200000-0000-0000-0000-000000000001'::uuid, 'the final settlement records distinct parent B second'
);
select is(
  (select payment_from_membership_id::text || ':' || payment_to_membership_id::text
    from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001' and report_month = date_trunc('month', current_date - interval '4 months')::date),
  '54200000-0000-0000-0000-000000000001:54100000-0000-0000-0000-000000000001',
  'the payment snapshot stores the exact payer and payee direction'
);
select throws_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date - interval '4 months')::date)$$,
  'P0001', 'This month has already been settled', 'a settled month cannot be confirmed again'
);
select is(
  (select status::text || ':' || first_confirmed_by::text || ':' || second_confirmed_by::text || ':' || approved_amount_pln::text || ':' || first_confirmed_contribution_pln::text || ':' || second_confirmed_contribution_pln::text || ':' || payment_amount_pln::text || ':' || payment_from_membership_id::text || ':' || payment_to_membership_id::text
    from public.monthly_settlements
   where family_id = '54000000-0000-0000-0000-000000000001'
     and report_month = date_trunc('month', current_date - interval '4 months')::date),
  'settled:54100000-0000-0000-0000-000000000001:54200000-0000-0000-0000-000000000001:10.00:10.00:0.00:5:54200000-0000-0000-0000-000000000001:54100000-0000-0000-0000-000000000001',
  'duplicate final confirmation preserves identities, totals, and payment direction'
);
select throws_ok(
  $$select public.create_expense(null, 'Blocked after settlement', (current_date - interval '4 months')::date, 1.00)$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'final settlement keeps expense creation locked'
);
select is_empty(
  $$select 1 from public.expenses where description = 'Blocked after settlement'$$,
  'blocked settled creation leaves no expense row'
);

set local role postgres;
insert into public.expenses (family_id, payer_id, description, expense_date, amount_pln)
values
  (
    '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001',
    'Settled approval candidate', (current_date - interval '4 months')::date, 2.00
  ),
  (
    '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001',
    'Settled decline candidate', (current_date - interval '4 months')::date, 3.00
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.approve_expense((select id from public.expenses where description = 'Settled approval candidate'))$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'final settlement locks expense approval'
);
select is(
  (select status::text || ':' || coalesce(reviewed_by::text, 'null') || ':' || coalesce(reviewed_at::text, 'null')
     from public.expenses where description = 'Settled approval candidate'),
  'pending:null:null', 'blocked settled approval preserves pending review metadata'
);
select throws_ok(
  $$select public.decline_expense((select id from public.expenses where description = 'Settled decline candidate'), 'Still wrong')$$,
  'P0001', 'Expenses in a confirmation-locked or settled month cannot be changed', 'final settlement locks expense decline'
);
select is(
  (select status::text || ':' || coalesce(reviewed_by::text, 'null') || ':' || coalesce(reviewed_at::text, 'null') || ':' || coalesce(decline_reason, 'null')
     from public.expenses where description = 'Settled decline candidate'),
  'pending:null:null:null', 'blocked settled decline preserves pending review metadata'
);

select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.create_expense(null, 'Balanced corrected candidate', (current_date - interval '5 months')::date, 9.00)$$,
  'parent A creates a candidate for the balanced lifecycle'
);
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.decline_expense((select id from public.expenses where description = 'Balanced corrected candidate'), 'Wrong amount')$$,
  'parent B declines the candidate before settlement'
);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.update_expense((select id from public.expenses where description = 'Balanced corrected candidate'), null, 'Balanced corrected candidate', (current_date - interval '5 months')::date, 10.00)$$,
  'parent A edits the declined expense back to pending'
);
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.approve_expense((select id from public.expenses where description = 'Balanced corrected candidate'))$$,
  'parent B re-approves the corrected expense'
);
select lives_ok(
  $$select public.create_expense(null, 'Balanced parent B candidate', (current_date - interval '5 months')::date, 10.00)$$,
  'parent B creates the equal contribution'
);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.approve_expense((select id from public.expenses where description = 'Balanced parent B candidate'))$$,
  'parent A approves parent B equal contribution'
);
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date - interval '5 months')::date)$$,
  'parent B provides the first balanced confirmation'
);
select is(
  (select status::text || ':' || first_confirmed_by::text
    from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001' and report_month = date_trunc('month', current_date - interval '5 months')::date),
  'open:54200000-0000-0000-0000-000000000001', 'balanced settlement remains open with parent B recorded first'
);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date - interval '5 months')::date)$$,
  'parent A provides the distinct second balanced confirmation'
);
select is(
  (select approved_amount_pln::text || ':' || first_confirmed_contribution_pln::text || ':' || second_confirmed_contribution_pln::text || ':' || payment_amount_pln::text
    from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001' and report_month = date_trunc('month', current_date - interval '5 months')::date),
  '20.00:10.00:10.00:0', 'balanced settlement stores exact equal contributions and zero payment'
);
select is(
  (select payment_from_membership_id::text || ':' || payment_to_membership_id::text
    from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001' and report_month = date_trunc('month', current_date - interval '5 months')::date),
  null::text, 'balanced settlement stores no payer or payee'
);

select throws_ok(
  $$select public.confirm_monthly_settlement((date_trunc('month', current_date - interval '6 months') + interval '1 day')::date)$$,
  'P0001', 'Settlement month must be the first day of a month', 'settlement rejects a non-first report date'
);
select throws_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date)::date)$$,
  'P0001', 'Only past months can be settled', 'settlement rejects the current month'
);
select throws_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date + interval '1 month')::date)$$,
  'P0001', 'Only past months can be settled', 'settlement rejects a future month'
);
select throws_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date - interval '6 months')::date)$$,
  'P0001', 'A month with no expenses cannot be settled', 'settlement rejects an empty past month'
);

set local role postgres;
insert into public.expenses (family_id, payer_id, description, expense_date, amount_pln)
values (
  '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001',
  'Ineligible pending report', (current_date - interval '7 months')::date, 1.00
);
insert into public.expenses (
  family_id, payer_id, description, expense_date, amount_pln, status, reviewed_by, reviewed_at, decline_reason
)
values (
  '54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001',
  'Ineligible declined report', (current_date - interval '8 months')::date, 1.00, 'declined',
  '54200000-0000-0000-0000-000000000001', now(), 'Duplicate'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date - interval '7 months')::date)$$,
  'P0001', 'All expenses must be approved before settlement', 'settlement rejects a pending report'
);
select throws_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date - interval '8 months')::date)$$,
  'P0001', 'All expenses must be approved before settlement', 'settlement rejects a declined report'
);
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.confirm_monthly_settlement(date_trunc('month', current_date - interval '6 months')::date)$$,
  'P0001', 'Authentication is required to confirm settlement', 'an unauthenticated caller cannot confirm settlement'
);

select set_config('request.jwt.claim.sub', '56000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.list_monthly_report_history('54000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date)$$,
  'P0001', 'Family is not available', 'an active parent cannot read another family report history'
);
select throws_ok(
  $$select public.decline_expense(current_setting('test.decline_candidate_id')::uuid, 'Not mine')$$,
  'P0001', 'Expense is not available to this family', 'an active parent cannot decline another family expense'
);
select throws_ok(
  $$select public.delete_expense(current_setting('test.decline_candidate_id')::uuid)$$,
  'P0001', 'Expense is not available to this family', 'an active parent cannot delete another family expense'
);
select is_empty(
  $$select decline_reason from public.expenses where description = 'Updated decline candidate'$$,
  'a non-member cannot read a decline reason'
);
select is_empty(
  $$select 1 from public.monthly_settlements where family_id = '54000000-0000-0000-0000-000000000001'$$,
  'a non-member cannot read another family settlement'
);

select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.create_recurring_expense('54300000-0000-0000-0000-000000000001', 'Music lessons', 45.50, current_date, current_date + 30)$$,
  'a paying parent creates a child-linked recurring expense'
);
select is(
  (select description || ':' || amount_pln::text || ':' || is_active::text from public.recurring_expenses where description = 'Music lessons'),
  'Music lessons:45.50:true', 'the recurring template stores its normalized schedule data'
);
select lives_ok(
  $$select public.create_recurring_expense(null, 'Family subscription', 12.00, current_date, null)$$,
  'a paying parent can create an until-cancelled recurring expense'
);
select throws_ok(
  $$select public.create_recurring_expense(null, 'Invalid range', 12.00, current_date, current_date - 1)$$,
  'P0001', 'Recurring expense end date must be on or after the start date', 'recurring expenses reject an invalid date range'
);
select throws_ok(
  $$select public.create_recurring_expense(null, 'Too precise schedule', 1.001, current_date, null)$$,
  'P0001', 'Amount must be a positive PLN value with at most two decimal places', 'recurring expenses reject over-precise PLN amounts'
);
select throws_ok(
  $$select public.create_recurring_expense('00000000-0000-0000-0000-000000000001', 'Wrong child schedule', 12.00, current_date, null)$$,
  'P0001', 'Selected child is not available to this family', 'recurring expenses reject cross-family children'
);
select throws_ok(
  $$insert into public.recurring_expenses (family_id, payer_id, description, amount_pln, start_date) values ('54000000-0000-0000-0000-000000000001', '54100000-0000-0000-0000-000000000001', 'Tampered schedule', 1.00, current_date)$$,
  '42501', 'permission denied for table recurring_expenses', 'direct authenticated recurring-expense writes are denied'
);
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.update_recurring_expense((select id from public.recurring_expenses where description = 'Music lessons'), null, 'Tampered music lessons', 50.00, (date_trunc('month', current_date) + interval '1 month')::date, null)$$,
  'P0001', 'Only the payer can manage this recurring expense', 'the other parent cannot edit a payer recurring expense'
);
select throws_ok(
  $$select public.set_recurring_expense_active((select id from public.recurring_expenses where description = 'Music lessons'), false)$$,
  'P0001', 'Only the payer can manage this recurring expense', 'the other parent cannot pause a payer recurring expense'
);
select throws_ok(
  $$select public.archive_recurring_expense((select id from public.recurring_expenses where description = 'Music lessons'))$$,
  'P0001', 'Only the payer can manage this recurring expense', 'the other parent cannot stop a payer recurring expense'
);
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.set_recurring_expense_active((select id from public.recurring_expenses where description = 'Music lessons'), false)$$,
  'the payer can pause a recurring expense'
);
select is((select is_active::text from public.recurring_expenses where description = 'Music lessons'), 'false', 'pause preserves the template and marks it inactive');
select lives_ok(
  $$select public.update_recurring_expense((select id from public.recurring_expenses where description = 'Music lessons'), null, 'Updated music lessons', 46.00, current_date, null)$$,
  'the payer schedules a recurring template edit for the following month'
);
select is(
  (select description || ':' || amount_pln::text from public.recurring_expenses where description = 'Music lessons'),
  'Music lessons:45.50', 'editing preserves the current template version'
);
select is(
  (select description || ':' || amount_pln::text || ':' || effective_from::text
    from public.recurring_expense_revisions
    where recurring_expense_id = (select id from public.recurring_expenses where description = 'Music lessons')),
  'Updated music lessons:46.00:' || (date_trunc('month', current_date) + interval '1 month')::date::text,
  'editing creates the replacement version for the following month'
);
select is(
  (select start_date::text from public.recurring_expense_revisions
    where recurring_expense_id = (select id from public.recurring_expenses where description = 'Music lessons')),
  (date_trunc('month', current_date) + interval '1 month')::date::text,
  'a revision cannot become eligible during the current month'
);
select lives_ok(
  $$select public.set_recurring_expense_active((select id from public.recurring_expenses where description = 'Music lessons'), true)$$,
  'the payer can resume a recurring expense'
);
select lives_ok(
  $$select public.archive_recurring_expense((select id from public.recurring_expenses where description = 'Music lessons'))$$,
  'the payer can stop a recurring expense'
);
select throws_ok(
  $$select public.set_recurring_expense_active((select id from public.recurring_expenses where description = 'Music lessons'), true)$$,
  'P0001', 'Stopped recurring expenses cannot be resumed', 'stopped recurring expenses remain archived'
);
select throws_ok(
  $$select public.update_recurring_expense((select id from public.recurring_expenses where description = 'Music lessons'), null, 'Stopped mutation', 99.00, current_date, null)$$,
  'P0001', 'Stopped recurring expenses cannot be edited', 'a stopped recurring expense cannot be edited'
);
select is(
  (select count(*)::text from public.recurring_expense_revisions
    where recurring_expense_id = (select id from public.recurring_expenses where description = 'Music lessons')),
  '1', 'a rejected stopped-template update leaves its scheduled revision unchanged'
);

select lives_ok(
  $$select public.create_recurring_expense(null, 'Generated subscription', 19.99, current_date, null)$$,
  'a parent creates an eligible template for materialization'
);
set local role postgres;
select lives_ok(
  $$select public.materialize_current_month_recurring_expenses()$$,
  'the database materializes eligible current-month recurring expenses'
);
select is(
  (select count(*)::text from public.recurring_expense_occurrences
    where recurring_expense_id = (select id from public.recurring_expenses where description = 'Generated subscription')
      and occurrence_month = date_trunc('month', current_date)::date),
  '1', 'an eligible template receives exactly one current-month occurrence'
);
select is(
  (select outcome::text from public.recurring_expense_occurrences
    where recurring_expense_id = (select id from public.recurring_expenses where description = 'Generated subscription')
      and occurrence_month = date_trunc('month', current_date)::date),
  'created', 'the eligible occurrence records its created outcome'
);
select is(
  (select status::text from public.expenses where id = (
    select expense_id from public.recurring_expense_occurrences
    where recurring_expense_id = (select id from public.recurring_expenses where description = 'Generated subscription')
      and occurrence_month = date_trunc('month', current_date)::date
  )),
  'pending', 'a materialized expense enters the normal pending lifecycle'
);
select lives_ok(
  $$select public.materialize_current_month_recurring_expenses()$$,
  'rerunning materialization is safe'
);
select is(
  (select count(*)::text from public.recurring_expense_occurrences
    where recurring_expense_id = (select id from public.recurring_expenses where description = 'Generated subscription')
      and occurrence_month = date_trunc('month', current_date)::date),
  '1', 'rerunning materialization does not duplicate an occurrence'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select throws_ok(
  $$select public.approve_expense((select expense_id from public.recurring_expense_occurrences where recurring_expense_id = (select id from public.recurring_expenses where description = 'Generated subscription')))$$,
  'P0001', 'Only the other parent can approve an expense', 'the generated expense payer cannot approve it'
);
select set_config('request.jwt.claim.sub', '52000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.approve_expense((select expense_id from public.recurring_expense_occurrences where recurring_expense_id = (select id from public.recurring_expenses where description = 'Generated subscription')))$$,
  'the other parent can approve a generated expense'
);
select is(
  (select reviewed_by from public.expenses where id = (
    select expense_id from public.recurring_expense_occurrences
    where recurring_expense_id = (select id from public.recurring_expenses where description = 'Generated subscription')
  )),
  '54200000-0000-0000-0000-000000000001'::uuid, 'generated approval records the other parent'
);
set local role postgres;
insert into public.monthly_settlements (family_id, report_month, first_confirmed_by, first_confirmed_at)
values ('55000000-0000-0000-0000-000000000001', date_trunc('month', current_date)::date, '55100000-0000-0000-0000-000000000001', now());
insert into public.recurring_expenses (family_id, payer_id, description, amount_pln, start_date)
values ('55000000-0000-0000-0000-000000000001', '55100000-0000-0000-0000-000000000001', 'Locked generated subscription', 7.00, current_date);
select lives_ok(
  $$select public.materialize_current_month_recurring_expenses()$$,
  'materialization handles locked-family templates without creating expenses'
);
select is(
  (select outcome::text from public.recurring_expense_occurrences
    where recurring_expense_id = (select id from public.recurring_expenses where description = 'Locked generated subscription')),
  'skipped_locked', 'a confirmation-locked month records an auditable skip'
);
select ok(
  (select expense_id is null from public.recurring_expense_occurrences
    where recurring_expense_id = (select id from public.recurring_expenses where description = 'Locked generated subscription')),
  'a skipped locked occurrence has no expense'
);
select is(
  (select count(*)::text from public.expenses where family_id = '55000000-0000-0000-0000-000000000001' and description = 'Locked generated subscription'),
  '0', 'a locked family receives no generated expense'
);
select ok(
  exists (
    select 1
    from cron.job
    where jobname = 'materialize-current-month-recurring-expenses'
      and schedule = '0 0 1 * *'
      and command = 'select public.materialize_current_month_recurring_expenses()'
      and active
  ),
  'the monthly recurring-expense materialization scheduler is registered'
);

select * from finish();
rollback;
