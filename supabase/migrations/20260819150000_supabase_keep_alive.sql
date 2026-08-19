create function public.keep_alive()
returns boolean
language sql
immutable
as $$
  select true;
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon;
