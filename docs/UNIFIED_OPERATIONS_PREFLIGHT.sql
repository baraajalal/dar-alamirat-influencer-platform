-- Dar Al Amirat Creator Community
-- beta.9.1.1 Unified Operations - READ ONLY preflight
-- Run in Supabase SQL Editor BEFORE UNIFIED_OPERATIONS_DB_PATCH.sql.
-- This script does not modify data or schema.

with
required_tables(schema_name, object_name) as (
  values
    ('public','profiles'),
    ('public','influencers'),
    ('public','social_accounts'),
    ('public','influencer_work_history'),
    ('public','campaigns'),
    ('public','campaign_applications'),
    ('public','campaign_qualification_settings'),
    ('public','campaign_assignments'),
    ('public','assignment_platforms'),
    ('public','content_items'),
    ('public','assignment_compensations'),
    ('public','payments'),
    ('public','activity_logs'),
    ('public','assignment_execution_events')
),
table_checks as (
  select
    'table'::text as object_type,
    schema_name || '.' || object_name as item,
    case when to_regclass(schema_name || '.' || object_name) is not null then 'OK' else 'MISSING' end::text as status,
    ''::text as details
  from required_tables
),
required_columns(table_name, column_name) as (
  values
    ('influencers','id'),('influencers','user_id'),('influencers','directory_status'),('influencers','activation_status'),
    ('campaigns','id'),('campaigns','brand_id'),('campaigns','content_due_at'),('campaigns','publishing_date'),('campaigns','brief_version'),('campaigns','public_compensation_amount'),('campaigns','public_compensation_currency'),
    ('campaign_assignments','id'),('campaign_assignments','campaign_id'),('campaign_assignments','influencer_id'),('campaign_assignments','coordinator_id'),('campaign_assignments','status'),('campaign_assignments','execution_type'),('campaign_assignments','requires_content'),('campaign_assignments','order_number'),('campaign_assignments','assignment_brief_override'),('campaign_assignments','brief_sent_at'),('campaign_assignments','product_required'),('campaign_assignments','product_fulfillment_status'),('campaign_assignments','coordinator_progress'),
    ('campaign_applications','id'),('campaign_applications','campaign_id'),('campaign_applications','influencer_id'),('campaign_applications','status'),('campaign_applications','assignment_id'),
    ('payments','expected_amount')
),
column_checks as (
  select
    'column'::text as object_type,
    'public.' || r.table_name || '.' || r.column_name as item,
    case when c.column_name is not null then 'OK' else 'MISSING' end::text as status,
    coalesce(c.data_type,'')::text as details
  from required_columns r
  left join information_schema.columns c
    on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
),
required_functions(schema_name, function_name) as (
  values
    ('private','current_user_role'),
    ('public','set_updated_at'),
    ('public','influencer_campaign_availability'),
    ('public','update_assignment_execution_workflow')
),
function_checks as (
  select
    'function'::text as object_type,
    r.schema_name || '.' || r.function_name as item,
    case when exists (
      select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname=r.schema_name and p.proname=r.function_name
    ) then 'OK' else 'MISSING' end::text as status,
    ''::text as details
  from required_functions r
),
summary as (
  select 'summary'::text object_type,'preflight'::text item,
         case when exists(select 1 from table_checks where status='MISSING')
                    or exists(select 1 from column_checks where status='MISSING')
                    or exists(select 1 from function_checks where status='MISSING')
              then 'STOP' else 'READY' end::text status,
         'READY means the current beta.9.1 database has the prerequisites for the additive unified patch.'::text details
)
select * from summary
union all select * from table_checks
union all select * from column_checks
union all select * from function_checks
order by object_type,item;
