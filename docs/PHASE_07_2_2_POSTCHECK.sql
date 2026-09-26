-- Phase 07.2.2 post-UAT checks (READ ONLY)

-- 1) Recent registration submissions and their canonical creator status.
select
  s.id as submission_id,
  s.status as submission_status,
  s.canonical_influencer_id,
  i.directory_status,
  i.account_status,
  i.user_id,
  i.portal_access_requested_at
from public.influencer_registration_submissions s
left join public.influencers i on i.id=s.canonical_influencer_id
order by s.created_at desc
limit 25;

-- 2) Portal requests created from staged registration.
select
  r.id, r.influencer_id, r.status, r.registration_submission_id,
  i.directory_status, i.account_status, i.user_id
from public.portal_access_requests r
join public.influencers i on i.id=r.influencer_id
where r.registration_submission_id is not null
order by r.created_at desc
limit 25;

-- 3) There must be no campaign assignment on disallowed directory states.
select ca.id, ca.campaign_id, ca.influencer_id, ca.status, i.directory_status
from public.campaign_assignments ca
join public.influencers i on i.id=ca.influencer_id
where i.directory_status not in ('active','managed')
order by ca.created_at desc;
