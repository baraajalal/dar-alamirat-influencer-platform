-- Phase 08.1 post-check. READ ONLY.

select 'table' as check_group, 'influencer_evaluations' as item,
       case when to_regclass('public.influencer_evaluations') is not null then 'OK' else 'MISSING' end as result;

select 'table' as check_group, 'influencer_evaluation_history' as item,
       case when to_regclass('public.influencer_evaluation_history') is not null then 'OK' else 'MISSING' end as result;

select 'function' as check_group, 'get_influencer_evaluation_summary' as item,
       case when exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='get_influencer_evaluation_summary') then 'OK' else 'MISSING' end as result;

select 'function' as check_group, 'save_influencer_evaluation' as item,
       case when exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_influencer_evaluation') then 'OK' else 'MISSING' end as result;

select 'evaluation_rows' as check_group, count(*)::text as result
from public.influencer_evaluations;

select 'history_rows' as check_group, count(*)::text as result
from public.influencer_evaluation_history;

select 'invalid_scores' as check_group, count(*)::text as result
from public.influencer_evaluations
where total_score < 0 or total_score > 100;

select 'invalid_statuses' as check_group, count(*)::text as result
from public.influencer_evaluations
where suggested_status not in ('qualified','needs_review','waitlist','not_qualified')
   or (final_status is not null and final_status not in ('qualified','needs_review','waitlist','not_qualified'));

select final_status, suggested_status, count(*)
from public.influencer_evaluations
group by final_status, suggested_status
order by final_status nulls first, suggested_status;
