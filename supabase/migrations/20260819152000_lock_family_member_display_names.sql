create or replace function public.update_my_family_member_display_name(p_display_name text)
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
   where user_id = auth.uid()
     and role = 'parent'
     and is_active
     and display_name is null;

  if not found then
    raise exception 'Display name has already been set';
  end if;
end;
$$;
