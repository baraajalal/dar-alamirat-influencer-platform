-- Dar Al Amirat Influencer Platform
-- Replace email OTP activation with direct account registration from a verified
-- guest assignment. The guest must enter the full mobile number attached to the
-- assignment, an email address, and a password.

begin;

-- Accept Arabic-Indic and Eastern Arabic digits and common Saudi mobile formats.
create or replace function public.normalize_mobile(input_mobile text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  mobile_digits text;
begin
  if input_mobile is null then
    return null;
  end if;

  mobile_digits := translate(
    input_mobile,
    '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    '01234567890123456789'
  );
  mobile_digits := regexp_replace(mobile_digits, '[^0-9]', '', 'g');

  if mobile_digits = '' then
    return null;
  end if;

  if mobile_digits like '00966%' then
    mobile_digits := substring(mobile_digits from 3);
  end if;

  -- Tolerate the common accidental format 96605XXXXXXXX.
  if mobile_digits like '96605%' and length(mobile_digits) = 13 then
    mobile_digits := '966' || substring(mobile_digits from 5);
  end if;

  if mobile_digits like '9665%' and length(mobile_digits) = 12 then
    return mobile_digits;
  end if;

  if mobile_digits like '05%' and length(mobile_digits) = 10 then
    return '966' || substring(mobile_digits from 2);
  end if;

  if mobile_digits like '5%' and length(mobile_digits) = 9 then
    return '966' || mobile_digits;
  end if;

  return mobile_digits;
end;
$$;

alter table public.influencers
  drop constraint if exists influencers_activation_status_check;

alter table public.influencers
  add constraint influencers_activation_status_check
  check (
    activation_status in (
      'guest',
      'activation_pending',
      'email_otp_sent',
      'email_verified',
      'password_setup_required',
      'registration_pending',
      'active',
      'suspended'
    )
  );

create or replace function public.claim_influencer_account_direct(
  p_influencer_id uuid,
  p_assignment_id uuid,
  p_submission_link_id uuid,
  p_user_id uuid,
  p_email text,
  p_mobile_input text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_expected_mobile text;
  v_supplied_mobile text;
  v_full_name text;
  v_current_user_id uuid;
  v_auth_email text;
  v_existing_profile_role public.user_role;
begin
  select
    i.mobile_e164,
    i.full_name,
    i.user_id
  into
    v_expected_mobile,
    v_full_name,
    v_current_user_id
  from public.campaign_assignments ca
  join public.influencers i on i.id = ca.influencer_id
  join public.submission_links sl
    on sl.assignment_id = ca.id
   and sl.id = p_submission_link_id
  where ca.id = p_assignment_id
    and ca.influencer_id = p_influencer_id
    and sl.is_active = true
    and sl.locked_at is null
    and sl.expires_at > v_now
  for update of i;

  if v_full_name is null then
    raise exception 'ASSIGNMENT_LINK_MISMATCH';
  end if;

  v_expected_mobile := public.normalize_mobile(v_expected_mobile);
  v_supplied_mobile := public.normalize_mobile(p_mobile_input);

  if v_expected_mobile is null
     or v_expected_mobile !~ '^9665[0-9]{8}$'
     or v_supplied_mobile is distinct from v_expected_mobile then
    raise exception 'MOBILE_MISMATCH';
  end if;

  if v_current_user_id is not null and v_current_user_id <> p_user_id then
    raise exception 'ACCOUNT_ALREADY_LINKED';
  end if;

  select lower(u.email)
  into v_auth_email
  from auth.users u
  where u.id = p_user_id;

  if v_auth_email is null then
    raise exception 'AUTH_USER_MISSING';
  end if;

  if v_auth_email is distinct from lower(trim(p_email)) then
    raise exception 'EMAIL_MISMATCH';
  end if;

  if exists (
    select 1
    from public.influencers other_i
    where other_i.user_id = p_user_id
      and other_i.id <> p_influencer_id
  ) then
    raise exception 'AUTH_USER_ALREADY_LINKED';
  end if;

  select p.role
  into v_existing_profile_role
  from public.profiles p
  where p.id = p_user_id;

  if v_existing_profile_role is not null
     and v_existing_profile_role <> 'influencer'::public.user_role then
    raise exception 'STAFF_ACCOUNT_CONFLICT';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.mobile_e164 = v_expected_mobile
      and p.id <> p_user_id
  ) then
    raise exception 'MOBILE_ALREADY_USED';
  end if;

  insert into public.profiles (
    id,
    role,
    full_name,
    mobile_e164,
    is_active,
    updated_at
  )
  values (
    p_user_id,
    'influencer'::public.user_role,
    v_full_name,
    v_expected_mobile,
    true,
    v_now
  )
  on conflict (id)
  do update set
    role = 'influencer'::public.user_role,
    full_name = excluded.full_name,
    mobile_e164 = excluded.mobile_e164,
    is_active = true,
    updated_at = v_now;

  update public.influencers
  set
    user_id = p_user_id,
    email = lower(trim(p_email)),
    mobile_e164 = v_expected_mobile,
    normalized_mobile = v_expected_mobile,
    account_status = 'active',
    activation_status = 'active',
    claimed_at = coalesce(claimed_at, v_now),
    email_verified_at = coalesce(email_verified_at, v_now),
    account_activated_at = coalesce(account_activated_at, v_now),
    must_change_password = false,
    portal_access_required = false,
    portal_access_requested_at = coalesce(portal_access_requested_at, v_now),
    last_login_at = v_now,
    updated_at = v_now
  where id = p_influencer_id;

  update public.portal_access_requests
  set
    status = 'completed',
    reviewed_at = coalesce(reviewed_at, v_now),
    review_notes = coalesce(
      review_notes,
      'Completed automatically by direct registration from a verified guest assignment.'
    ),
    updated_at = v_now
  where influencer_id = p_influencer_id
    and status in ('pending', 'approved');

  update public.influencer_account_activations
  set
    status = 'cancelled',
    last_error = coalesce(last_error, 'Replaced by direct guest registration.'),
    updated_at = v_now
  where influencer_id = p_influencer_id
    and status in (
      'activation_pending',
      'otp_sent',
      'email_verified',
      'password_setup_required'
    );

  insert into public.influencer_account_activations (
    influencer_id,
    assignment_id,
    submission_link_id,
    email,
    normalized_email,
    status,
    verified_at,
    password_completed_at,
    auth_user_id,
    last_error
  )
  values (
    p_influencer_id,
    p_assignment_id,
    p_submission_link_id,
    lower(trim(p_email)),
    lower(trim(p_email)),
    'completed',
    v_now,
    v_now,
    p_user_id,
    'Direct registration after full mobile match.'
  );

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
    p_influencer_id,
    'influencer_direct_account_registered',
    jsonb_build_object(
      'assignment_id', p_assignment_id,
      'submission_link_id', p_submission_link_id,
      'registration_method', 'full_mobile_email_password'
    )
  );

  return p_influencer_id;
end;
$$;

revoke all on function public.claim_influencer_account_direct(
  uuid, uuid, uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.claim_influencer_account_direct(
  uuid, uuid, uuid, uuid, text, text
) to service_role;

commit;

notify pgrst, 'reload schema';
