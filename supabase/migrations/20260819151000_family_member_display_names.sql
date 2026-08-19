alter table public.family_members
add column display_name text;

alter table public.family_members
add constraint family_members_display_name_length
check (
  display_name is null
  or (display_name = btrim(display_name) and char_length(display_name) between 5 and 15)
);

drop function public.create_family(text);

create function public.create_family(p_name text, p_display_name text)
returns table (family_id uuid, join_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_name text := btrim(p_name);
  normalized_display_name text := btrim(p_display_name);
  created_family_id uuid;
  generated_code text;
  violated_constraint text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create a family';
  end if;

  if normalized_name is null or normalized_name = '' then
    raise exception 'Family name is required';
  end if;
  if normalized_display_name is null or char_length(normalized_display_name) not between 5 and 15 then
    raise exception 'Display name must be between 5 and 15 characters';
  end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to a family';
  end if;

  for attempt in 1..10 loop
    generated_code := public.generate_family_join_code();
    begin
      insert into public.families (created_by, name)
      values (auth.uid(), normalized_name)
      returning id into created_family_id;

      insert into public.family_join_codes (family_id, code)
      values (created_family_id, generated_code);

      insert into public.family_members (family_id, user_id, display_name)
      values (created_family_id, auth.uid(), normalized_display_name);

      return query select created_family_id, generated_code;
      return;
    exception when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;
      if violated_constraint = 'family_join_codes_code_key' then continue; end if;
      raise;
    end;
  end loop;

  raise exception 'Unable to generate a family join code';
end;
$$;

drop function public.confirm_family_join(text);

create function public.confirm_family_join(p_join_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_family_id uuid;
  normalized_display_name text := btrim(p_display_name);
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to join a family';
  end if;
  if p_join_code is null or p_join_code !~ '^[A-Za-z0-9]{8}$' then
    raise exception 'Family join code is invalid or unavailable';
  end if;
  if normalized_display_name is null or char_length(normalized_display_name) not between 5 and 15 then
    raise exception 'Display name must be between 5 and 15 characters';
  end if;
  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to a family';
  end if;

  select families.id into target_family_id
    from public.family_join_codes as join_codes
    join public.families on families.id = join_codes.family_id
   where join_codes.code = p_join_code
   for update of families;

  if target_family_id is null or (
    select count(*) from public.family_members
     where family_id = target_family_id and role = 'parent' and is_active
  ) >= 2 then
    raise exception 'Family join code is invalid or unavailable';
  end if;

  insert into public.family_members (family_id, user_id, display_name)
  values (target_family_id, auth.uid(), normalized_display_name);
  return target_family_id;
end;
$$;

create function public.update_my_family_member_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_display_name text := btrim(p_display_name);
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to update a display name';
  end if;
  if normalized_display_name is null or char_length(normalized_display_name) not between 5 and 15 then
    raise exception 'Display name must be between 5 and 15 characters';
  end if;

  update public.family_members
     set display_name = normalized_display_name
   where user_id = auth.uid() and role = 'parent' and is_active;

  if not found then
    raise exception 'An active family membership is required to update a display name';
  end if;
end;
$$;

revoke all on function public.create_family(text, text) from public;
revoke all on function public.confirm_family_join(text, text) from public;
revoke all on function public.update_my_family_member_display_name(text) from public;

grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.confirm_family_join(text, text) to authenticated;
grant execute on function public.update_my_family_member_display_name(text) to authenticated;
