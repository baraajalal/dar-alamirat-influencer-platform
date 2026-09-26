begin;

-- Phase 07.2.3
-- Keep influencers.profile_completion synchronized with data already available
-- in the unified profile, social accounts and Mawthooq financial metadata.
-- This fixes legacy/archive profiles remaining at 0% simply because they were
-- imported before profile-completion synchronization existed.

create or replace function public.refresh_influencer_profile_completion(
  p_influencer_id uuid
)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_influencer record;
  v_mawthooq_number text;
  v_social_accounts jsonb := '[]'::jsonb;
  v_completion smallint := 0;
begin
  select
    i.full_name,
    i.mobile_e164,
    i.city,
    i.country,
    i.gender,
    i.mawthooq_status,
    i.preferred_ad_categories,
    i.content_style_preferences
  into v_influencer
  from public.influencers i
  where i.id = p_influencer_id;

  if not found then
    return null;
  end if;

  select f.mawthooq_number
  into v_mawthooq_number
  from public.influencer_financial_profiles f
  where f.influencer_id = p_influencer_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'platform', s.platform::text,
        'username', s.username,
        'profileUrl', s.profile_url,
        'followersCount', s.followers_count,
        'averageViews', s.average_views,
        'engagementRate', s.engagement_rate
      )
      order by s.created_at, s.id
    ),
    '[]'::jsonb
  )
  into v_social_accounts
  from public.social_accounts s
  where s.influencer_id = p_influencer_id;

  v_completion := public.calculate_influencer_profile_completion(
    v_influencer.full_name,
    v_influencer.mobile_e164,
    v_influencer.city,
    v_influencer.country,
    v_influencer.gender,
    case
      when v_influencer.mawthooq_status is true then 'yes'
      when v_influencer.mawthooq_status is false then 'no'
      else null
    end,
    v_mawthooq_number,
    coalesce(v_influencer.preferred_ad_categories, '{}'::text[]),
    coalesce(v_influencer.content_style_preferences, '{}'::text[]),
    v_social_accounts
  );

  update public.influencers i
  set profile_completion = v_completion
  where i.id = p_influencer_id
    and i.profile_completion is distinct from v_completion;

  return v_completion;
end;
$$;

revoke all on function public.refresh_influencer_profile_completion(uuid)
from public, anon, authenticated;
grant execute on function public.refresh_influencer_profile_completion(uuid)
to service_role;

create or replace function public.trigger_refresh_influencer_profile_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.refresh_influencer_profile_completion(new.id);
    return new;
  end if;

  if old.full_name is distinct from new.full_name
     or old.mobile_e164 is distinct from new.mobile_e164
     or old.city is distinct from new.city
     or old.country is distinct from new.country
     or old.gender is distinct from new.gender
     or old.mawthooq_status is distinct from new.mawthooq_status
     or old.preferred_ad_categories is distinct from new.preferred_ad_categories
     or old.content_style_preferences is distinct from new.content_style_preferences
  then
    perform public.refresh_influencer_profile_completion(new.id);
  end if;
  return new;
end;
$$;

create or replace function public.trigger_refresh_social_profile_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_influencer_profile_completion(old.influencer_id);
    return old;
  end if;

  perform public.refresh_influencer_profile_completion(new.influencer_id);
  return new;
end;
$$;

create or replace function public.trigger_refresh_financial_profile_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_influencer_profile_completion(old.influencer_id);
    return old;
  end if;

  perform public.refresh_influencer_profile_completion(new.influencer_id);
  return new;
end;
$$;

revoke all on function public.trigger_refresh_influencer_profile_completion()
from public, anon, authenticated;
revoke all on function public.trigger_refresh_social_profile_completion()
from public, anon, authenticated;
revoke all on function public.trigger_refresh_financial_profile_completion()
from public, anon, authenticated;

-- Profile fields that affect the existing completion formula.
-- The function itself ignores profile_completion-only updates, preventing loops.
drop trigger if exists influencers_refresh_profile_completion on public.influencers;
create trigger influencers_refresh_profile_completion
after insert or update on public.influencers
for each row
execute function public.trigger_refresh_influencer_profile_completion();

-- Any social-account change can affect completion.
drop trigger if exists social_accounts_refresh_profile_completion on public.social_accounts;
create trigger social_accounts_refresh_profile_completion
after insert or update or delete on public.social_accounts
for each row
execute function public.trigger_refresh_social_profile_completion();

-- Mawthooq data is kept here; recalculating on any financial-row change is
-- inexpensive and prevents future write paths from missing the refresh.
drop trigger if exists financial_profile_refresh_profile_completion on public.influencer_financial_profiles;
create trigger financial_profile_refresh_profile_completion
after insert or update or delete on public.influencer_financial_profiles
for each row
execute function public.trigger_refresh_financial_profile_completion();

-- Backfill existing records without changing their historical updated_at.
-- Disable only the generic updated_at trigger during this maintenance pass.
-- The surrounding transaction guarantees that the trigger state rolls back
-- automatically if any statement fails before COMMIT.
alter table public.influencers disable trigger influencers_set_updated_at;

do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.influencers
  loop
    perform public.refresh_influencer_profile_completion(v_id);
  end loop;
end;
$$;

alter table public.influencers enable trigger influencers_set_updated_at;

commit;
notify pgrst, 'reload schema';
