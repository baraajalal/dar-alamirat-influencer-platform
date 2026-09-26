-- Dar Al Amirat beta.7.2.2 — Phase 07 closure hotfix
-- APPLY ONCE in Supabase SQL Editor.
-- This changes function logic only. It does not delete or rewrite archive/work-history rows.

begin;

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

commit;

notify pgrst, 'reload schema';

-- Read-only verification of the intended invariant after a future matched registration:
-- matched archive profile with no portal user should be activation_pending, not archived.
select
  directory_status,
  count(*) as creators
from public.influencers
group by directory_status
order by directory_status;
