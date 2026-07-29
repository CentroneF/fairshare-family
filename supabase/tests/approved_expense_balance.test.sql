begin;

select plan(62);

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
  family_id, report_month, status, first_confirmed_by, first_confirmed_at, second_confirmed_by, second_confirmed_at, settled_at
)
values
  (
    '54000000-0000-0000-0000-000000000001', date_trunc('month', current_date - interval '2 months')::date, 'settled',
    '54100000-0000-0000-0000-000000000001', now(), '54200000-0000-0000-0000-000000000001', now(), now()
  ),
  (
    '54000000-0000-0000-0000-000000000001', date_trunc('month', current_date - interval '3 months')::date, 'settled',
    '54100000-0000-0000-0000-000000000001', now(), '54200000-0000-0000-0000-000000000001', now(), now()
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
  'P0001', 'Expenses in a settled month cannot be updated', 'editing rejects a settled destination month'
);
select lives_ok(
  $$select public.create_expense(null, 'Settled correction candidate', (current_date - interval '3 months')::date, 10.00)$$,
  'a settled-month expense can be prepared for source-settlement testing'
);
select throws_ok(
  $$select public.update_expense((select id from public.expenses where description = 'Settled correction candidate'), null, 'Blocked source', (current_date - interval '1 month')::date, 10.00)$$,
  'P0001', 'Expenses in a settled month cannot be updated', 'editing rejects a settled source month'
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
  'P0001', 'Expenses in a settled month cannot be deleted', 'settled-month expenses cannot be deleted'
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

select * from finish();
rollback;
