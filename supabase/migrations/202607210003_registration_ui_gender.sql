-- Registration UI v3: gender support and consent-free registration.
-- Run once after 202607210002_influencer_self_registration.sql.

begin;

alter table public.influencers
  add column if not exists gender text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'influencers_gender_check'
      and conrelid = 'public.influencers'::regclass
  ) then
    alter table public.influencers
      add constraint influencers_gender_check
      check (gender is null or gender in ('female', 'male'));
  end if;
end
$$;

create index if not exists idx_influencers_gender
  on public.influencers(gender);

create or replace function public.complete_influencer_registration(
  p_user_id uuid,
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
begin
  if p_user_id is null then
    raise exception 'Missing user id';
  end if;

  v_mobile := public.normalize_mobile(p_payload->>'mobile');

  if v_mobile is null or v_mobile !~ '^9665[0-9]{8}$' then
    raise exception 'Invalid mobile';
  end if;

  insert into public.profiles (
    id,
    role,
    full_name,
    mobile_e164,
    is_active
  ) values (
    p_user_id,
    'influencer'::public.user_role,
    nullif(trim(p_payload->>'fullName'), ''),
    v_mobile,
    true
  )
  on conflict (id) do update set
    role = 'influencer'::public.user_role,
    full_name = excluded.full_name,
    mobile_e164 = excluded.mobile_e164,
    is_active = true,
    updated_at = v_now;

  if p_existing_influencer_id is not null then
    update public.influencers
    set
      user_id = p_user_id,
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
      preferred_ad_categories = coalesce(
        array(select jsonb_array_elements_text(coalesce(p_payload->'preferredAdCategories', '[]'::jsonb))),
        '{}'::text[]
      ),
      content_style_preferences = coalesce(
        array(select jsonb_array_elements_text(coalesce(p_payload->'contentStylePreference', '[]'::jsonb))),
        '{}'::text[]
      ),
      source = 'self_registration',
      registration_source = 'self_registration',
      account_status = 'pending_review',
      claimed_at = v_now,
      archive_match_status = case when p_match_source = 'active' then 'matched' else p_match_source end,
      archive_influencer_id = coalesce(p_archive_influencer_id, archive_influencer_id),
      updated_at = v_now
    where id = p_existing_influencer_id
      and user_id is null
    returning id into v_influencer_id;

    if v_influencer_id is null then
      raise exception 'Influencer record is already claimed or missing';
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
      source,
      registration_source,
      account_status,
      claimed_at,
      archive_match_status,
      archive_influencer_id
    ) values (
      p_user_id,
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
      coalesce(
        array(select jsonb_array_elements_text(coalesce(p_payload->'preferredAdCategories', '[]'::jsonb))),
        '{}'::text[]
      ),
      coalesce(
        array(select jsonb_array_elements_text(coalesce(p_payload->'contentStylePreference', '[]'::jsonb))),
        '{}'::text[]
      ),
      'self_registration',
      'self_registration',
      'pending_review',
      v_now,
      case when p_match_source in ('archive', 'multiple') then p_match_source else 'not_found' end,
      p_archive_influencer_id
    )
    returning id into v_influencer_id;
  end if;

  insert into public.influencer_financial_profiles (
    influencer_id,
    national_id,
    bank_name,
    iban,
    account_holder_name,
    mawthooq_number,
    mawthooq_expiry_date
  ) values (
    v_influencer_id,
    nullif(trim(p_payload->>'nationalId'), ''),
    nullif(trim(p_payload->>'bankName'), ''),
    nullif(upper(regexp_replace(coalesce(p_payload->>'iban', ''), '[[:space:]-]', '', 'g')), ''),
    nullif(trim(p_payload->>'accountHolderName'), ''),
    nullif(trim(p_payload->>'mawthooqNumber'), ''),
    nullif(p_payload->>'mawthooqExpiryDate', '')::date
  )
  on conflict (influencer_id) do update set
    national_id = excluded.national_id,
    bank_name = excluded.bank_name,
    iban = excluded.iban,
    account_holder_name = excluded.account_holder_name,
    mawthooq_number = excluded.mawthooq_number,
    mawthooq_expiry_date = excluded.mawthooq_expiry_date,
    updated_at = v_now;

  delete from public.social_accounts
  where influencer_id = v_influencer_id;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_payload->'socialAccounts', '[]'::jsonb))
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
    ) values (
      v_influencer_id,
      v_platform,
      nullif(trim(v_item->>'username'), ''),
      nullif(trim(v_item->>'profileUrl'), ''),
      nullif(v_item->>'followersCount', '')::bigint,
      nullif(v_item->>'averageLikes', '')::numeric,
      nullif(v_item->>'averageViews', '')::numeric,
      nullif(v_item->>'averageComments', '')::numeric,
      nullif(v_item->>'engagementRate', '')::numeric,
      nullif(v_item->>'femaleAudience', '')::numeric,
      nullif(v_item->>'maleAudience', '')::numeric,
      nullif(trim(v_item->>'audienceMainCity'), ''),
      nullif(trim(v_item->>'audienceMainCountry'), '')
    );
  end loop;

  insert into public.influencer_claim_requests (
    user_id,
    influencer_id,
    archive_influencer_id,
    requested_mobile,
    normalized_mobile,
    match_type,
    status,
    prefill_data
  ) values (
    p_user_id,
    v_influencer_id,
    p_archive_influencer_id,
    p_payload->>'mobile',
    v_mobile,
    case when p_match_source in ('active', 'archive', 'multiple') then p_match_source else 'none' end,
    'pending',
    jsonb_build_object(
      'fullName', p_payload->>'fullName',
      'city', p_payload->>'city',
      'country', p_payload->>'country',
      'gender', p_payload->>'gender'
    )
  )
  on conflict (user_id) where status = 'pending'
  do update set
    influencer_id = excluded.influencer_id,
    archive_influencer_id = excluded.archive_influencer_id,
    requested_mobile = excluded.requested_mobile,
    normalized_mobile = excluded.normalized_mobile,
    match_type = excluded.match_type,
    prefill_data = excluded.prefill_data,
    updated_at = v_now;

  insert into public.activity_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  ) values (
    p_user_id,
    'influencer',
    v_influencer_id,
    'self_registered',
    jsonb_build_object('match_source', p_match_source)
  );

  return v_influencer_id;
end;
$$;

revoke all on function public.complete_influencer_registration(uuid, jsonb, text, uuid, uuid)
from public, anon, authenticated;
grant execute on function public.complete_influencer_registration(uuid, jsonb, text, uuid, uuid)
to service_role;

commit;
