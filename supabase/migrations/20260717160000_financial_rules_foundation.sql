create type public.expense_status as enum ('pending', 'approved', 'declined');
create type public.monthly_settlement_status as enum ('open', 'settled');

create table public.families (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete restrict,
  role text not null default 'parent' check (role = 'parent'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (id, family_id)
);

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid,
  payer_id uuid not null,
  description text not null check (btrim(description) <> ''),
  expense_date date not null,
  amount_pln numeric(12, 2) not null check (amount_pln > 0),
  status public.expense_status not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id)
    references public.children (id, family_id)
    on delete restrict,
  foreign key (payer_id, family_id)
    references public.family_members (id, family_id)
    on delete restrict,
  foreign key (reviewed_by, family_id)
    references public.family_members (id, family_id)
    on delete restrict,
  check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null)
    or (
      status in ('approved', 'declined')
      and reviewed_by is not null
      and reviewed_at is not null
      and reviewed_by <> payer_id
    )
  )
);

create table public.monthly_settlements (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  report_month date not null check (report_month = date_trunc('month', report_month)::date),
  status public.monthly_settlement_status not null default 'open',
  first_confirmed_by uuid,
  first_confirmed_at timestamptz,
  second_confirmed_by uuid,
  second_confirmed_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, report_month),
  foreign key (first_confirmed_by, family_id)
    references public.family_members (id, family_id)
    on delete restrict,
  foreign key (second_confirmed_by, family_id)
    references public.family_members (id, family_id)
    on delete restrict,
  check (
    (first_confirmed_by is null and first_confirmed_at is null)
    or (first_confirmed_by is not null and first_confirmed_at is not null)
  ),
  check (
    (second_confirmed_by is null and second_confirmed_at is null)
    or (second_confirmed_by is not null and second_confirmed_at is not null)
  ),
  check (second_confirmed_by is null or second_confirmed_by <> first_confirmed_by),
  check (
    (status = 'open' and settled_at is null)
    or (
      status = 'settled'
      and first_confirmed_by is not null
      and second_confirmed_by is not null
      and settled_at is not null
    )
  )
);

create index family_members_active_user_family_idx
  on public.family_members (user_id, family_id)
  where is_active;
create index expenses_family_date_status_idx
  on public.expenses (family_id, expense_date, status);
create index monthly_settlements_family_month_idx
  on public.monthly_settlements (family_id, report_month);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger families_set_updated_at
before update on public.families
for each row execute procedure public.set_updated_at();

create trigger family_members_set_updated_at
before update on public.family_members
for each row execute procedure public.set_updated_at();

create trigger children_set_updated_at
before update on public.children
for each row execute procedure public.set_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute procedure public.set_updated_at();

create trigger monthly_settlements_set_updated_at
before update on public.monthly_settlements
for each row execute procedure public.set_updated_at();

create function public.enforce_parent_membership_limit()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  active_parent_count integer;
begin
  if new.is_active and new.role = 'parent' then
    perform 1 from public.families where id = new.family_id for update;

    select count(*)
      into active_parent_count
      from public.family_members
      where family_id = new.family_id
        and is_active
        and role = 'parent'
        and id <> coalesce(old.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if active_parent_count >= 2 then
      raise exception 'A family can have at most two active parents';
    end if;
  end if;

  return new;
end;
$$;

create trigger family_members_parent_limit
before insert or update of family_id, role, is_active on public.family_members
for each row execute procedure public.enforce_parent_membership_limit();

create function public.enforce_active_reviewer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reviewed_by is not null and not exists (
    select 1
    from public.family_members
    where id = new.reviewed_by
      and family_id = new.family_id
      and role = 'parent'
      and is_active
  ) then
    raise exception 'Expense reviewer must be an active parent in the expense family';
  end if;

  return new;
end;
$$;

create trigger expenses_active_reviewer
before insert or update of family_id, reviewed_by on public.expenses
for each row execute procedure public.enforce_active_reviewer();

create function public.is_active_family_member(target_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = target_family_id
      and user_id = auth.uid()
      and role = 'parent'
      and is_active
  );
$$;

create function public.create_family()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required to create a family';
  end if;

  insert into public.families (created_by)
  values (auth.uid())
  returning id into created_family_id;

  insert into public.family_members (family_id, user_id)
  values (created_family_id, auth.uid());

  return created_family_id;
end;
$$;

alter table public.families enable row level security;
alter table public.families force row level security;
alter table public.family_members enable row level security;
alter table public.family_members force row level security;
alter table public.children enable row level security;
alter table public.children force row level security;
alter table public.expenses enable row level security;
alter table public.expenses force row level security;
alter table public.monthly_settlements enable row level security;
alter table public.monthly_settlements force row level security;

create policy "active parents can view their family"
on public.families
for select to authenticated
using (public.is_active_family_member(id));

create policy "active parents can view family members"
on public.family_members
for select to authenticated
using (public.is_active_family_member(family_id));

create policy "active parents can view children"
on public.children
for select to authenticated
using (public.is_active_family_member(family_id));

create policy "active parents can view expenses"
on public.expenses
for select to authenticated
using (public.is_active_family_member(family_id));

create policy "active parents can view monthly settlements"
on public.monthly_settlements
for select to authenticated
using (public.is_active_family_member(family_id));

revoke all on function public.create_family() from public;
grant execute on function public.create_family() to authenticated;
