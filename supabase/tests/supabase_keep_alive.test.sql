begin;

select plan(6);

set local role anon;

select is(public.keep_alive(), true, 'anonymous callers receive the fixed keep-alive value');

select throws_ok(
  $$select * from public.families$$,
  '42501',
  'permission denied for table families',
  'anonymous callers cannot read families'
);
select throws_ok(
  $$select * from public.family_members$$,
  '42501',
  'permission denied for table family_members',
  'anonymous callers cannot read family memberships'
);
select throws_ok(
  $$select * from public.children$$,
  '42501',
  'permission denied for table children',
  'anonymous callers cannot read children'
);
select throws_ok(
  $$select * from public.expenses$$,
  '42501',
  'permission denied for table expenses',
  'anonymous callers cannot read expenses'
);
select throws_ok(
  $$select * from public.monthly_settlements$$,
  '42501',
  'permission denied for table monthly_settlements',
  'anonymous callers cannot read monthly settlements'
);

select * from finish();

rollback;
