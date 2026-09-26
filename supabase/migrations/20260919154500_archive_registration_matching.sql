-- Dar Al Amirat beta.7.2
-- Archive-first identity matching + staged public registration.
-- Archive rows remain historical profiles only. Public registration never auto-merges.

begin;


-- Keep one canonical Saudi mobile identity across Arabic/Persian/English digits.
create or replace function public.normalize_mobile(input_mobile text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  mobile_digits text;
begin
  if input_mobile is null then return null; end if;
  mobile_digits := translate(input_mobile,'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789');
  mobile_digits := regexp_replace(mobile_digits,'[^0-9]','','g');
  if mobile_digits = '' then return null; end if;
  if mobile_digits like '00966%' then mobile_digits := substring(mobile_digits from 3); end if;
  if mobile_digits like '96605%' and length(mobile_digits)=13 then mobile_digits := '966' || substring(mobile_digits from 5); end if;
  if mobile_digits like '9665%' and length(mobile_digits)=12 then return mobile_digits; end if;
  if mobile_digits like '05%' and length(mobile_digits)=10 then return '966' || substring(mobile_digits from 2); end if;
  if mobile_digits like '5%' and length(mobile_digits)=9 then return '966' || mobile_digits; end if;
  return mobile_digits;
end;
$$;

create table if not exists public.influencer_registration_submissions (
  id uuid primary key default gen_random_uuid(),
  normalized_mobile text not null,
  requested_email text not null,
  payload jsonb not null,
  consent_locale text not null default 'ar' check (consent_locale in ('ar','en')),
  terms_version text not null,
  privacy_version text not null,
  consent_accepted_at timestamptz not null default now(),
  status text not null default 'awaiting_match' check (status in (
    'awaiting_match',
    'awaiting_admin_review',
    'matched_existing',
    'new_profile_created',
    'identity_correction_required',
    'cancelled'
  )),
  canonical_influencer_id uuid references public.influencers(id) on delete set null,
  matched_influencer_id uuid references public.influencers(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  match_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists influencer_registration_submissions_status_idx
  on public.influencer_registration_submissions(status, created_at desc);
create index if not exists influencer_registration_submissions_mobile_idx
  on public.influencer_registration_submissions(normalized_mobile, created_at desc);

create table if not exists public.influencer_match_candidates (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.influencer_registration_submissions(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  score integer not null default 0,
  mobile_match boolean not null default false,
  social_username_match boolean not null default false,
  profile_url_match boolean not null default false,
  name_support_match boolean not null default false,
  reasons jsonb not null default '[]'::jsonb,
  decision text not null default 'pending' check (decision in ('pending','selected','rejected')),
  created_at timestamptz not null default now(),
  unique(submission_id, influencer_id)
);

create index if not exists influencer_match_candidates_submission_idx
  on public.influencer_match_candidates(submission_id, score desc);

alter table public.portal_access_requests
  add column if not exists registration_submission_id uuid references public.influencer_registration_submissions(id) on delete set null;
create unique index if not exists portal_access_requests_submission_unique_idx
  on public.portal_access_requests(registration_submission_id)
  where registration_submission_id is not null;

alter table public.influencer_work_history
  add column if not exists archive_year smallint,
  add column if not exists archive_month smallint;

alter table public.influencer_work_history
  drop constraint if exists influencer_work_history_archive_year_check;
alter table public.influencer_work_history
  add constraint influencer_work_history_archive_year_check
  check (archive_year is null or archive_year between 2000 and 2100);

alter table public.influencer_work_history
  drop constraint if exists influencer_work_history_archive_month_check;
alter table public.influencer_work_history
  add constraint influencer_work_history_archive_month_check
  check (archive_month is null or archive_month between 1 and 12);

create or replace function public.normalize_social_username(input_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  v := lower(trim(coalesce(input_value,'')));
  v := regexp_replace(v, '^@+', '');
  v := regexp_replace(v, '[[:space:]]+', '', 'g');
  return nullif(v,'');
end;
$$;

create or replace function public.normalize_social_url(input_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  v := lower(trim(coalesce(input_value,'')));
  v := regexp_replace(v, '^https?://', '');
  v := regexp_replace(v, '^www\\.', '');
  v := regexp_replace(v, '[?#].*$', '');
  v := regexp_replace(v, '/+$', '');
  return nullif(v,'');
end;
$$;

create or replace function public.apply_registration_submission(
  p_submission_id uuid,
  p_existing_influencer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.influencer_registration_submissions%rowtype;
  v_payload jsonb;
  v_influencer jsonb;
  v_social jsonb;
  v_item jsonb;
  v_influencer_id uuid;
  v_mobile text;
  v_display_mobile text;
  v_actor uuid := auth.uid();
  v_role text := coalesce(private.current_user_role()::text,'');
  v_auth_role text := coalesce(auth.role(),'');
  v_platform public.platform_type;
  v_username text;
  v_profile_url text;
  v_existing_social_id uuid;
  v_preferred text[];
  v_content text[];
  v_shooting text[];
  v_now timestamptz := now();
  v_request_id uuid;
  v_has_exact_mobile_conflict boolean := false;
  v_target_has_user boolean := false;
begin
  if v_role <> 'admin' and v_auth_role <> 'service_role' then
    raise exception 'ADMIN_ONLY';
  end if;

  select * into v_submission
  from public.influencer_registration_submissions
  where id = p_submission_id
  for update;

  if v_submission.id is null then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if v_submission.status not in ('awaiting_match','awaiting_admin_review','identity_correction_required') then
    raise exception 'SUBMISSION_ALREADY_FINALIZED';
  end if;

  v_payload := v_submission.payload;
  v_influencer := coalesce(v_payload->'influencer','{}'::jsonb);
  v_social := coalesce(v_payload->'socialAccounts','[]'::jsonb);
  v_mobile := public.normalize_mobile(coalesce(v_influencer->>'mobile', v_submission.normalized_mobile));
  if v_mobile is null or v_mobile !~ '^9665[0-9]{8}$' then raise exception 'INVALID_MOBILE'; end if;
  v_display_mobile := '+' || v_mobile;

  select coalesce(array_agg(value), '{}'::text[]) into v_preferred
  from jsonb_array_elements_text(coalesce(v_influencer->'preferredAdCategories','[]'::jsonb));
  select coalesce(array_agg(value), '{}'::text[]) into v_content
  from jsonb_array_elements_text(coalesce(v_influencer->'contentStylePreference','[]'::jsonb));
  select coalesce(array_agg(value), '{}'::text[]) into v_shooting
  from jsonb_array_elements_text(coalesce(v_influencer->'shootingStylePreferences','[]'::jsonb));

  if p_existing_influencer_id is not null then
    select id, (user_id is not null) into v_influencer_id, v_target_has_user
    from public.influencers
    where id = p_existing_influencer_id
    for update;
    if v_influencer_id is null then raise exception 'MATCH_TARGET_NOT_FOUND'; end if;

    -- Missing-only merge. Existing archive values always win.
    update public.influencers i set
      full_name = case when nullif(trim(i.full_name),'') is null or i.full_name = i.mobile_e164 then coalesce(nullif(trim(v_influencer->>'fullName'),''), i.full_name) else i.full_name end,
      email = coalesce(nullif(trim(i.email),''), nullif(lower(trim(v_influencer->>'email')),'')),
      city = coalesce(nullif(trim(i.city),''), nullif(trim(v_influencer->>'city'),'')),
      country = coalesce(nullif(trim(i.country),''), nullif(trim(v_influencer->>'country'),''), 'Saudi Arabia'),
      gender = coalesce(nullif(trim(i.gender),''), nullif(trim(v_influencer->>'gender'),'')),
      mawthooq_status = coalesce(i.mawthooq_status, case when v_influencer->>'hasMawthooq'='yes' then true when v_influencer->>'hasMawthooq'='no' then false else null end),
      preferred_ad_categories = (select coalesce(array_agg(distinct x), '{}'::text[]) from unnest(coalesce(i.preferred_ad_categories,'{}'::text[]) || v_preferred) x where nullif(trim(x),'') is not null),
      content_style_preferences = (select coalesce(array_agg(distinct x), '{}'::text[]) from unnest(coalesce(i.content_style_preferences,'{}'::text[]) || v_content) x where nullif(trim(x),'') is not null),
      shooting_style_preferences = (select coalesce(array_agg(distinct x), '{}'::text[]) from unnest(coalesce(i.shooting_style_preferences,'{}'::text[]) || v_shooting) x where nullif(trim(x),'') is not null),
      birth_year = coalesce(i.birth_year, nullif(v_influencer->>'birthYear','')::smallint),
      archive_match_status = 'matched',
      updated_at = v_now
    where i.id = v_influencer_id;
  else
    select exists(
      select 1 from public.influencers i where i.normalized_mobile = v_mobile
    ) into v_has_exact_mobile_conflict;
    if v_has_exact_mobile_conflict then
      update public.influencer_registration_submissions
      set status='identity_correction_required', updated_at=v_now
      where id=p_submission_id;
      raise exception 'MOBILE_CONFLICT_REQUIRES_MATCH';
    end if;

    insert into public.influencers(
      full_name,mobile_e164,normalized_mobile,email,city,country,gender,birth_year,mawthooq_status,
      preferred_ad_categories,content_style_preferences,shooting_style_preferences,
      source,registration_source,account_status,archive_match_status,directory_status,updated_at
    ) values (
      coalesce(nullif(trim(v_influencer->>'fullName'),''),v_display_mobile),
      v_display_mobile,v_mobile,nullif(lower(trim(v_influencer->>'email')),''),
      nullif(trim(v_influencer->>'city'),''),coalesce(nullif(trim(v_influencer->>'country'),''),'Saudi Arabia'),
      nullif(trim(v_influencer->>'gender'),''),nullif(v_influencer->>'birthYear','')::smallint,
      case when v_influencer->>'hasMawthooq'='yes' then true when v_influencer->>'hasMawthooq'='no' then false else null end,
      v_preferred,v_content,v_shooting,
      'public_profile_form','self_registration','pending_review','not_found','activation_pending',v_now
    ) returning id into v_influencer_id;
  end if;

  -- Missing-only finance merge.
  insert into public.influencer_financial_profiles(
    influencer_id,national_id,bank_name,iban,account_holder_name,mawthooq_number,mawthooq_expiry_date
  ) values (
    v_influencer_id,
    nullif(trim(v_influencer->>'nationalId'),''),
    nullif(trim(v_influencer->>'bankName'),''),
    nullif(upper(regexp_replace(coalesce(v_influencer->>'iban',''),'[[:space:]-]','','g')),''),
    nullif(trim(v_influencer->>'accountHolderName'),''),
    nullif(trim(v_influencer->>'mawthooqNumber'),''),
    nullif(v_influencer->>'mawthooqExpiryDate','')::date
  ) on conflict(influencer_id) do update set
    national_id = coalesce(public.influencer_financial_profiles.national_id, excluded.national_id),
    bank_name = coalesce(public.influencer_financial_profiles.bank_name, excluded.bank_name),
    iban = coalesce(public.influencer_financial_profiles.iban, excluded.iban),
    account_holder_name = coalesce(public.influencer_financial_profiles.account_holder_name, excluded.account_holder_name),
    mawthooq_number = coalesce(public.influencer_financial_profiles.mawthooq_number, excluded.mawthooq_number),
    mawthooq_expiry_date = coalesce(public.influencer_financial_profiles.mawthooq_expiry_date, excluded.mawthooq_expiry_date),
    updated_at = v_now;

  -- Add missing social accounts. Existing rows are never deleted or overwritten.
  for v_item in select value from jsonb_array_elements(v_social)
  loop
    v_platform := case lower(coalesce(v_item->>'platform','other'))
      when 'instagram' then 'instagram'::public.platform_type
      when 'tiktok' then 'tiktok'::public.platform_type
      when 'snapchat' then 'snapchat'::public.platform_type
      when 'youtube' then 'youtube'::public.platform_type
      when 'x' then 'x'::public.platform_type
      when 'facebook' then 'facebook'::public.platform_type
      else 'other'::public.platform_type end;
    v_username := public.normalize_social_username(v_item->>'username');
    v_profile_url := nullif(trim(v_item->>'profileUrl'),'');
    if v_username is null and v_profile_url is null then continue; end if;

    select sa.id into v_existing_social_id
    from public.social_accounts sa
    where sa.influencer_id=v_influencer_id and (
      (sa.platform=v_platform and public.normalize_social_username(sa.username)=v_username and v_username is not null)
      or (public.normalize_social_url(sa.profile_url)=public.normalize_social_url(v_profile_url) and v_profile_url is not null)
    ) limit 1;

    if v_existing_social_id is null then
      insert into public.social_accounts(
        influencer_id,platform,platform_label,username,profile_url,followers_count,average_likes,average_views,average_comments,
        engagement_rate,female_audience,male_audience,audience_main_city,audience_main_country,last_checked_at
      ) values (
        v_influencer_id,v_platform,nullif(trim(v_item->>'otherPlatformName'),''),coalesce(v_username,'profile'),v_profile_url,
        nullif(regexp_replace(coalesce(v_item->>'followersCount',''),'[^0-9.]','','g'),'')::bigint,
        nullif(regexp_replace(coalesce(v_item->>'averageLikes',''),'[^0-9.]','','g'),'')::numeric,
        nullif(regexp_replace(coalesce(v_item->>'averageViews',''),'[^0-9.]','','g'),'')::numeric,
        nullif(regexp_replace(coalesce(v_item->>'averageComments',''),'[^0-9.]','','g'),'')::numeric,
        nullif(regexp_replace(coalesce(v_item->>'engagementRate',''),'[^0-9.]','','g'),'')::numeric,
        nullif(regexp_replace(coalesce(v_item->>'femaleAudience',''),'[^0-9.]','','g'),'')::numeric,
        nullif(regexp_replace(coalesce(v_item->>'maleAudience',''),'[^0-9.]','','g'),'')::numeric,
        nullif(trim(v_item->>'audienceMainCity'),''),nullif(trim(v_item->>'audienceMainCountry'),''),v_now
      );
    else
      update public.social_accounts sa set
        profile_url=coalesce(nullif(trim(sa.profile_url),''),v_profile_url),
        followers_count=coalesce(sa.followers_count,nullif(regexp_replace(coalesce(v_item->>'followersCount',''),'[^0-9.]','','g'),'')::bigint),
        average_likes=coalesce(sa.average_likes,nullif(regexp_replace(coalesce(v_item->>'averageLikes',''),'[^0-9.]','','g'),'')::numeric),
        average_views=coalesce(sa.average_views,nullif(regexp_replace(coalesce(v_item->>'averageViews',''),'[^0-9.]','','g'),'')::numeric),
        average_comments=coalesce(sa.average_comments,nullif(regexp_replace(coalesce(v_item->>'averageComments',''),'[^0-9.]','','g'),'')::numeric),
        engagement_rate=coalesce(sa.engagement_rate,nullif(regexp_replace(coalesce(v_item->>'engagementRate',''),'[^0-9.]','','g'),'')::numeric),
        female_audience=coalesce(sa.female_audience,nullif(regexp_replace(coalesce(v_item->>'femaleAudience',''),'[^0-9.]','','g'),'')::numeric),
        male_audience=coalesce(sa.male_audience,nullif(regexp_replace(coalesce(v_item->>'maleAudience',''),'[^0-9.]','','g'),'')::numeric),
        audience_main_city=coalesce(sa.audience_main_city,nullif(trim(v_item->>'audienceMainCity'),'')),
        audience_main_country=coalesce(sa.audience_main_country,nullif(trim(v_item->>'audienceMainCountry'),'')),
        updated_at=v_now
      where sa.id=v_existing_social_id;
    end if;
  end loop;

  insert into public.influencer_legal_consents(influencer_id,document_type,document_version,locale,accepted_at,source)
  values
    (v_influencer_id,'terms',v_submission.terms_version,v_submission.consent_locale,v_submission.consent_accepted_at,'public_registration'),
    (v_influencer_id,'privacy',v_submission.privacy_version,v_submission.consent_locale,v_submission.consent_accepted_at,'public_registration')
  on conflict(influencer_id,document_type,document_version) do nothing;

  if not v_target_has_user then
    select id into v_request_id from public.portal_access_requests
    where influencer_id=v_influencer_id and status in ('submitted','under_review','needs_changes','approved')
    order by created_at desc limit 1;

    if v_request_id is null then
      insert into public.portal_access_requests(
        influencer_id,requested_email,normalized_mobile,request_reason,priority,status,submitted_at,registration_submission_id
      ) values (
        v_influencer_id,v_submission.requested_email,v_submission.normalized_mobile,'self_service','normal','submitted',v_now,p_submission_id
      ) returning id into v_request_id;
    end if;

    -- A confirmed archive match has now entered the portal activation review.
    -- Preserve managed/suspended decisions, but move a normal archived profile
    -- to activation_pending through the existing directory-status sync trigger.
    update public.influencers set
      account_status = case
        when user_id is null and directory_status = 'archived' then 'pending_review'
        else account_status
      end,
      portal_access_required = case
        when user_id is null and directory_status <> 'suspended' then true
        else portal_access_required
      end,
      portal_access_requested_at = case
        when user_id is null and directory_status <> 'suspended' then coalesce(portal_access_requested_at,v_now)
        else portal_access_requested_at
      end,
      updated_at=v_now
    where id=v_influencer_id;
  end if;

  update public.influencer_registration_submissions set
    status=case when p_existing_influencer_id is null then 'new_profile_created' else 'matched_existing' end,
    canonical_influencer_id=v_influencer_id,
    matched_influencer_id=p_existing_influencer_id,
    reviewed_by=case when p_existing_influencer_id is null and v_auth_role='service_role' then reviewed_by else coalesce(v_actor,reviewed_by) end,
    reviewed_at=case when p_existing_influencer_id is null and v_auth_role='service_role' then reviewed_at else v_now end,
    updated_at=v_now
  where id=p_submission_id;

  if p_existing_influencer_id is not null then
    update public.influencer_match_candidates
      set decision=case when influencer_id=p_existing_influencer_id then 'selected' else 'rejected' end
    where submission_id=p_submission_id;
  end if;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(v_actor,'influencer',v_influencer_id,
    case when p_existing_influencer_id is null then 'registration_created_new_profile' else 'registration_matched_archive_profile' end,
    jsonb_build_object('submission_id',p_submission_id,'matched_influencer_id',p_existing_influencer_id,'missing_only_merge',true));

  return v_influencer_id;
end;
$$;

revoke all on function public.apply_registration_submission(uuid,uuid) from public, anon;
grant execute on function public.apply_registration_submission(uuid,uuid) to authenticated, service_role;

alter table public.influencer_registration_submissions enable row level security;
alter table public.influencer_match_candidates enable row level security;

drop policy if exists registration_submissions_admin_select on public.influencer_registration_submissions;
create policy registration_submissions_admin_select on public.influencer_registration_submissions
for select to authenticated using ((select private.current_user_role())='admin');

drop policy if exists match_candidates_admin_select on public.influencer_match_candidates;
create policy match_candidates_admin_select on public.influencer_match_candidates
for select to authenticated using ((select private.current_user_role())='admin');

revoke insert,update,delete on public.influencer_registration_submissions from anon, authenticated;
revoke insert,update,delete on public.influencer_match_candidates from anon, authenticated;

grant select on public.influencer_registration_submissions to authenticated;
grant select on public.influencer_match_candidates to authenticated;


create or replace function public.import_influencer_work_history(
  p_file_name text,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_row jsonb;
  v_influencer_id uuid;
  v_brand_id uuid;
  v_brand_name text;
  v_campaign_name text;
  v_mobile text;
  v_mobile_display text;
  v_name text;
  v_email text;
  v_city text;
  v_bio text;
  v_category text;
  v_social_username text;
  v_social_url text;
  v_social_followers bigint;
  v_date date;
  v_platform text;
  v_platform_enum public.platform_type;
  v_url text;
  v_key text;
  v_existing_id uuid;
  v_inserted integer := 0;
  v_merged integer := 0;
  v_profiles_created integer := 0;
  v_unmatched integer := 0;
  v_invalid integer := 0;
  v_total integer := 0;
  v_row_number integer;
  v_amount numeric;
  v_views bigint;
  v_likes bigint;
  v_comments bigint;
  v_shares bigint;
  v_engagement numeric;
  v_brand_norm text;
  v_archive_year smallint;
  v_archive_month smallint;
begin
  if private.current_user_role() not in ('admin','coordinator') then raise exception 'NOT_AUTHORIZED'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'INVALID_ROWS'; end if;

  insert into public.work_history_import_batches(file_name,total_rows,status,imported_by)
  values(coalesce(nullif(trim(p_file_name),''),'archive.xlsx'),jsonb_array_length(p_rows),'processing',auth.uid())
  returning id into v_batch_id;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_total := v_total + 1;
    begin v_row_number := nullif(v_row->>'row_number','')::integer; exception when others then v_row_number := v_total + 1; end;
    v_mobile := public.normalize_mobile(coalesce(v_row->>'mobile',''));
    v_campaign_name := nullif(trim(coalesce(v_row->>'campaign_name','')), '');

    if v_mobile is null or v_mobile='' or v_campaign_name is null then
      v_invalid := v_invalid + 1;
      insert into public.work_history_import_issues(batch_id,row_number,mobile,campaign_name,issue_type,message,payload)
      values(v_batch_id,v_row_number,v_row->>'mobile',v_campaign_name,'invalid_row','Missing influencer mobile or campaign name.',v_row);
      continue;
    end if;

    v_mobile_display := case when v_mobile ~ '^966[0-9]+$' then '+' || v_mobile else v_mobile end;
    v_name := nullif(trim(coalesce(v_row->>'influencer_name','')), '');
    v_email := nullif(lower(trim(coalesce(v_row->>'influencer_email',''))), '');
    v_city := nullif(trim(coalesce(v_row->>'city','')), '');
    v_bio := nullif(trim(coalesce(v_row->>'bio','')), '');
    v_category := nullif(trim(coalesce(v_row->>'category','')), '');
    v_social_username := nullif(trim(coalesce(v_row->>'social_username','')), '');
    v_social_url := nullif(trim(coalesce(v_row->>'social_profile_url','')), '');
    begin v_social_followers := nullif(v_row->>'followers_count','')::bigint; exception when others then v_social_followers := null; end;

    select id into v_influencer_id from public.influencers where normalized_mobile=v_mobile limit 1;
    if v_influencer_id is null then
      insert into public.influencers(
        full_name,mobile_e164,normalized_mobile,email,city,country,profile_bio,primary_category,
        preferred_ad_categories,source,registration_source,account_status,archive_match_status,
        directory_status,archive_created_at,created_by,updated_at
      ) values (
        coalesce(v_name,v_social_username,v_mobile_display),v_mobile_display,v_mobile,v_email,v_city,'Saudi Arabia',v_bio,v_category,
        case when v_category is null then '{}'::text[] else array[v_category] end,
        'legacy_archive','archive_import','unclaimed','archive_created','archived',now(),auth.uid(),now()
      ) returning id into v_influencer_id;
      v_profiles_created := v_profiles_created + 1;
    else
      update public.influencers set
        full_name=case when (full_name is null or trim(full_name)='' or full_name=mobile_e164) and v_name is not null then v_name else full_name end,
        email=coalesce(email,v_email), city=coalesce(city,v_city), profile_bio=coalesce(profile_bio,v_bio),
        primary_category=coalesce(primary_category,v_category),
        preferred_ad_categories=case when v_category is not null and not (v_category=any(preferred_ad_categories)) then array_append(preferred_ad_categories,v_category) else preferred_ad_categories end,
        archive_created_at=coalesce(archive_created_at,case when directory_status='archived' then now() else archive_created_at end),
        updated_at=now()
      where id=v_influencer_id;
    end if;

    v_platform := lower(nullif(trim(coalesce(v_row->>'platform','')), ''));
    if v_platform in ('instagram','tiktok','snapchat','youtube','x','facebook','other') then
      v_platform_enum := v_platform::public.platform_type;
      if v_social_username is not null then
        insert into public.social_accounts(influencer_id,platform,username,profile_url,followers_count,last_checked_at)
        values(v_influencer_id,v_platform_enum,v_social_username,v_social_url,v_social_followers,now())
        on conflict (influencer_id,platform,username) do update set
          profile_url=coalesce(public.social_accounts.profile_url,excluded.profile_url),
          followers_count=coalesce(public.social_accounts.followers_count,excluded.followers_count),
          last_checked_at=now(), updated_at=now();
      end if;
    end if;

    v_brand_name := nullif(trim(coalesce(v_row->>'brand_name','')), '');
    v_brand_id := null;
    if v_brand_name is not null then
      v_brand_norm := lower(regexp_replace(v_brand_name,'[^[:alnum:]ء-ي]+','','g'));
      select b.id into v_brand_id
      from public.brands b
      where lower(regexp_replace(coalesce(b.name_ar,''),'[^[:alnum:]ء-ي]+','','g'))=v_brand_norm
         or lower(regexp_replace(coalesce(b.name_en,''),'[^[:alnum:]ء-ي]+','','g'))=v_brand_norm
      limit 1;
      if v_brand_id is not null then
        select coalesce(nullif(trim(name_en),''),nullif(trim(name_ar),'')) into v_brand_name from public.brands where id=v_brand_id;
      end if;
    end if;

    begin v_date := nullif(v_row->>'collaboration_date','')::date; exception when others then v_date := null; end;
    begin v_archive_year := nullif(v_row->>'archive_year','')::smallint; exception when others then v_archive_year := null; end;
    begin v_archive_month := nullif(v_row->>'archive_month','')::smallint; exception when others then v_archive_month := null; end;
    if v_archive_year is null and v_date is not null then v_archive_year := extract(year from v_date)::smallint; end if;
    if v_archive_month is null and v_date is not null then v_archive_month := extract(month from v_date)::smallint; end if;
    v_url := nullif(trim(coalesce(v_row->>'content_url','')), '');
    begin v_amount := nullif(v_row->>'compensation_amount','')::numeric; exception when others then v_amount := null; end;
    begin v_views := nullif(v_row->>'views','')::bigint; exception when others then v_views := null; end;
    begin v_likes := nullif(v_row->>'likes','')::bigint; exception when others then v_likes := null; end;
    begin v_comments := nullif(v_row->>'comments','')::bigint; exception when others then v_comments := null; end;
    begin v_shares := nullif(v_row->>'shares','')::bigint; exception when others then v_shares := null; end;
    begin v_engagement := nullif(v_row->>'engagement_rate','')::numeric; exception when others then v_engagement := null; end;

    v_key := public.work_history_dedupe_key(v_influencer_id,v_campaign_name,v_brand_name,v_date,v_platform,v_url);
    select id into v_existing_id from public.influencer_work_history where dedupe_key=v_key limit 1;

    if v_existing_id is null then
      insert into public.influencer_work_history(
        influencer_id,brand_id,brand_name,campaign_name,collaboration_type,collaboration_status,collaboration_date,
        platform,content_type,content_url,compensation_amount,compensation_currency,views,likes,comments,shares,
        engagement_rate,outcome,performance_note,internal_notes,archive_year,archive_month,source,source_record_id,source_meta,created_by,updated_by,dedupe_key
      ) values (
        v_influencer_id,v_brand_id,v_brand_name,v_campaign_name,
        coalesce(nullif(v_row->>'collaboration_type',''),'other'),coalesce(nullif(v_row->>'collaboration_status',''),'completed'),v_date,
        v_platform,nullif(trim(coalesce(v_row->>'content_type','')),''),v_url,v_amount,
        coalesce(nullif(upper(trim(coalesce(v_row->>'compensation_currency',''))),''),'SAR'),v_views,v_likes,v_comments,v_shares,
        v_engagement,coalesce(nullif(v_row->>'outcome',''),'unknown'),nullif(trim(coalesce(v_row->>'performance_note','')),''),
        nullif(trim(coalesce(v_row->>'internal_notes','')),''),v_archive_year,v_archive_month,'legacy_import',nullif(v_row->>'source_record_id',''),
        jsonb_build_object('batch_id',v_batch_id,'file_name',p_file_name,'row_number',v_row_number,'archive_year',v_archive_year,'archive_month',v_archive_month),auth.uid(),auth.uid(),v_key
      );
      v_inserted := v_inserted + 1;
    else
      update public.influencer_work_history set
        brand_id=coalesce(brand_id,v_brand_id), brand_name=coalesce(brand_name,v_brand_name),
        compensation_amount=coalesce(compensation_amount,v_amount),
        views=coalesce(views,v_views), likes=coalesce(likes,v_likes), comments=coalesce(comments,v_comments), shares=coalesce(shares,v_shares),
        engagement_rate=coalesce(engagement_rate,v_engagement), content_type=coalesce(content_type,nullif(trim(coalesce(v_row->>'content_type','')),'')),
        performance_note=coalesce(performance_note,nullif(trim(coalesce(v_row->>'performance_note','')),'')),
        internal_notes=coalesce(internal_notes,nullif(trim(coalesce(v_row->>'internal_notes','')),'')),
        archive_year=coalesce(archive_year,v_archive_year), archive_month=coalesce(archive_month,v_archive_month), updated_by=auth.uid()
      where id=v_existing_id;
      v_merged := v_merged + 1;
    end if;
  end loop;

  update public.work_history_import_batches set
    total_rows=v_total, inserted_count=v_inserted, merged_count=v_merged,
    profiles_created_count=v_profiles_created, unmatched_count=v_unmatched, invalid_count=v_invalid,
    status='completed', completed_at=now()
  where id=v_batch_id;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'work_history_import',v_batch_id,'work_history_import_completed',
    jsonb_build_object('file_name',p_file_name,'rows',v_total,'inserted',v_inserted,'merged',v_merged,
      'profiles_created',v_profiles_created,'unmatched',v_unmatched,'invalid',v_invalid));
  return v_batch_id;
exception when others then
  if v_batch_id is not null then
    update public.work_history_import_batches set status='failed', completed_at=now() where id=v_batch_id;
  end if;
  raise;
end;
$$;


revoke all on function public.import_influencer_work_history(text,jsonb) from public, anon;
grant execute on function public.import_influencer_work_history(text,jsonb) to authenticated;

create or replace function public.find_influencer_match_candidates(
  p_mobile text,
  p_full_name text,
  p_social jsonb
)
returns table(
  influencer_id uuid,
  score integer,
  mobile_match boolean,
  social_username_match boolean,
  profile_url_match boolean,
  name_support_match boolean,
  reasons jsonb
)
language sql
security definer
set search_path = ''
as $$
  with input as (
    select
      public.normalize_mobile(p_mobile) as mobile,
      lower(regexp_replace(trim(coalesce(p_full_name,'')), '[[:space:]]+', ' ', 'g')) as full_name,
      coalesce(p_social,'[]'::jsonb) as social
  ), candidates as (
    select
      i.id,
      (i.normalized_mobile = input.mobile and input.mobile is not null) as m_mobile,
      exists (
        select 1
        from public.social_accounts sa
        join lateral jsonb_array_elements(input.social) x(value) on true
        where sa.influencer_id=i.id
          and lower(sa.platform::text)=lower(coalesce(x.value->>'platform',''))
          and public.normalize_social_username(sa.username)=public.normalize_social_username(x.value->>'username')
          and public.normalize_social_username(x.value->>'username') is not null
      ) as m_username,
      exists (
        select 1
        from public.social_accounts sa
        join lateral jsonb_array_elements(input.social) x(value) on true
        where sa.influencer_id=i.id
          and public.normalize_social_url(sa.profile_url)=public.normalize_social_url(x.value->>'profileUrl')
          and public.normalize_social_url(x.value->>'profileUrl') is not null
      ) as m_url,
      lower(regexp_replace(trim(coalesce(i.full_name,'')), '[[:space:]]+', ' ', 'g')) = input.full_name
        and input.full_name <> '' as m_name
    from public.influencers i cross join input
  )
  select
    c.id,
    ((case when c.m_mobile then 100 else 0 end)
      + (case when c.m_username then 70 else 0 end)
      + (case when c.m_url then 80 else 0 end)
      + (case when c.m_name then 10 else 0 end))::integer as score,
    c.m_mobile,
    c.m_username,
    c.m_url,
    c.m_name,
    to_jsonb(array_remove(array[
      case when c.m_mobile then 'mobile' end,
      case when c.m_username then 'social_username' end,
      case when c.m_url then 'profile_url' end,
      case when c.m_name then 'full_name_support' end
    ],null)) as reasons
  from candidates c
  where c.m_mobile or c.m_username or c.m_url
  order by score desc, c.id;
$$;

revoke all on function public.find_influencer_match_candidates(text,text,jsonb) from public, anon, authenticated;
grant execute on function public.find_influencer_match_candidates(text,text,jsonb) to service_role;

commit;
notify pgrst, 'reload schema';
