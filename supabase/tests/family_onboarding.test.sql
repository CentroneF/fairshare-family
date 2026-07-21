begin;

select plan(25);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'onboarding-parent-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('20000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'onboarding-parent-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'onboarding-parent-c@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('40000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', 'onboarding-parent-d@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select * from public.create_family('   ')$$,
  'P0001',
  'Family name is required',
  'a family name is required'
);

select set_config('test.family_id', (select family_id::text from public.create_family('  Kowalski  ')), true);
select set_config('test.join_code', public.get_family_join_code(), true);

select is(
  (select name from public.families where id = current_setting('test.family_id')::uuid),
  'Kowalski',
  'family creation stores the trimmed required name'
);
select ok(
  current_setting('test.join_code') ~ '^[A-Za-z0-9]{8}$',
  'family creation returns an opaque eight-character alphanumeric join code'
);
select is(
  (select count(*) from public.family_members where family_id = current_setting('test.family_id')::uuid),
  1::bigint,
  'family creation creates the creator membership'
);
select is(
  public.get_family_join_code(),
  current_setting('test.join_code'),
  'the waiting creator can retrieve the active code'
);
select ok(
  public.add_family_child('  Ada  ') is not null,
  'an active parent can add a trimmed child name'
);
select is(
  (select name from public.children where family_id = current_setting('test.family_id')::uuid),
  'Ada',
  'child creation stores a trimmed name'
);

select set_config('test.old_join_code', current_setting('test.join_code'), true);
select set_config('test.join_code', public.regenerate_family_join_code(), true);
select isnt(
  current_setting('test.join_code'),
  current_setting('test.old_join_code'),
  'regeneration replaces the old join code'
);
select ok(
  current_setting('test.join_code') ~ '^[A-Za-z0-9]{8}$',
  'regeneration returns an opaque eight-character alphanumeric join code'
);

reset role;
select is(
  (select count(*) from public.family_members where family_id = current_setting('test.family_id')::uuid),
  1::bigint,
  'regeneration does not create a membership'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  format($$select * from public.preview_family_join(%L)$$, current_setting('test.old_join_code')),
  'P0001',
  'Family join code is invalid or unavailable',
  'the regenerated old code is unavailable'
);
select is(
  (select family_name from public.preview_family_join(current_setting('test.join_code'))),
  'Kowalski',
  'a valid code previews the family name without joining'
);

reset role;
select is(
  (select count(*) from public.family_members where family_id = current_setting('test.family_id')::uuid),
  1::bigint,
  'preview does not create a membership'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is(
  public.confirm_family_join(current_setting('test.join_code')),
  current_setting('test.family_id')::uuid,
  'confirming a valid code joins the second parent'
);
select is(
  (select count(*) from public.family_members where family_id = current_setting('test.family_id')::uuid),
  2::bigint,
  'the joined second parent can view both family memberships'
);
select throws_ok(
  $$select public.get_family_join_code()$$,
  'P0001',
  'No active family join code is available',
  'the second parent cannot retrieve the join code'
);
select ok(
  public.add_family_child('Bea') is not null,
  'the joined second parent can add a child'
);
select is(
  (select count(*) from public.children where family_id = current_setting('test.family_id')::uuid),
  2::bigint,
  'the joined second parent can read shared children'
);

reset role;
insert into public.families (id, created_by, name)
values ('50000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000011', 'Case Family');
insert into public.family_join_codes (family_id, code)
values ('50000000-0000-0000-0000-000000000011', 'AbCd1234');
insert into public.family_members (family_id, user_id)
values ('50000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000011');

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select * from public.preview_family_join('aBCd1234')$$,
  'P0001',
  'Family join code is invalid or unavailable',
  'join codes are case-sensitive'
);
select is(
  (select family_name from public.preview_family_join('AbCd1234')),
  'Case Family',
  'the exact-case join code previews its family'
);
select throws_ok(
  format($$select * from public.preview_family_join(%L)$$, current_setting('test.join_code')),
  'P0001',
  'Family join code is invalid or unavailable',
  'a full family cannot be previewed for joining'
);

reset role;
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename in ('families', 'family_join_codes', 'family_members', 'children') and cmd in ('INSERT', 'UPDATE', 'DELETE')),
  0::bigint,
  'onboarding tables have no direct mutation policies'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000011', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$insert into public.children (family_id, name) values ('50000000-0000-0000-0000-000000000011', 'Denied child')$$,
  '42501',
  'permission denied for table children',
  'authenticated direct child insert is denied'
);
select throws_ok(
  $$select * from public.family_join_codes$$,
  '42501',
  'permission denied for table family_join_codes',
  'active parents cannot directly read private join codes'
);

reset role;
set local role anon;
select throws_ok(
  $$select * from public.create_family('Anonymous Family')$$,
  '42501',
  'permission denied for function create_family',
  'anonymous callers cannot create a family'
);

select * from finish();

rollback;
