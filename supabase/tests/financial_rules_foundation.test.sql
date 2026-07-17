begin;

select plan(4);

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

select * from finish();

rollback;
