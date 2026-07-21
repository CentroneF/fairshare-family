alter table public.families
add column name text;

alter table public.families
alter column name set not null;

alter table public.families
add constraint families_name_nonblank check (btrim(name) <> '');

create table public.family_join_codes (
  family_id uuid primary key references public.families (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger family_join_codes_set_updated_at
before update on public.family_join_codes
for each row execute procedure public.set_updated_at();

alter table public.family_join_codes enable row level security;
alter table public.family_join_codes force row level security;

drop function public.create_family();

create function public.generate_family_join_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  generated_code text := '';
  random_byte integer;
begin
  while length(generated_code) < 8 loop
    random_byte := get_byte(extensions.gen_random_bytes(1), 0);

    if random_byte < 248 then
      generated_code := generated_code || substr(alphabet, (random_byte % 62) + 1, 1);
    end if;
  end loop;

  return generated_code;
end;
$$;

create function public.create_family(p_name text)
returns table (family_id uuid, join_code text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_name text := btrim(p_name);
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

      insert into public.family_members (family_id, user_id)
      values (created_family_id, auth.uid());

      return query select created_family_id, generated_code;
      return;
    exception
      when unique_violation then
        get stacked diagnostics violated_constraint = constraint_name;

        if violated_constraint = 'family_join_codes_code_key' then
          continue;
        end if;

        raise;
    end;
  end loop;

  raise exception 'Unable to generate a family join code';
end;
$$;

create function public.get_family_join_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to view a family join code';
  end if;

  select join_codes.code
    into current_code
    from public.families as families
    join public.family_members as members
      on members.family_id = families.id
    join public.family_join_codes as join_codes
      on join_codes.family_id = families.id
   where families.created_by = auth.uid()
     and members.user_id = auth.uid()
     and members.role = 'parent'
     and members.is_active
     and (
       select count(*)
       from public.family_members as active_members
       where active_members.family_id = families.id
         and active_members.role = 'parent'
         and active_members.is_active
     ) = 1;

  if current_code is null then
    raise exception 'No active family join code is available';
  end if;

  return current_code;
end;
$$;

create function public.preview_family_join(p_join_code text)
returns table (family_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to join a family';
  end if;

  if p_join_code is null or p_join_code !~ '^[A-Za-z0-9]{8}$' then
    raise exception 'Family join code is invalid or unavailable';
  end if;

  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to a family';
  end if;

  return query
  select families.name
    from public.family_join_codes as join_codes
    join public.families as families on families.id = join_codes.family_id
   where join_codes.code = p_join_code
     and (
       select count(*)
       from public.family_members as active_members
       where active_members.family_id = families.id
         and active_members.role = 'parent'
         and active_members.is_active
     ) < 2;

  if not found then
    raise exception 'Family join code is invalid or unavailable';
  end if;
end;
$$;

create function public.confirm_family_join(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to join a family';
  end if;

  if p_join_code is null or p_join_code !~ '^[A-Za-z0-9]{8}$' then
    raise exception 'Family join code is invalid or unavailable';
  end if;

  if exists (select 1 from public.family_members where user_id = auth.uid()) then
    raise exception 'This account already belongs to a family';
  end if;

  select families.id
    into target_family_id
    from public.family_join_codes as join_codes
    join public.families as families on families.id = join_codes.family_id
   where join_codes.code = p_join_code
   for update of families;

  if target_family_id is null or (
    select count(*)
    from public.family_members as active_members
    where active_members.family_id = target_family_id
      and active_members.role = 'parent'
      and active_members.is_active
  ) >= 2 then
    raise exception 'Family join code is invalid or unavailable';
  end if;

  insert into public.family_members (family_id, user_id)
  values (target_family_id, auth.uid());

  return target_family_id;
end;
$$;

create function public.regenerate_family_join_code()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_family_id uuid;
  generated_code text;
  violated_constraint text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to regenerate a family join code';
  end if;

  select families.id
    into target_family_id
    from public.families as families
    join public.family_members as members
      on members.family_id = families.id
   where families.created_by = auth.uid()
     and members.user_id = auth.uid()
     and members.role = 'parent'
     and members.is_active
     and (
       select count(*)
       from public.family_members as active_members
       where active_members.family_id = families.id
         and active_members.role = 'parent'
         and active_members.is_active
     ) = 1
   for update of families;

  if target_family_id is null then
    raise exception 'No active family join code is available';
  end if;

  for attempt in 1..10 loop
    generated_code := public.generate_family_join_code();

    begin
      update public.family_join_codes
         set code = generated_code
       where family_id = target_family_id;

      return generated_code;
    exception
      when unique_violation then
        get stacked diagnostics violated_constraint = constraint_name;

        if violated_constraint = 'family_join_codes_code_key' then
          continue;
        end if;

        raise;
    end;
  end loop;

  raise exception 'Unable to generate a family join code';
end;
$$;

create function public.add_family_child(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_family_id uuid;
  child_id uuid;
  normalized_name text := btrim(p_name);
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to add a child';
  end if;

  if normalized_name is null or normalized_name = '' then
    raise exception 'Child name is required';
  end if;

  select family_id
    into target_family_id
    from public.family_members
   where user_id = auth.uid()
     and role = 'parent'
     and is_active;

  if target_family_id is null then
    raise exception 'An active family membership is required to add a child';
  end if;

  insert into public.children (family_id, name)
  values (target_family_id, normalized_name)
  returning id into child_id;

  return child_id;
end;
$$;

revoke all on function public.generate_family_join_code() from public;
revoke all on function public.create_family(text) from public;
revoke all on function public.get_family_join_code() from public;
revoke all on function public.preview_family_join(text) from public;
revoke all on function public.confirm_family_join(text) from public;
revoke all on function public.regenerate_family_join_code() from public;
revoke all on function public.add_family_child(text) from public;

grant execute on function public.create_family(text) to authenticated;
grant execute on function public.get_family_join_code() to authenticated;
grant execute on function public.preview_family_join(text) to authenticated;
grant execute on function public.confirm_family_join(text) to authenticated;
grant execute on function public.regenerate_family_join_code() to authenticated;
grant execute on function public.add_family_child(text) to authenticated;
