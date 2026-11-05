-- Asbuilt · Phase 2 · multi-tenant foundation
-- Every business table carries company_id. Row Level Security limits each
-- signed-in user to the companies they are an active member of.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- tenants and people
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.app_role as enum (
    'admin', 'exec', 'sales', 'architect', 'engineer', 'pm',
    'foreman', 'qc', 'technician', 'purchasing', 'accounting'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  name_en     text,
  tax_id      text,
  address     text,
  phone       text,
  hotline     text,
  line        text,
  since       int,
  plan        text not null default 'trial',
  seats       int  not null default 5,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

create table if not exists public.memberships (
  company_id   uuid not null references public.companies (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         public.app_role not null default 'pm',
  display_name text,
  email        text,
  phone        text,
  skill        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  primary key (company_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships (user_id);

create table if not exists public.invitations (
  id           text primary key default gen_random_uuid()::text,
  company_id   uuid not null references public.companies (id) on delete cascade,
  email        text not null,
  role         public.app_role not null default 'pm',
  display_name text,
  phone        text,
  skill        text,
  token        text not null unique default encode(gen_random_bytes(18), 'hex'),
  invited_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id) on delete set null
);
create index if not exists invitations_company_idx on public.invitations (company_id);

-- ---------------------------------------------------------------------------
-- helpers (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_member(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = c and m.user_id = auth.uid() and m.active
  );
$$;

create or replace function public.has_role(c uuid, roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.company_id = c and m.user_id = auth.uid() and m.active and m.role = any (roles)
  );
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- business records: indexed key columns + data jsonb for the full record
-- ---------------------------------------------------------------------------

create table if not exists public.projects (
  company_id  uuid not null references public.companies (id) on delete cascade,
  id          text not null,
  status      text,
  model_code  text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (company_id, id)
);

create table if not exists public.repairs (
  company_id  uuid not null references public.companies (id) on delete cascade,
  id          text not null,
  project_id  text,
  asset       text,
  status      text,
  severity    text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (company_id, id)
);
create index if not exists repairs_project_idx on public.repairs (company_id, project_id);

create table if not exists public.inspections (
  company_id  uuid not null references public.companies (id) on delete cascade,
  id          text not null,
  project_id  text,
  date        date,
  result      text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (company_id, id)
);
create index if not exists inspections_project_idx on public.inspections (company_id, project_id);

create table if not exists public.work_orders (
  company_id  uuid not null references public.companies (id) on delete cascade,
  id          text not null,
  project_id  text,
  repair_id   text,
  status      text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (company_id, id)
);
create index if not exists work_orders_project_idx on public.work_orders (company_id, project_id);

create table if not exists public.maintenance (
  company_id  uuid not null references public.companies (id) on delete cascade,
  id          text not null,
  project_id  text,
  date        date,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (company_id, id)
);
create index if not exists maintenance_project_idx on public.maintenance (company_id, project_id);

create table if not exists public.documents (
  company_id   uuid not null references public.companies (id) on delete cascade,
  id           text not null,
  project_id   text,
  kind         text,
  storage_path text,
  data         jsonb not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (company_id, id)
);
create index if not exists documents_project_idx on public.documents (company_id, project_id);

do $$
declare t text;
begin
  foreach t in array array['projects','repairs','inspections','work_orders','maintenance','documents'] loop
    execute format('drop trigger if exists %1$s_touch on public.%1$s', t);
    execute format('create trigger %1$s_touch before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.companies   enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select using (public.is_member(id));
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update
  using (public.has_role(id, array['admin']::public.app_role[]))
  with check (public.has_role(id, array['admin']::public.app_role[]));

drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships for select using (public.is_member(company_id));
drop policy if exists memberships_update on public.memberships;
create policy memberships_update on public.memberships for update
  using (public.has_role(company_id, array['admin']::public.app_role[]))
  with check (public.has_role(company_id, array['admin']::public.app_role[]));
drop policy if exists memberships_delete on public.memberships;
create policy memberships_delete on public.memberships for delete
  using (public.has_role(company_id, array['admin']::public.app_role[]) and user_id <> auth.uid());

drop policy if exists invitations_all on public.invitations;
create policy invitations_all on public.invitations for all
  using (public.has_role(company_id, array['admin']::public.app_role[]))
  with check (public.has_role(company_id, array['admin']::public.app_role[]));

do $$
declare t text;
begin
  foreach t in array array['projects','repairs','inspections','work_orders','maintenance','documents'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select using (public.is_member(company_id))', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (public.is_member(company_id))', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update using (public.is_member(company_id)) with check (public.is_member(company_id))', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format($p$create policy %1$s_delete on public.%1$s for delete using (public.has_role(company_id, array['admin','exec','pm']::public.app_role[]))$p$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- create a company and make the caller its admin
create or replace function public.create_company(p_name text, p_display_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.companies (name, created_by, since)
  values (trim(p_name), auth.uid(), extract(year from now())::int + 543)
  returning id into cid;
  insert into public.memberships (company_id, user_id, role, display_name, email)
  values (cid, auth.uid(), 'admin', coalesce(nullif(trim(p_display_name), ''), split_part(auth.email(), '@', 1)), auth.email());
  return cid;
end $$;

-- what an invitation link is for (readable before accepting)
create or replace function public.invitation_preview(p_token text)
returns table (company_name text, role public.app_role, email text, accepted boolean)
language sql stable security definer set search_path = public as $$
  select c.name, i.role, i.email, i.accepted_at is not null
  from public.invitations i join public.companies c on c.id = i.company_id
  where i.token = p_token;
$$;

-- accept an invitation addressed to the caller's email
create or replace function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare inv public.invitations;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into inv from public.invitations where token = p_token for update;
  if not found then
    raise exception 'invitation not found';
  end if;
  if inv.accepted_at is not null then
    raise exception 'invitation already used';
  end if;
  if lower(inv.email) <> lower(coalesce(auth.email(), '')) then
    raise exception 'invitation is for a different email';
  end if;
  insert into public.memberships (company_id, user_id, role, display_name, email, phone, skill)
  values (inv.company_id, auth.uid(), inv.role, coalesce(inv.display_name, split_part(auth.email(), '@', 1)), auth.email(), inv.phone, inv.skill)
  on conflict (company_id, user_id) do update set role = excluded.role, active = true;
  update public.invitations set accepted_at = now(), accepted_by = auth.uid() where id = inv.id;
  return inv.company_id;
end $$;

grant execute on function public.create_company(text, text) to authenticated;
grant execute on function public.invitation_preview(text) to anon, authenticated;
grant execute on function public.accept_invitation(text) to authenticated;

-- ---------------------------------------------------------------------------
-- storage: private bucket, files stored under <company_id>/...
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects for select
  using (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists documents_write on storage.objects;
create policy documents_write on storage.objects for insert
  with check (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists documents_change on storage.objects;
create policy documents_change on storage.objects for update
  using (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists documents_remove on storage.objects;
create policy documents_remove on storage.objects for delete
  using (bucket_id = 'documents' and public.has_role(((storage.foldername(name))[1])::uuid, array['admin','exec','pm']::public.app_role[]));
