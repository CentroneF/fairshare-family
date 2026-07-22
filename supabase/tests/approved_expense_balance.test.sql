begin;

select plan(16);

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

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

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

select * from finish();
rollback;
