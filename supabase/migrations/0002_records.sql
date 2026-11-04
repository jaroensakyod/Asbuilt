-- Asbuilt · Phases 3–7 · generic per-company records
-- Modules added after Phase 2 (sales, quotes, prices, purchasing, inventory,
-- HR, portal links, billing …) store their records here, one row per record,
-- keyed by (company_id, kind, id). Same RLS rules as the Phase 2 tables.

create table if not exists public.records (
  company_id  uuid not null references public.companies (id) on delete cascade,
  kind        text not null,
  id          text not null,
  project_id  text,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (company_id, kind, id)
);
create index if not exists records_kind_idx on public.records (company_id, kind);
create index if not exists records_project_idx on public.records (company_id, project_id);

drop trigger if exists records_touch on public.records;
create trigger records_touch before update on public.records for each row execute function public.touch_updated_at();

alter table public.records enable row level security;

drop policy if exists records_select on public.records;
create policy records_select on public.records for select using (public.is_member(company_id));
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert with check (public.is_member(company_id));
drop policy if exists records_update on public.records;
create policy records_update on public.records for update using (public.is_member(company_id)) with check (public.is_member(company_id));
drop policy if exists records_delete on public.records;
create policy records_delete on public.records for delete
  using (public.has_role(company_id, array['admin', 'exec', 'pm', 'accounting', 'purchasing', 'sales']::public.app_role[]));

-- customer portal: a project owner opens a read-only page through a share token
create table if not exists public.portal_links (
  token       text primary key default encode(gen_random_bytes(18), 'hex'),
  company_id  uuid not null references public.companies (id) on delete cascade,
  project_id  text not null,
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
alter table public.portal_links enable row level security;
drop policy if exists portal_links_member on public.portal_links;
create policy portal_links_member on public.portal_links for all using (public.is_member(company_id)) with check (public.is_member(company_id));

-- what an anonymous portal visitor may read: that one project's summary
create or replace function public.portal_view(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'company', (select jsonb_build_object('name', c.name, 'phone', c.phone, 'hotline', c.hotline, 'line', c.line) from public.companies c where c.id = l.company_id),
    'project', (select p.data from public.projects p where p.company_id = l.company_id and p.id = l.project_id),
    'repairs', coalesce((select jsonb_agg(r.data) from public.repairs r where r.company_id = l.company_id and r.project_id = l.project_id), '[]'::jsonb),
    'records', coalesce((select jsonb_agg(jsonb_build_object('kind', x.kind, 'data', x.data)) from public.records x
                         where x.company_id = l.company_id and x.project_id = l.project_id and x.kind in ('installments', 'portal_updates')), '[]'::jsonb)
  )
  from public.portal_links l
  where l.token = p_token and l.revoked_at is null;
$$;
grant execute on function public.portal_view(text) to anon, authenticated;

-- a portal visitor can report a repair for that project
create or replace function public.portal_report_repair(p_token text, p_repair jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare l public.portal_links; rid text;
begin
  select * into l from public.portal_links where token = p_token and revoked_at is null;
  if not found then raise exception 'link not found'; end if;
  rid := coalesce(p_repair->>'id', 'REP-P-' || to_char(now(), 'YYYYMMDDHH24MISS'));
  insert into public.repairs (company_id, id, project_id, asset, status, severity, data, created_by)
  values (l.company_id, rid, l.project_id, p_repair->>'asset', 'open', coalesce(p_repair->>'severity', 'medium'),
          p_repair || jsonb_build_object('id', rid, 'projectId', l.project_id, 'source', 'customer', 'status', 'open'), null);
  return rid;
end $$;
grant execute on function public.portal_report_repair(text, jsonb) to anon, authenticated;
