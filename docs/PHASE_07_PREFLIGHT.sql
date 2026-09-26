-- Phase 07 preflight: read-only checks before influencer work history migration.

select
  to_regclass('public.influencers') as influencers,
  to_regclass('public.social_accounts') as social_accounts,
  to_regclass('public.campaigns') as campaigns,
  to_regclass('public.campaign_assignments') as campaign_assignments,
  to_regclass('public.assignment_platforms') as assignment_platforms,
  to_regclass('public.assignment_compensations') as assignment_compensations,
  to_regclass('public.content_items') as content_items,
  to_regclass('public.brands') as brands,
  to_regclass('public.activity_logs') as activity_logs,
  to_regprocedure('public.normalize_mobile(text)') as normalize_mobile,
  to_regprocedure('public.set_updated_at()') as set_updated_at,
  to_regprocedure('private.current_user_role()') as current_user_role;

with required_columns(table_name,column_name) as (
  values
    ('influencers','id'),('influencers','normalized_mobile'),('influencers','mobile_e164'),
    ('campaigns','id'),('campaigns','name'),('campaigns','brand'),('campaigns','brand_id'),('campaigns','status'),('campaigns','campaign_type'),('campaigns','opportunity_type'),('campaigns','end_date'),
    ('campaign_assignments','id'),('campaign_assignments','campaign_id'),('campaign_assignments','influencer_id'),('campaign_assignments','status'),('campaign_assignments','publishing_date'),('campaign_assignments','agreement_date'),('campaign_assignments','agreed_amount'),('campaign_assignments','currency'),
    ('assignment_platforms','id'),('assignment_platforms','assignment_id'),('assignment_platforms','social_account_id'),
    ('social_accounts','id'),('social_accounts','platform'),
    ('content_items','assignment_platform_id'),('content_items','content_type'),('content_items','post_url'),('content_items','status'),
    ('assignment_compensations','assignment_id'),('assignment_compensations','type')
)
select r.table_name,r.column_name
from required_columns r
left join information_schema.columns c
  on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
where c.column_name is null
order by r.table_name,r.column_name;

-- Informational only: completed work that Phase 07 will backfill automatically.
select count(*) as assignments_eligible_for_history_backfill
from public.campaign_assignments a
join public.campaigns c on c.id=a.campaign_id
where a.status in ('paid','closed')
   or (c.status in ('completed','archived') and a.status not in ('rejected','cancelled'));

-- Phase 07 should not exist before migration.
select
  to_regclass('public.influencer_work_history') as work_history_before_phase07,
  to_regclass('public.work_history_import_batches') as import_batches_before_phase07;

-- Canonical influencer mobile matching must be unambiguous. Expected: 0 rows.
select normalized_mobile, count(*) as duplicate_profiles
from public.influencers
where normalized_mobile is not null and normalized_mobile <> ''
group by normalized_mobile
having count(*) > 1
order by duplicate_profiles desc, normalized_mobile;

-- Migration should not already be registered before Phase 07 deployment. Expected: 0 rows.
select version
from supabase_migrations.schema_migrations
where version = '20260912100000';
