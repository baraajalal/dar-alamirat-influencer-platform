-- Phase 09.1 postcheck (READ ONLY / single result set)
select 'workflow_columns' as check_group,
       count(*)::text as result,
       'expected=6' as details
from information_schema.columns
where table_schema='public' and table_name='campaign_assignments'
  and column_name in ('assignment_brief_override','product_required','product_fulfillment_status','product_dispatched_at','product_received_at','execution_notes')
union all
select 'workflow_rpc', count(*)::text, 'expected>=1'
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='update_assignment_execution_workflow'
union all
select 'workflow_events', count(*)::text, 'grows after testing a workflow action'
from public.assignment_execution_events
union all
select 'invalid_product_status', count(*)::text, 'expected=0'
from public.campaign_assignments
where product_fulfillment_status not in ('not_required','pending','dispatched','received')
union all
select 'community_application_still_invited', count(*)::text, 'expected=0 for new accepted applications after 09.1'
from public.campaign_assignments
where source='community_application' and status='invited'
union all
select 'product_received_without_timestamp', count(*)::text, 'expected=0'
from public.campaign_assignments
where product_fulfillment_status='received' and product_received_at is null
union all
select 'content_pending_without_prerequisites', count(*)::text, 'expected=0'
from public.campaign_assignments
where status='content_pending'
  and (accepted_at is null or brief_sent_at is null or (product_required and product_fulfillment_status <> 'received'));
