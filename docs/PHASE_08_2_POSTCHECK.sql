-- Phase 08.2 postcheck - READ ONLY / single result set
select 'settings_rows'::text as check_name, count(*)::text as result from public.campaign_qualification_settings
union all
select 'application_evaluation_rows', count(*)::text from public.campaign_application_evaluations
union all
select 'evaluation_history_rows', count(*)::text from public.campaign_application_evaluation_history
union all
select 'invalid_scores', count(*)::text from public.campaign_application_evaluations where total_score < 0 or total_score > 100
union all
select 'invalid_statuses', count(*)::text from public.campaign_application_evaluations where suggested_status not in ('qualified','needs_review','waitlist','not_qualified') or (final_status is not null and final_status not in ('qualified','needs_review','waitlist','not_qualified'))
union all
select 'orphan_evaluations', count(*)::text from public.campaign_application_evaluations e left join public.campaign_applications a on a.id=e.application_id where a.id is null;
