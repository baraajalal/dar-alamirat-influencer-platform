-- Dar Al Amirat Creator Community
-- beta.9.1.1 Unified Operations - READ ONLY postcheck
-- Run after UNIFIED_OPERATIONS_DB_PATCH.sql.

with
required_tables(schema_name, object_name) as (
  values
    ('public','campaign_participant_drafts'),
    ('public','influencer_restriction_events')
),
table_checks as (
  select 'table'::text object_type,
         schema_name||'.'||object_name item,
         case when to_regclass(schema_name||'.'||object_name) is not null then 'OK' else 'MISSING' end::text status,
         ''::text details
  from required_tables
),
required_columns(table_name,column_name) as (
  values
    ('influencers','restriction_status'),('influencers','restriction_reason'),('influencers','restriction_expires_at'),('influencers','restriction_updated_by'),('influencers','restriction_updated_at'),
    ('campaign_assignments','attention_required'),('campaign_assignments','attention_reason')
),
column_checks as (
  select 'column'::text object_type,
         'public.'||r.table_name||'.'||r.column_name item,
         case when c.column_name is not null then 'OK' else 'MISSING' end::text status,
         coalesce(c.data_type,'')::text details
  from required_columns r
  left join information_schema.columns c
    on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
),
required_functions(schema_name,function_name) as (
  values
    ('public','set_influencer_restriction'),
    ('public','set_influencer_portal_account_state'),
    ('public','search_campaign_influencers'),
    ('public','save_campaign_application_drafts'),
    ('public','save_campaign_direct_drafts'),
    ('public','remove_campaign_participant_draft'),
    ('public','get_campaign_application_auto_rank'),
    ('public','list_campaign_application_auto_rankings'),
    ('public','create_assignment_from_participant_draft'),
    ('public','set_assignment_attention')
),
function_checks as (
  select 'function'::text object_type,
         r.schema_name||'.'||r.function_name item,
         case when exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=r.schema_name and p.proname=r.function_name) then 'OK' else 'MISSING' end::text status,
         ''::text details
  from required_functions r
),
data_checks as (
  select 'data'::text object_type,'invalid_restriction_statuses'::text item,
         count(*)::text status,'Expected 0'::text details
  from public.influencers where coalesce(restriction_status,'normal') not in ('normal','watchlist','blacklisted')
  union all
  select 'data','duplicate_active_participant_drafts',count(*)::text,'Expected 0'
  from (
    select campaign_id,influencer_id from public.campaign_participant_drafts where status='draft' group by campaign_id,influencer_id having count(*)>1
  ) d
  union all
  select 'data','orphan_assigned_drafts',count(*)::text,'Expected 0'
  from public.campaign_participant_drafts d
  left join public.campaign_assignments a on a.id=d.assignment_id
  where d.status='assigned' and a.id is null
  union all
  select 'data','blacklisted_open_drafts',count(*)::text,'Review if > 0; these may predate a later blacklist decision.'
  from public.campaign_participant_drafts d join public.influencers i on i.id=d.influencer_id
  where d.status='draft' and i.restriction_status='blacklisted'
),
summary as (
  select 'summary'::text object_type,'unified_patch'::text item,
         case when exists(select 1 from table_checks where status='MISSING')
                    or exists(select 1 from column_checks where status='MISSING')
                    or exists(select 1 from function_checks where status='MISSING')
              then 'CHECK_FAILED' else 'INSTALLED' end::text status,
         'INSTALLED means all required schema objects are present. Data rows are informational checks.'::text details
)
select * from summary
union all select * from table_checks
union all select * from column_checks
union all select * from function_checks
union all select * from data_checks
order by object_type,item;
