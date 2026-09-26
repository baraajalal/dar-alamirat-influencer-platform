-- READ ONLY post-check for Phase 07.2.3
select
  directory_status,
  count(*) as influencer_count,
  min(profile_completion) as min_completion,
  round(avg(profile_completion)::numeric, 2) as avg_completion,
  max(profile_completion) as max_completion,
  count(*) filter (where profile_completion = 0) as zero_completion_count
from public.influencers
group by directory_status
order by directory_status;

select
  i.id,
  i.full_name,
  i.directory_status,
  i.profile_completion,
  i.city,
  i.primary_category,
  count(sa.id) as social_accounts
from public.influencers i
left join public.social_accounts sa on sa.influencer_id = i.id
where i.directory_status in ('archived','activation_pending','active','managed')
group by i.id,i.full_name,i.directory_status,i.profile_completion,i.city,i.primary_category
order by i.profile_completion desc, i.full_name
limit 50;
