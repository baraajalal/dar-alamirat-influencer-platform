-- beta.7.2 preflight: read-only checks
select 'influencers' as object_name, to_regclass('public.influencers') is not null as ok
union all select 'social_accounts', to_regclass('public.social_accounts') is not null
union all select 'work_history', to_regclass('public.influencer_work_history') is not null
union all select 'portal_access_requests', to_regclass('public.portal_access_requests') is not null
union all select 'legal_consents', to_regclass('public.influencer_legal_consents') is not null
union all select 'unified_directory_migration_table', to_regclass('supabase_migrations.schema_migrations') is not null;

-- Should return zero rows. Resolve any collision before applying the migration.
select public.normalize_mobile(mobile_e164) as canonical_mobile, count(*) as rows_count
from public.influencers
where public.normalize_mobile(mobile_e164) ~ '^9665[0-9]{8}$'
group by public.normalize_mobile(mobile_e164)
having count(*) > 1;

-- Informational counts only.
select
  (select count(*) from public.influencers) as influencers,
  (select count(*) from public.influencers where directory_status='archived') as archived,
  (select count(*) from public.influencer_work_history) as work_history,
  (select count(*) from public.portal_access_requests where status in ('submitted','under_review','needs_changes','approved')) as open_activation_reviews;
