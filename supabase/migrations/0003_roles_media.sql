-- Phases 8–14: new roles. All new modules store their rows in public.records
-- (kind = collection name), so no new tables are needed here.
-- Photos/files from the field go to the existing "documents" bucket under <company_id>/media/.

alter type public.app_role add value if not exists 'qs';
alter type public.app_role add value if not exists 'safety';
alter type public.app_role add value if not exists 'interior';
alter type public.app_role add value if not exists 'subcontractor';
