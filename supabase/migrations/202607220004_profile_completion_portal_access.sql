-- Dar Al Amirat Influencer Portal
-- Profile completion, optional portal-access requests, and profile-only saving.

begin;

alter table public.influencers
  add column if not exists profile_completion smallint not null default 0,
  add column if not exists portal_access_requested_at timestamptz,
  add column if not exists portal_access_required boolean not null default false;

alter table public.influencers
  drop constraint if exists influencers_profile_completion_check;

alter table public.influencers
  add constraint influencers_profile_completion_check
  check (profile_completion between 0 and 100);

create table if not exists public.portal_access_requests (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  requested_email text not null,
  normalized_mobile text not null,
  request_reason text not null default 'self_service'
    check (request_reason in ('self_service', 'campaign_access', 'payment_required')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  priority text not null default 'normal'
    check (priority in ('normal', 'high')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portal_access_requests_one_open_idx
  on public.portal_access_requests (influencer_id)
  where status in ('pending', 'approved');

create index if not exists portal_access_requests_status_created_idx
  on public.portal_access_requests (status, created_at desc);

create index if not exists payments_assignment_status_idx
  on public.payments (assignment_id, status);


drop trigger if exists portal_access_requests_set_updated_at on public.portal_access_requests;
create trigger portal_access_requests_set_updated_at
before update on public.portal_access_requests
for each row execute function public.set_updated_at();

alter table public.portal_access_requests enable row level security;

drop policy if exists portal_access_requests_staff_select on public.portal_access_requests;
create policy portal_access_requests_staff_select
on public.portal_access_requests
for select
to authenticated
using ((select private.is_staff()));

drop policy if exists portal_access_requests_admin_update on public.portal_access_requests;
create policy portal_access_requests_admin_update
on public.portal_access_requests
for update
to authenticated
using ((select private.current_user_role()) = 'admin')
with check ((select private.current_user_role()) = 'admin');

create or replace function public.calculate_influencer_profile_completion(
  p_full_name text,
  p_mobile text,
  p_city text,
  p_country text,
  p_gender text,
  p_has_mawthooq text,
  p_mawthooq_number text,
  p_preferred_ad_categories text[],
  p_content_style_preferences text[],
  p_social_accounts jsonb
)
returns smallint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_score integer := 0;
  v_has_basic_social boolean := false;
begin
  -- Basic profile: 35 points.
  if nullif(trim(coalesce(p_full_name, '')), '') is not null then v_score := v_score + 10; end if;
  if public.normalize_mobile(coalesce(p_mobile, '')) ~ '^9665[0-9]{8}$' then v_score := v_score + 10; end if;
  if nullif(trim(coalesce(p_city, '')), '') is not null then v_score := v_score + 5; end if;
  if nullif(trim(coalesce(p_country, '')), '') is not null then v_score := v_score + 5; end if;
  if p_gender in ('female', 'male') then v_score := v_score + 5; end if;

  -- Social presence: 35 points.
  select exists (
    select 1
    from jsonb_array_elements(coalesce(p_social_accounts, '[]'::jsonb)) item
    where nullif(trim(item->>'platform'), '') is not null
      and nullif(trim(item->>'username'), '') is not null
      and coalesce(nullif(regexp_replace(item->>'followersCount', '[^0-9.]', '', 'g'), ''), '0')::numeric >= 0
  ) into v_has_basic_social;

  if v_has_basic_social then v_score := v_score + 25; end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_social_accounts, '[]'::jsonb)) item
    where nullif(trim(item->>'profileUrl'), '') is not null
  ) then v_score := v_score + 5; end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_social_accounts, '[]'::jsonb)) item
    where nullif(trim(item->>'averageViews'), '') is not null
       or nullif(trim(item->>'engagementRate'), '') is not null
  ) then v_score := v_score + 5; end if;

  -- Collaboration preferences: 20 points.
  if coalesce(cardinality(p_preferred_ad_categories), 0) > 0 then v_score := v_score + 10; end if;
  if coalesce(cardinality(p_content_style_preferences), 0) > 0 then v_score := v_score + 10; end if;

  -- Mawthooq readiness: 10 points.
  if p_has_mawthooq = 'no' then
    v_score := v_score + 10;
  elsif p_has_mawthooq = 'yes' then
    v_score := v_score + 5;
    if nullif(trim(coalesce(p_mawthooq_number, '')), '') is not null then
      v_score := v_score + 5;
    end if;
  end if;

  return least(v_score, 100)::smallint;
