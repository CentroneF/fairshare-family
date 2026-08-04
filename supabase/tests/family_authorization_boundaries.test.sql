begin;

select plan(14);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('71000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'authorization-parent-a1@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('72000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'authorization-parent-a2@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('73000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'authorization-parent-b1@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('74000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'authorization-parent-b2@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.families (id, created_by, name)
values
  ('75000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Authorization family A'),
  ('76000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001', 'Authorization family B');

insert into public.family_members (id, family_id, user_id)
values
  ('75100000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001'),
  ('75200000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', '72000000-0000-0000-0000-000000000001'),
  ('76100000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000001'),
  ('76200000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', '74000000-0000-0000-0000-000000000001');

insert into public.children (id, family_id, name)
values
  ('75300000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001', 'Authorization child A'),
  ('76300000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001', 'Authorization child B');

insert into public.expenses (
  id, family_id, child_id, payer_id, description, expense_date, amount_pln, status, reviewed_by, reviewed_at
)
values
  (
    '75400000-0000-0000-0000-000000000001', '75000000-0000-0000-0000-000000000001',
    '75300000-0000-0000-0000-000000000001', '75100000-0000-0000-0000-000000000001',
    'Family A protected expense', (date_trunc('month', current_date) - interval '1 month')::date,
    25.00, 'approved', '75200000-0000-0000-0000-000000000001', now()
  ),
  (
    '76400000-0000-0000-0000-000000000001', '76000000-0000-0000-0000-000000000001',
    '76300000-0000-0000-0000-000000000001', '76100000-0000-0000-0000-000000000001',
    'Family B settlement expense', (date_trunc('month', current_date) - interval '1 month')::date,
    30.00, 'approved', '76200000-0000-0000-0000-000000000001', now()
  );

insert into public.monthly_settlements (family_id, report_month)
values ('75000000-0000-0000-0000-000000000001', (date_trunc('month', current_date) - interval '2 months')::date);

set local role authenticated;
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  (select count(*) from public.expenses where family_id = '76000000-0000-0000-0000-000000000001'),
  1::bigint,
  'an active parent can read their own family expense'
);
select is((select count(*) from public.families where id = '75000000-0000-0000-0000-000000000001'), 0::bigint, 'an active parent cannot read another family');
select is((select count(*) from public.family_members where family_id = '75000000-0000-0000-0000-000000000001'), 0::bigint, 'an active parent cannot read another family memberships');
select is((select count(*) from public.children where family_id = '75000000-0000-0000-0000-000000000001'), 0::bigint, 'an active parent cannot read another family children');
select is((select count(*) from public.expenses where family_id = '75000000-0000-0000-0000-000000000001'), 0::bigint, 'an active parent cannot read another family expenses');
select is((select count(*) from public.monthly_settlements where family_id = '75000000-0000-0000-0000-000000000001'), 0::bigint, 'an active parent cannot read another family settlements');

select throws_ok(
  $$insert into public.expenses (family_id, payer_id, description, expense_date, amount_pln) values ('76000000-0000-0000-0000-000000000001', '76100000-0000-0000-0000-000000000001', 'Denied direct insert', current_date, 1.00)$$,
  '42501', 'permission denied for table expenses', 'authenticated direct expense insert is denied'
);
select throws_ok(
  $$update public.expenses set description = 'Denied direct update' where id = '76400000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table expenses', 'authenticated direct expense update is denied'
);
select throws_ok(
  $$delete from public.expenses where id = '76400000-0000-0000-0000-000000000001'$$,
  '42501', 'permission denied for table expenses', 'authenticated direct expense delete is denied'
);
select throws_ok(
  $$select public.update_expense('75400000-0000-0000-0000-000000000001', null, 'Foreign overwrite', current_date - 1, 99.00)$$,
  'P0001', 'Expense is not available to this family', 'a parent cannot update another family expense'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select is(
  (
    select description || ':' || expense_date::text || ':' || amount_pln::text || ':' || status::text || ':' ||
      coalesce(reviewed_by::text, '') || ':' || coalesce(decline_reason, '')
    from public.expenses where id = '75400000-0000-0000-0000-000000000001'
  ),
  'Family A protected expense:' || (date_trunc('month', current_date) - interval '1 month')::date::text ||
    ':25.00:approved:75200000-0000-0000-0000-000000000001:',
  'a rejected foreign update leaves the victim expense unchanged'
);

select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.confirm_monthly_settlement((date_trunc('month', current_date) - interval '1 month')::date)$$,
  'a parent can confirm their own eligible past-month settlement'
);
select is(
  (select count(*) from public.monthly_settlements where family_id = '76000000-0000-0000-0000-000000000001' and report_month = (date_trunc('month', current_date) - interval '1 month')::date),
  1::bigint,
  'settlement confirmation creates only the caller family settlement'
);

select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*) from public.monthly_settlements where family_id = '75000000-0000-0000-0000-000000000001' and report_month = (date_trunc('month', current_date) - interval '1 month')::date),
  0::bigint,
  'caller scoped settlement confirmation leaves another family same-month settlement absent'
);

select * from finish();

rollback;
