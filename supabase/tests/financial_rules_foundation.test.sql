begin;

select plan(9);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-parent-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rls-parent-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.families (id, created_by)
values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');

insert into public.family_members (id, family_id, user_id)
values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');

insert into public.expenses (id, family_id, payer_id, description, expense_date, amount_pln)
values
  ('32000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Family A expense', current_date, 10.00),
  ('42000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Family B expense', current_date, 10.00);

select has_table('public', 'expenses', 'expenses table exists');
select has_table('public', 'monthly_settlements', 'monthly settlements table exists');
select is(
  (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname in ('families', 'family_members', 'children', 'expenses', 'monthly_settlements') and relrowsecurity and relforcerowsecurity),
  5::bigint,
  'RLS is enabled and forced on every financial foundation table'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename in ('families', 'family_members', 'children', 'expenses', 'monthly_settlements') and cmd in ('INSERT', 'UPDATE', 'DELETE')),
  0::bigint,
  'direct table mutation policies are absent'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*) from public.expenses), 1::bigint, 'an authenticated parent sees only their family expenses');
select is((select count(*) from public.expenses where family_id = '40000000-0000-0000-0000-000000000001'), 0::bigint, 'an authenticated parent cannot read another family expenses');
select throws_ok(
  $$insert into public.expenses (family_id, payer_id, description, expense_date, amount_pln) values ('30000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'Denied insert', current_date, 1.00)$$,
  '42501',
  'permission denied for table expenses',
  'authenticated direct expense insert is denied'
);
select throws_ok(
  $$update public.expenses set description = 'Denied update' where id = '32000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table expenses',
  'authenticated direct expense update is denied'
);
select throws_ok(
  $$delete from public.expenses where id = '32000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table expenses',
  'authenticated direct expense delete is denied'
);

select * from finish();

rollback;
