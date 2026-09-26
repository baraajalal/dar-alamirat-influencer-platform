-- Phase 06 preflight. READ-ONLY. Do not modify data.

-- 1) Required base objects and functions.
select
  to_regclass('public.campaigns') as campaigns,
  to_regclass('public.campaign_assignments') as campaign_assignments,
  to_regclass('public.campaign_applications') as campaign_applications,
  to_regclass('public.influencers') as influencers,
  to_regclass('public.social_accounts') as social_accounts,
  to_regclass('public.profiles') as profiles,
  to_regclass('public.activity_logs') as activity_logs,
  to_regclass('public.assignment_financial_settlements') as assignment_financial_settlements,
  to_regprocedure('public.set_updated_at()') as set_updated_at,
  to_regprocedure('private.is_staff()') as is_staff,
  to_regprocedure('private.current_user_role()') as current_user_role,
  to_regprocedure('public.search_campaign_influencers(uuid,text,integer)') as creator_search,
  to_regprocedure('public.list_campaign_opportunities()') as opportunity_list,
  to_regprocedure('public.submit_campaign_application(uuid,text,boolean)') as opportunity_submit,
  to_regprocedure('public.review_campaign_application(uuid,text,text)') as opportunity_review;

-- 2) Required columns. This result must be 0 rows.
with required_columns(table_name,column_name) as (
  values
    ('campaigns','id'),('campaigns','name'),('campaigns','brand'),('campaigns','status'),
    ('campaigns','publishing_date'),('campaigns','max_participants'),('campaigns','max_applications'),
    ('campaigns','portal_visibility'),('campaigns','applications_open_at'),('campaigns','applications_close_at'),
    ('campaign_assignments','id'),('campaign_assignments','campaign_id'),('campaign_assignments','influencer_id'),
    ('campaign_assignments','status'),('campaign_assignments','accepted_at'),('campaign_assignments','publishing_date'),
    ('campaign_assignments','availability_blocked_until'),('campaign_assignments','settled_at'),
    ('campaign_assignments','source'),('campaign_assignments','invited_at'),('campaign_assignments','agreed_amount'),
    ('campaign_assignments','currency'),('campaign_assignments','updated_at'),('campaign_assignments','created_at'),
    ('campaign_applications','id'),('campaign_applications','campaign_id'),('campaign_applications','influencer_id'),
    ('campaign_applications','status'),('campaign_applications','agreed_compensation_mode'),
    ('campaign_applications','agreed_compensation_amount'),('campaign_applications','agreed_compensation_currency'),
    ('profiles','id'),('profiles','role'),('profiles','full_name'),('profiles','is_active'),
    ('activity_logs','actor_id'),('activity_logs','entity_type'),('activity_logs','entity_id'),
    ('activity_logs','action'),('activity_logs','metadata')
)
select r.table_name,r.column_name
from required_columns r
left join information_schema.columns c
  on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
where c.column_name is null
order by r.table_name,r.column_name;

-- 3) Existing active legacy cooldowns that will be preserved as global exclusivity.
select count(*) as active_legacy_cooldowns
from public.campaign_assignments
where availability_blocked_until > now();

-- 4) Current campaign brand text values. Review unmatched/custom spellings after migration.
select coalesce(nullif(trim(brand),''),'(empty)') as brand_text,count(*) as campaigns
from public.campaigns
group by coalesce(nullif(trim(brand),''),'(empty)')
order by campaigns desc,brand_text;

-- 5) Migration history: Phase 06 must NOT already be applied before the first push.
select *
from supabase_migrations.schema_migrations
order by version desc
limit 10;
