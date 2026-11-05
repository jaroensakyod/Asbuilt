-- Customer portal v2 (phase 13): design approvals, selections, variations,
-- shared mood boards, chat and satisfaction surveys — plus a per-link rate limit.
-- Run after 0003. Safe to re-run.

-- ---------- rate limit: at most 30 portal writes per link per hour ----------
create table if not exists public.portal_hits (
  token text not null,
  at    timestamptz not null default now()
);
create index if not exists portal_hits_token_at on public.portal_hits (token, at);
alter table public.portal_hits enable row level security; -- only security-definer functions touch it

create or replace function public.portal_throttle(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.portal_hits where at < now() - interval '1 day';
  if (select count(*) from public.portal_hits where token = p_token and at > now() - interval '1 hour') >= 30 then
    raise exception 'too many requests, try again later';
  end if;
  insert into public.portal_hits (token) values (p_token);
end $$;

-- ---------- strip internal cost fields before showing records to a customer ----------
create or replace function public.portal_strip(p_kind text, d jsonb) returns jsonb language sql immutable as $$
  select case p_kind
    when 'variations' then (d - 'cost') || jsonb_build_object('lines', coalesce((select jsonb_agg(l - 'unitCost') from jsonb_array_elements(d->'lines') l), '[]'::jsonb))
    when 'selections' then (d - 'allowanceCostUnit') || jsonb_build_object('options', coalesce((select jsonb_agg(o - 'cost') from jsonb_array_elements(d->'options') o), '[]'::jsonb))
    when 'interior_products' then d - 'tradeCost' - 'markupPct'
    else d end $$;

-- ---------- what a portal link can read ----------
create or replace function public.portal_view(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'company', (select jsonb_build_object('name', c.name, 'phone', c.phone, 'hotline', c.hotline, 'line', c.line) from public.companies c where c.id = l.company_id),
    'project', (select p.data from public.projects p where p.company_id = l.company_id and p.id = l.project_id),
    'repairs', coalesce((select jsonb_agg(r.data) from public.repairs r where r.company_id = l.company_id and r.project_id = l.project_id), '[]'::jsonb),
    'records', coalesce((select jsonb_agg(jsonb_build_object('kind', x.kind, 'data', public.portal_strip(x.kind, x.data))) from public.records x
      where x.company_id = l.company_id and (
        (x.project_id = l.project_id and x.kind in ('installments', 'portal_updates', 'design_stages', 'selections', 'portal_messages', 'satisfaction_surveys'))
        or (x.project_id = l.project_id and x.kind = 'variations' and x.data->>'status' in ('submitted', 'approved', 'rejected'))
        or (x.project_id = l.project_id and x.kind = 'mood_boards' and coalesce((x.data->>'shared')::boolean, false))
        or (x.kind = 'interior_products' and x.id in (
              select t->>'productId' from public.records b, jsonb_array_elements(b.data->'tiles') t
              where b.company_id = l.company_id and b.project_id = l.project_id and b.kind = 'mood_boards' and coalesce((b.data->>'shared')::boolean, false)))
      )), '[]'::jsonb)
  )
  from public.portal_links l
  where l.token = p_token and l.revoked_at is null;
$$;
grant execute on function public.portal_view(text) to anon, authenticated;

-- ---------- what a portal link can write ----------
create or replace function public.portal_write(p_token text, p_kind text, p_record jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare l public.portal_links; cur jsonb; rid text := p_record->>'id'; nxt jsonb;
begin
  select * into l from public.portal_links where token = p_token and revoked_at is null;
  if not found then raise exception 'link not found'; end if;
  if rid is null then raise exception 'id required'; end if;
  perform public.portal_throttle(p_token);

  -- new rows the customer may create
  if p_kind in ('portal_messages', 'satisfaction_surveys') then
    if exists (select 1 from records where company_id = l.company_id and kind = p_kind and id = rid) then raise exception 'exists'; end if;
    nxt := p_record || jsonb_build_object('projectId', l.project_id);
    if p_kind = 'portal_messages' then nxt := (nxt - 'readAt') || jsonb_build_object('side', 'customer'); end if;
    if p_kind = 'satisfaction_surveys' then nxt := nxt - 'followedUp'; end if;
    insert into records (company_id, kind, id, project_id, data) values (l.company_id, p_kind, rid, l.project_id, nxt);
    return;
  end if;

  -- updates to existing rows of this project, limited to the customer's decision fields
  select data into cur from records where company_id = l.company_id and kind = p_kind and id = rid and project_id = l.project_id;
  if cur is null then raise exception 'record not found'; end if;
  if p_kind = 'design_stages' then
    if cur->>'status' <> 'client_review' or p_record->>'status' not in ('approved', 'changes_requested') then raise exception 'not allowed'; end if;
    nxt := cur || jsonb_build_object('status', p_record->'status', 'reviews', p_record->'reviews', 'revisions', p_record->'revisions')
      || case when p_record->>'status' = 'approved' then jsonb_build_object('approvedAt', p_record->'approvedAt', 'approvedBy', p_record->'approvedBy', 'finishedAt', p_record->'finishedAt', 'feeAuto', true) else '{}'::jsonb end;
  elsif p_kind = 'selections' then
    if cur->>'status' = 'approved' or not exists (select 1 from jsonb_array_elements(cur->'options') o where o->>'id' = p_record->>'chosenId') then raise exception 'not allowed'; end if;
    nxt := cur || jsonb_build_object('status', 'chosen', 'chosenId', p_record->'chosenId', 'chosenAt', p_record->'chosenAt', 'chosenBy', p_record->'chosenBy', 'clientNote', p_record->'clientNote');
  elsif p_kind = 'variations' then
    if cur->>'status' <> 'submitted' or p_record->>'status' not in ('approved', 'rejected') then raise exception 'not allowed'; end if;
    nxt := cur || jsonb_build_object('status', p_record->'status', 'approvedBy', p_record->'approvedBy', 'approvedAt', p_record->'approvedAt', 'signature', p_record->'signature');
  elsif p_kind = 'mood_boards' then
    if not coalesce((cur->>'shared')::boolean, false) then raise exception 'not shared'; end if;
    nxt := cur || jsonb_build_object('clientComment', p_record->'clientComment', 'clientCommentAt', p_record->'clientCommentAt', 'clientLiked', p_record->'clientLiked');
  else
    raise exception 'kind not allowed';
  end if;
  update records set data = nxt where company_id = l.company_id and kind = p_kind and id = rid;
end $$;
grant execute on function public.portal_write(text, text, jsonb) to anon, authenticated;

-- ---------- repair reports from the portal: same rate limit ----------
create or replace function public.portal_report_repair(p_token text, p_repair jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare l public.portal_links; rid text;
begin
  select * into l from public.portal_links where token = p_token and revoked_at is null;
  if not found then raise exception 'link not found'; end if;
  perform public.portal_throttle(p_token);
  rid := coalesce(p_repair->>'id', 'REP-P-' || to_char(now(), 'YYYYMMDDHH24MISS'));
  insert into public.repairs (company_id, id, project_id, asset, status, severity, data, created_by)
  values (l.company_id, rid, l.project_id, p_repair->>'asset', 'open', coalesce(p_repair->>'severity', 'medium'),
          p_repair || jsonb_build_object('id', rid, 'projectId', l.project_id, 'source', 'customer', 'status', 'open'), null);
  return rid;
end $$;
grant execute on function public.portal_report_repair(text, jsonb) to anon, authenticated;