end;
$$;

create or replace function public.save_influencer_profile(
  p_payload jsonb,
  p_match_source text,
  p_archive_influencer_id uuid default null,
  p_existing_influencer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_influencer_id uuid;
  v_mobile text;
  v_now timestamptz := now();
  v_item jsonb;
  v_platform public.platform_type;
  v_preferred text[];
  v_content_styles text[];
  v_completion smallint;
begin
  v_mobile := public.normalize_mobile(p_payload->>'mobile');

  if v_mobile is null or v_mobile !~ '^9665[0-9]{8}$' then
    raise exception 'INVALID_MOBILE';
  end if;

  select coalesce(array_agg(value), '{}'::text[])
  into v_preferred
  from jsonb_array_elements_text(coalesce(p_payload->'preferredAdCategories', '[]'::jsonb));

  select coalesce(array_agg(value), '{}'::text[])
  into v_content_styles
  from jsonb_array_elements_text(coalesce(p_payload->'contentStylePreference', '[]'::jsonb));

  v_completion := public.calculate_influencer_profile_completion(
    p_payload->>'fullName',
    v_mobile,
    p_payload->>'city',
    coalesce(nullif(trim(p_payload->>'country'), ''), 'Saudi Arabia'),
    p_payload->>'gender',
    p_payload->>'hasMawthooq',
    p_payload->>'mawthooqNumber',
    v_preferred,
    v_content_styles,
    coalesce(p_payload->'socialAccounts', '[]'::jsonb)
  );

  if p_existing_influencer_id is not null then
    update public.influencers
    set
      full_name = nullif(trim(p_payload->>'fullName'), ''),
      mobile_e164 = v_mobile,
      normalized_mobile = v_mobile,
      email = nullif(lower(trim(p_payload->>'email')), ''),
      city = nullif(trim(p_payload->>'city'), ''),
      country = coalesce(nullif(trim(p_payload->>'country'), ''), 'Saudi Arabia'),
      gender = nullif(p_payload->>'gender', ''),
      mawthooq_status = case
        when p_payload->>'hasMawthooq' = 'yes' then true
        when p_payload->>'hasMawthooq' = 'no' then false
        else null
      end,
      preferred_ad_categories = v_preferred,
      content_style_preferences = v_content_styles,
      profile_completion = v_completion,
      source = 'public_profile_form',
      registration_source = 'self_registration',
      account_status = case when user_id is null then 'unclaimed' else account_status end,
      archive_match_status = case
        when p_match_source in ('active', 'archive') then 'matched'
        else 'not_found'
      end,
      archive_influencer_id = coalesce(p_archive_influencer_id, archive_influencer_id),
      updated_at = v_now
    where id = p_existing_influencer_id
      and user_id is null
    returning id into v_influencer_id;

    if v_influencer_id is null then
      raise exception 'PROFILE_ALREADY_CLAIMED_OR_MISSING';
    end if;
  else
    insert into public.influencers (
      user_id,
      full_name,
      mobile_e164,
      normalized_mobile,
      email,
      city,
      country,
      gender,
      mawthooq_status,
      preferred_ad_categories,
      content_style_preferences,
      profile_completion,
      source,
      registration_source,
      account_status,
      claimed_at,
      archive_match_status,
      archive_influencer_id
    )
    values (
      null,
      nullif(trim(p_payload->>'fullName'), ''),
      v_mobile,
      v_mobile,
      nullif(lower(trim(p_payload->>'email')), ''),
      nullif(trim(p_payload->>'city'), ''),
      coalesce(nullif(trim(p_payload->>'country'), ''), 'Saudi Arabia'),
      nullif(p_payload->>'gender', ''),
      case
        when p_payload->>'hasMawthooq' = 'yes' then true
        when p_payload->>'hasMawthooq' = 'no' then false
        else null
      end,
      v_preferred,
      v_content_styles,
      v_completion,
      'public_profile_form',
      'self_registration',
      'unclaimed',
      null,
      case when p_match_source = 'archive' then 'matched' else 'not_found' end,
      p_archive_influencer_id
    )
    returning id into v_influencer_id;
  end if;

  -- Sensitive financial data is not required by the public profile form.
  -- Preserve existing values and update only fields actually provided.
  insert into public.influencer_financial_profiles (
    influencer_id,
    national_id,
    bank_name,
    iban,
    account_holder_name,
    mawthooq_number,
    mawthooq_expiry_date
  )
  values (
    v_influencer_id,
    nullif(trim(p_payload->>'nationalId'), ''),
    nullif(trim(p_payload->>'bankName'), ''),
    nullif(upper(regexp_replace(coalesce(p_payload->>'iban', ''), '[[:space:]-]', '', 'g')), ''),
    nullif(trim(p_payload->>'accountHolderName'), ''),
    nullif(trim(p_payload->>'mawthooqNumber'), ''),
    nullif(p_payload->>'mawthooqExpiryDate', '')::date
  )
  on conflict (influencer_id)
  do update set
    national_id = coalesce(excluded.national_id, public.influencer_financial_profiles.national_id),
    bank_name = coalesce(excluded.bank_name, public.influencer_financial_profiles.bank_name),
    iban = coalesce(excluded.iban, public.influencer_financial_profiles.iban),
    account_holder_name = coalesce(excluded.account_holder_name, public.influencer_financial_profiles.account_holder_name),
    mawthooq_number = coalesce(excluded.mawthooq_number, public.influencer_financial_profiles.mawthooq_number),
    mawthooq_expiry_date = coalesce(excluded.mawthooq_expiry_date, public.influencer_financial_profiles.mawthooq_expiry_date),
    updated_at = v_now;

  -- The submitted list becomes the source of truth for social accounts.
  delete from public.social_accounts where influencer_id = v_influencer_id;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(p_payload->'socialAccounts', '[]'::jsonb))
  loop
    v_platform := case lower(coalesce(v_item->>'platform', 'other'))
      when 'instagram' then 'instagram'::public.platform_type
      when 'tiktok' then 'tiktok'::public.platform_type
      when 'snapchat' then 'snapchat'::public.platform_type
      when 'youtube' then 'youtube'::public.platform_type
      when 'x' then 'x'::public.platform_type
      when 'facebook' then 'facebook'::public.platform_type
      else 'other'::public.platform_type
    end;

    insert into public.social_accounts (
      influencer_id,
      platform,
      username,
      profile_url,
      followers_count,
      average_likes,
      average_views,
      average_comments,
      engagement_rate,
      female_audience,
      male_audience,
      audience_main_city,
      audience_main_country
    )
    values (
      v_influencer_id,
      v_platform,
      nullif(trim(v_item->>'username'), ''),
      nullif(trim(v_item->>'profileUrl'), ''),
      nullif(regexp_replace(coalesce(v_item->>'followersCount', ''), '[^0-9.]', '', 'g'), '')::bigint,
      nullif(regexp_replace(coalesce(v_item->>'averageLikes', ''), '[^0-9.]', '', 'g'), '')::numeric,
      nullif(regexp_replace(coalesce(v_item->>'averageViews', ''), '[^0-9.]', '', 'g'), '')::numeric,
      nullif(regexp_replace(coalesce(v_item->>'averageComments', ''), '[^0-9.]', '', 'g'), '')::numeric,
      nullif(regexp_replace(coalesce(v_item->>'engagementRate', ''), '[^0-9.]', '', 'g'), '')::numeric,
      nullif(regexp_replace(coalesce(v_item->>'femaleAudience', ''), '[^0-9.]', '', 'g'), '')::numeric,
      nullif(regexp_replace(coalesce(v_item->>'maleAudience', ''), '[^0-9.]', '', 'g'), '')::numeric,
      nullif(trim(v_item->>'audienceMainCity'), ''),
      nullif(trim(v_item->>'audienceMainCountry'), '')
    );
  end loop;

  insert into public.activity_logs (actor_id, entity_type, entity_id, action, metadata)
  values (
    null,
    'influencer',
    v_influencer_id,
    'profile_submitted',
    jsonb_build_object(
      'match_source', p_match_source,
      'account_created', false,
      'profile_completion', v_completion
    )
  );

  return v_influencer_id;
