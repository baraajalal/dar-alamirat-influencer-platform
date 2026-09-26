-- Phase 08.2 preflight - READ ONLY
with checks as (
  select 'table'::text item_type, 'campaigns'::text item, case when to_regclass('public.campaigns') is not null then 'OK' else 'MISSING' end result
  union all select 'table','campaign_applications',case when to_regclass('public.campaign_applications') is not null then 'OK' else 'MISSING' end
  union all select 'table','influencer_evaluations',case when to_regclass('public.influencer_evaluations') is not null then 'OK' else 'MISSING' end
  union all select 'table','influencer_work_history',case when to_regclass('public.influencer_work_history') is not null then 'OK' else 'MISSING' end
  union all select 'column','campaigns.brand_id',case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='campaigns' and column_name='brand_id') then 'OK' else 'MISSING' end
  union all select 'column','campaign_applications.influencer_id',case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='campaign_applications' and column_name='influencer_id') then 'OK' else 'MISSING' end
  union all select 'rpc','get_influencer_evaluation_summary',case when exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_influencer_evaluation_summary') then 'OK' else 'MISSING' end
)
select * from checks order by item_type,item;
