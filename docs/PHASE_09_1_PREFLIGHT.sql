-- Phase 09.1 preflight (READ ONLY)
with checks as (
  select 'campaign_assignments.brief_sent_at' item,
         case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='campaign_assignments' and column_name='brief_sent_at') then 'OK' else 'MISSING' end result
  union all
  select 'campaign_assignments.accepted_at',
         case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='campaign_assignments' and column_name='accepted_at') then 'OK' else 'MISSING' end
  union all
  select 'campaign_assignments.coordinator_progress',
         case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='campaign_assignments' and column_name='coordinator_progress') then 'OK' else 'MISSING' end
  union all
  select 'campaigns.brief_version',
         case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='campaigns' and column_name='brief_version') then 'OK' else 'MISSING' end
  union all
  select 'assignment_compensations', case when to_regclass('public.assignment_compensations') is not null then 'OK' else 'MISSING' end
  union all
  select 'refresh_assignment_progress()', case when exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='refresh_assignment_progress') then 'OK' else 'MISSING' end
)
select * from checks order by item;