end;
$$;


create or replace function public.link_influencer_portal_invitation(
  p_request_id uuid,
  p_influencer_id uuid,
  p_user_id uuid,
  p_approved_by uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_mobile text;
  v_request_status text;
begin
  select full_name, mobile_e164
  into v_name, v_mobile
  from public.influencers
  where id = p_influencer_id
    and user_id is null
  for update;

  if v_name is null then
    raise exception 'INFLUENCER_ALREADY_LINKED_OR_MISSING';
  end if;

  select status
  into v_request_status
  from public.portal_access_requests
  where id = p_request_id
    and influencer_id = p_influencer_id
  for update;

  if v_request_status is null or v_request_status not in ('pending', 'approved') then
    raise exception 'ACCESS_REQUEST_CLOSED_OR_MISSING';
  end if;

  insert into public.profiles (
    id,
    role,
    full_name,
    mobile_e164,
    is_active
  )
  values (
    p_user_id,
    'influencer'::public.user_role,
    v_name,
    v_mobile,
    true
  );

  update public.influencers
  set
    user_id = p_user_id,
    email = lower(trim(p_email)),
    account_status = 'invited',
    claimed_at = now(),
    approved_by = p_approved_by,
    approved_at = now(),
    updated_at = now()
  where id = p_influencer_id;

  update public.portal_access_requests
  set
    status = 'approved',
    reviewed_by = p_approved_by,
    reviewed_at = now(),
    review_notes = 'Invitation sent.',
    updated_at = now()
  where id = p_request_id;

  insert into public.activity_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    p_approved_by,
    'influencer',
    p_influencer_id,
    'portal_invitation_sent',
    jsonb_build_object(
      'request_id', p_request_id,
      'invited_user_id', p_user_id
    )
  );
