begin;

select plan(12);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('81000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'display-a@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('82000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'display-b@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('83000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'display-c@example.test', '{}'::jsonb, '{}'::jsonb, now(), now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok($$select * from public.create_family('Names', 'Ada')$$, 'P0001', 'Display name must be between 5 and 15 characters', 'creation requires a five-character display name');
select set_config('test.family_id', (select family_id::text from public.create_family('Names', '  Ada Nowak  ')), true);
select set_config('test.join_code', public.get_family_join_code(), true);
select is((select display_name from public.family_members where user_id = auth.uid()), 'Ada Nowak', 'creation stores a trimmed display name');
select throws_ok($$update public.family_members set display_name = 'Nope'$$, '42501', 'permission denied for table family_members', 'direct display-name writes remain denied');
select throws_ok($$select public.update_my_family_member_display_name('  Ada Smith  ')$$, 'P0001', 'Display name has already been set', 'a saved display name cannot be changed');
select is((select display_name from public.family_members where user_id = auth.uid()), 'Ada Nowak', 'a rejected edit leaves the name unchanged');

select set_config('request.jwt.claim.sub', '82000000-0000-0000-0000-000000000001', true);
select throws_ok($$select public.confirm_family_join('bad', 'Beata')$$, 'P0001', 'Family join code is invalid or unavailable', 'join still validates its code');
select is(public.confirm_family_join(current_setting('test.join_code'), '  Beata Kowalska  '), current_setting('test.family_id')::uuid, 'joining with a valid display name succeeds');
select is((select display_name from public.family_members where user_id = auth.uid()), 'Beata Kowalska', 'joining stores a trimmed display name');
select throws_ok($$select public.update_my_family_member_display_name('Beata Nowak')$$, 'P0001', 'Display name has already been set', 'a co-parent cannot change their saved name');
select is((select display_name from public.family_members where user_id = '81000000-0000-0000-0000-000000000001'), 'Ada Nowak', 'co-parent updates do not alter another parent name');

select set_config('request.jwt.claim.sub', '83000000-0000-0000-0000-000000000001', true);
select throws_ok($$select public.update_my_family_member_display_name('Celina')$$, 'P0001', 'An active family membership is required to update a display name', 'non-members cannot update a display name');

reset role;
set local role anon;
select throws_ok($$select public.update_my_family_member_display_name('Anon Name')$$, '42501', 'permission denied for function update_my_family_member_display_name', 'anonymous callers cannot update names');

select * from finish();

rollback;
