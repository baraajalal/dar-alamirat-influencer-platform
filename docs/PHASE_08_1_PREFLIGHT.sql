-- Phase 08.1 preflight. READ ONLY.
with checks as (
  select 'table'::text as check_group, 'influencers'::text as item,
         case when to_regclass('public.influencers') is not null then 'OK' else 'MISSING' end::text as result
  union all
  select 'table', 'social_accounts', case when to_regclass('public.social_accounts') is not null then 'OK' else 'MISSING' end
  union all
  select 'table', 'influencer_work_history', case when to_regclass('public.influencer_work_history') is not null then 'OK' else 'MISSING' end
  union all
  select 'column', 'influencers.profile_completion', case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='influencers' and column_name='profile_completion') then 'OK' else 'MISSING' end
  union all
  select 'column', 'influencers.city', case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='influencers' and column_name='city') then 'OK' else 'MISSING' end
  union all
  select 'column', 'social_accounts.followers_count', case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_accounts' and column_name='followers_count') then 'OK' else 'MISSING' end
  union all
  select 'column', 'social_accounts.average_views', case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_accounts' and column_name='average_views') then 'OK' else 'MISSING' end
  union all
  select 'column', 'social_accounts.engagement_rate', case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='social_accounts' and column_name='engagement_rate') then 'OK' else 'MISSING' end
  union all
  select 'column', 'influencer_work_history.outcome', case when exists(select 1 from information_schema.columns where table_schema='public' and table_name='influencer_work_history' and column_name='outcome') then 'OK' else 'MISSING' end
  union all
  select 'function', 'public.set_updated_at', case when exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_updated_at') then 'OK' else 'MISSING' end
  union all
  select 'function', 'private.current_user_role', case when exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='current_user_role') then 'OK' else 'MISSING' end
)
select * from checks order by check_group, item;