end;
$$;

create or replace function public.complete_influencer_portal_activation(
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_influencer_id uuid;
begin
  update public.influencers
  set
    account_status = 'active',
    updated_at = now()
  where user_id = p_user_id
  returning id into v_influencer_id;

  if v_influencer_id is null then
    raise exception 'INFLUENCER_PROFILE_NOT_FOUND';
  end if;

  update public.portal_access_requests
  set
    status = 'completed',
    updated_at = now()
  where influencer_id = v_influencer_id
    and status in ('pending', 'approved');

  insert into public.activity_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    p_user_id,
    'influencer',
    v_influencer_id,
    'portal_account_activated',
    '{}'::jsonb
  );

  return v_influencer_id;
end;
$$;

revoke all on function public.link_influencer_portal_invitation(
  uuid, uuid, uuid, uuid, text
) from public, anon, authenticated;

grant execute on function public.link_influencer_portal_invitation(
  uuid, uuid, uuid, uuid, text
) to service_role;

revoke all on function public.complete_influencer_portal_activation(uuid)
from public, anon, authenticated;

grant execute on function public.complete_influencer_portal_activation(uuid)
to service_role;

revoke all on function public.calculate_influencer_profile_completion(
  text, text, text, text, text, text, text, text[], text[], jsonb
) from public, anon, authenticated;

grant execute on function public.calculate_influencer_profile_completion(
  text, text, text, text, text, text, text, text[], text[], jsonb
) to service_role;

revoke all on function public.save_influencer_profile(jsonb, text, uuid, uuid)
from public, anon, authenticated;

grant execute on function public.save_influencer_profile(jsonb, text, uuid, uuid)
to service_role;

commit;
