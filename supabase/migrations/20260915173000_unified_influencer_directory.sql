-- Phase 07.1: unified influencer directory.
-- Archived, activation-pending, active, managed/VIP, and suspended creators
-- live in public.influencers as one canonical record. Work history remains linked
-- by influencer_id. New campaign assignments require an active or managed record.

begin;

alter table public.influencers
  add column if not exists directory_status text,
  add column if not exists profile_bio text,
  add column if not exists primary_category text,
  add column if not exists assigned_coordinator_id uuid references public.profiles(id) on delete set null,
  add column if not exists archive_created_at timestamptz,
  add column if not exists activation_invited_at timestamptz,
  add column if not exists managed_contact_name text,
  add column if not exists managed_contact_mobile text,
  add column if not exists managed_contact_email text,
  add column if not exists directory_notes text;

update public.influencers i
set directory_status = case
  when i.account_status = 'suspended' then 'suspended'
  when i.user_id is not null and i.account_status = 'active' then 'active'
  when i.user_id is not null then 'active'
  when exists (
    select 1 from public.portal_access_requests r
    where r.influencer_id=i.id
      and r.status in ('submitted','under_review','needs_changes','approved')
  ) or i.account_status in ('pending_review','invited') then 'activation_pending'
  else 'archived'
end
where i.directory_status is null;

alter table public.influencers
  alter column directory_status set default 'archived',
  alter column directory_status set not null;

alter table public.influencers
  drop constraint if exists influencers_directory_status_check;

alter table public.influencers
  add constraint influencers_directory_status_check
  check (directory_status in ('archived','activation_pending','active','managed','suspended'));

create index if not exists influencers_directory_status_idx
  on public.influencers(directory_status, updated_at desc);

create index if not exists influencers_assigned_coordinator_idx
  on public.influencers(assigned_coordinator_id, directory_status);

create index if not exists influencers_primary_category_idx
  on public.influencers(primary_category)
  where primary_category is not null;

-- Keep directory status aligned with account activation without overwriting
-- deliberate VIP/managed and suspended choices.
create or replace function public.sync_influencer_directory_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.account_status = 'suspended' then
    new.directory_status := 'suspended';
  elsif new.directory_status = 'managed' then
    new.directory_status := 'managed';
  elsif new.user_id is not null and new.account_status = 'active' then
    new.directory_status := 'active';
  elsif tg_op = 'UPDATE' and old.directory_status = 'managed' and new.user_id is null then
    new.directory_status := 'managed';
  elsif tg_op = 'UPDATE' and old.directory_status = 'suspended' and new.user_id is null and new.account_status = old.account_status then
    new.directory_status := 'suspended';
  elsif new.user_id is null and new.account_status in ('pending_review','invited') then
    new.directory_status := 'activation_pending';
  elsif new.user_id is null and new.directory_status not in ('managed','suspended') then
    new.directory_status := 'archived';
  elsif new.user_id is not null then
    new.directory_status := 'active';
  end if;
  return new;
end;
$$;

revoke all on function public.sync_influencer_directory_status() from public, anon, authenticated;

drop trigger if exists influencers_sync_directory_status on public.influencers;

create trigger influencers_sync_directory_status
before insert or update of user_id, account_status
on public.influencers
for each row execute function public.sync_influencer_directory_status();

-- Archive activation is a trusted staff-initiated portal invitation. It bypasses
-- the public application review but still uses the existing one-time token flow.
alter table public.portal_access_requests
  drop constraint if exists portal_access_requests_request_reason_check;

alter table public.portal_access_requests
  add constraint portal_access_requests_request_reason_check
  check (request_reason in ('self_service','campaign_access','payment_required','archive_activation'));

create or replace function public.prepare_archived_influencer_activation(
  p_influencer_id uuid,
  p_requested_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_id uuid;
  v_mobile text;
  v_email text := lower(trim(coalesce(p_requested_email,'')));
  v_role text := private.current_user_role()::text;
begin
  if v_role not in ('admin','coordinator') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if v_email = '' or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'VALID_EMAIL_REQUIRED';
  end if;

  select normalized_mobile into v_mobile
  from public.influencers
  where id=p_influencer_id and user_id is null
  for update;

  if v_mobile is null then
    raise exception 'INFLUENCER_NOT_FOUND_OR_ALREADY_ACTIVE';
  end if;

  select id into v_request_id
  from public.portal_access_requests
  where influencer_id=p_influencer_id
    and status in ('submitted','under_review','needs_changes','approved')
  order by created_at desc
  limit 1
  for update;

  if v_request_id is null then
    insert into public.portal_access_requests(
      influencer_id,requested_email,normalized_mobile,request_reason,status,priority,
      reviewed_by,reviewed_at,review_notes,submitted_at,created_at,updated_at
    ) values (
      p_influencer_id,v_email,v_mobile,'archive_activation','approved','normal',
      auth.uid(),now(),'Archive profile activation invitation.',now(),now(),now()
    ) returning id into v_request_id;
  else
    update public.portal_access_requests set
      requested_email=v_email,
      normalized_mobile=v_mobile,
      request_reason='archive_activation',
      status='approved',
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      review_notes='Archive profile activation invitation.',
      updated_at=now()
    where id=v_request_id;
  end if;

  update public.influencers set
    email=v_email,
    account_status='pending_review',
    directory_status='activation_pending',
    portal_access_required=true,
    portal_access_requested_at=coalesce(portal_access_requested_at,now()),
    activation_invited_at=now(),
    updated_at=now()
  where id=p_influencer_id;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'influencer',p_influencer_id,'archive_activation_prepared',
    jsonb_build_object('request_id',v_request_id,'requested_email',v_email));

  return v_request_id;
end;
$$;

revoke all on function public.prepare_archived_influencer_activation(uuid,text) from public, anon;

grant execute on function public.prepare_archived_influencer_activation(uuid,text) to authenticated;

create or replace function public.set_influencer_management_mode(
  p_influencer_id uuid,
  p_status text,
  p_reason text,
  p_contact_name text default null,
  p_contact_mobile text default null,
  p_contact_email text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_old_status text;
begin
  if private.current_user_role() <> 'admin' then raise exception 'NOT_AUTHORIZED'; end if;
  if p_status not in ('archived','managed','suspended','active') then raise exception 'INVALID_DIRECTORY_STATUS'; end if;
  if p_status in ('managed','suspended') and nullif(trim(coalesce(p_reason,'')),'') is null then
    raise exception 'REASON_REQUIRED';
  end if;

  select user_id,directory_status into v_user_id,v_old_status
  from public.influencers where id=p_influencer_id for update;
  if not found then raise exception 'INFLUENCER_NOT_FOUND'; end if;
  if p_status='archived' and v_user_id is not null then raise exception 'ACTIVE_ACCOUNT_CANNOT_BE_ARCHIVED'; end if;
  if p_status='active' and v_user_id is null then raise exception 'PORTAL_ACCOUNT_REQUIRED'; end if;

  update public.influencers set
    directory_status=p_status,
    account_status=case
      when p_status='suspended' then 'suspended'
      when p_status='active' then 'active'
      when p_status='archived' then 'unclaimed'
      else account_status
    end,
    managed_contact_name=case when p_status='managed' then nullif(trim(coalesce(p_contact_name,'')),'') else managed_contact_name end,
    managed_contact_mobile=case when p_status='managed' then nullif(trim(coalesce(p_contact_mobile,'')),'') else managed_contact_mobile end,
    managed_contact_email=case when p_status='managed' then nullif(lower(trim(coalesce(p_contact_email,''))),'') else managed_contact_email end,
    directory_notes=nullif(trim(coalesce(p_reason,'')),''),
    updated_at=now()
  where id=p_influencer_id;

  if v_user_id is not null and p_status in ('suspended','active') then
    update public.profiles
    set is_active=(p_status='active'), updated_at=now()
    where id=v_user_id;
  end if;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'influencer',p_influencer_id,'influencer_directory_status_changed',
    jsonb_build_object('from_status',v_old_status,'status',p_status,'reason',p_reason));
end;
$$;

revoke all on function public.set_influencer_management_mode(uuid,text,text,text,text,text) from public, anon;

grant execute on function public.set_influencer_management_mode(uuid,text,text,text,text,text) to authenticated;

create or replace function public.assign_influencer_coordinator(
  p_influencer_id uuid,
  p_coordinator_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.current_user_role() <> 'admin' then raise exception 'NOT_AUTHORIZED'; end if;
  if p_coordinator_id is not null and not exists(
    select 1 from public.profiles where id=p_coordinator_id and role in ('admin','coordinator') and is_active=true
  ) then raise exception 'INVALID_COORDINATOR'; end if;

  update public.influencers set assigned_coordinator_id=p_coordinator_id, updated_at=now()
  where id=p_influencer_id;
  if not found then raise exception 'INFLUENCER_NOT_FOUND'; end if;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'influencer',p_influencer_id,'influencer_coordinator_assigned',
    jsonb_build_object('coordinator_id',p_coordinator_id));
end;
$$;

revoke all on function public.assign_influencer_coordinator(uuid,uuid) from public, anon;

grant execute on function public.assign_influencer_coordinator(uuid,uuid) to authenticated;

-- Campaign assignment gate: archived and activation-pending profiles must first
-- activate their portal. Managed/VIP profiles are the explicit exception.
create or replace function public.ensure_influencer_assignable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  select directory_status into v_status from public.influencers where id=new.influencer_id;
  if v_status is null then raise exception 'INFLUENCER_NOT_FOUND'; end if;
  if v_status not in ('active','managed') then
    raise exception 'INFLUENCER_ACTIVATION_REQUIRED';
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_influencer_assignable() from public, anon, authenticated;

drop trigger if exists campaign_assignments_require_activated_influencer on public.campaign_assignments;

create trigger campaign_assignments_require_activated_influencer
before insert or update of influencer_id
on public.campaign_assignments
for each row execute function public.ensure_influencer_assignable();

-- Import batches now report how many canonical archived profiles were created.
alter table public.work_history_import_batches
  add column if not exists profiles_created_count integer not null default 0;

-- Unified archive importer: match a canonical influencer by normalized mobile;
-- if none exists, create exactly one archived influencer profile, then attach all
-- collaboration rows to that same influencer. Re-imports merge rather than duplicate.
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
          profile_url=coalesce(excluded.profile_url,public.social_accounts.profile_url),
          followers_count=coalesce(excluded.followers_count,public.social_accounts.followers_count),
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
        engagement_rate,outcome,performance_note,internal_notes,source,source_record_id,source_meta,created_by,updated_by,dedupe_key
      ) values (
        v_influencer_id,v_brand_id,v_brand_name,v_campaign_name,
        coalesce(nullif(v_row->>'collaboration_type',''),'other'),coalesce(nullif(v_row->>'collaboration_status',''),'completed'),v_date,
        v_platform,nullif(trim(coalesce(v_row->>'content_type','')),''),v_url,v_amount,
        coalesce(nullif(upper(trim(coalesce(v_row->>'compensation_currency',''))),''),'SAR'),v_views,v_likes,v_comments,v_shares,
        v_engagement,coalesce(nullif(v_row->>'outcome',''),'unknown'),nullif(trim(coalesce(v_row->>'performance_note','')),''),
        nullif(trim(coalesce(v_row->>'internal_notes','')),''),'legacy_import',nullif(v_row->>'source_record_id',''),
        jsonb_build_object('batch_id',v_batch_id,'file_name',p_file_name,'row_number',v_row_number),auth.uid(),auth.uid(),v_key
      );
      v_inserted := v_inserted + 1;
    else
      update public.influencer_work_history set
        brand_id=coalesce(brand_id,v_brand_id), brand_name=coalesce(brand_name,v_brand_name),
        compensation_amount=coalesce(compensation_amount,v_amount),
        views=coalesce(v_views,views), likes=coalesce(v_likes,likes), comments=coalesce(v_comments,comments), shares=coalesce(v_shares,shares),
        engagement_rate=coalesce(v_engagement,engagement_rate), content_type=coalesce(content_type,nullif(trim(coalesce(v_row->>'content_type','')),'')),
        performance_note=coalesce(nullif(trim(coalesce(v_row->>'performance_note','')),''),performance_note),
        internal_notes=coalesce(nullif(trim(coalesce(v_row->>'internal_notes','')),''),internal_notes), updated_by=auth.uid()
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

-- Campaign search uses the same unified directory. Archived/pending/suspended
-- profiles remain searchable for review, but only Active and VIP/Managed can
-- be selected for a new assignment.
create or replace function public.search_campaign_influencers(
  p_campaign_id uuid,
  p_query text,
  p_limit integer default 15
)
returns table (
  influencer_id uuid,
  full_name text,
  mobile_e164 text,
  city text,
  country text,
  profile_completion smallint,
  social_accounts jsonb,
  available boolean,
  availability_reason text,
  blocking_campaign_id uuid,
  blocking_campaign_name text,
  blocking_brand_name text,
  blocked_until timestamptz,
  days_remaining integer
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role public.user_role;
  v_query text:=trim(coalesce(p_query,''));
  v_digits text:=regexp_replace(coalesce(p_query,''),'[^0-9]','','g');
begin
  select p.role into v_role from public.profiles p where p.id=auth.uid() and p.is_active=true;
  if v_role is null or v_role not in ('admin','coordinator','finance') then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists(select 1 from public.campaigns c where c.id=p_campaign_id) then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  if char_length(v_query)<2 and char_length(v_digits)<4 then return; end if;

  return query
  with candidates as (
    select i.*
    from public.influencers i
    where i.full_name ilike '%'||v_query||'%'
      or coalesce(i.profile_bio,'') ilike '%'||v_query||'%'
      or coalesce(i.primary_category,'') ilike '%'||v_query||'%'
      or (char_length(v_digits)>=4 and regexp_replace(i.mobile_e164,'[^0-9]','','g') like '%'||v_digits||'%')
      or exists(select 1 from public.social_accounts sa where sa.influencer_id=i.id and (sa.username ilike '%'||v_query||'%' or coalesce(sa.profile_url,'') ilike '%'||v_query||'%'))
      or exists(select 1 from public.influencer_work_history wh where wh.influencer_id=i.id and (coalesce(wh.brand_name,'') ilike '%'||v_query||'%' or wh.campaign_name ilike '%'||v_query||'%'))
    order by case i.directory_status when 'active' then 0 when 'managed' then 1 when 'activation_pending' then 2 when 'archived' then 3 else 4 end,
             i.profile_completion desc,i.updated_at desc
    limit greatest(1,least(coalesce(p_limit,15),30))
  )
  select
    i.id,i.full_name,i.mobile_e164,i.city,i.country,i.profile_completion,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sa.id,'platform',sa.platform,'username',sa.username,
        'profileUrl',sa.profile_url,'followersCount',sa.followers_count
      ) order by sa.followers_count desc nulls last,sa.created_at)
      from public.social_accounts sa where sa.influencer_id=i.id
    ),'[]'::jsonb),
    case when i.directory_status in ('active','managed') then av.available else false end,
    case when i.directory_status in ('active','managed') then av.reason else 'portal_activation_required' end,
    av.blocking_campaign_id,av.blocking_campaign_name,av.blocking_brand_name,av.blocked_until,av.days_remaining
  from candidates i
  cross join lateral public.influencer_campaign_availability(i.id,p_campaign_id) av;
end;
$$;

revoke all on function public.search_campaign_influencers(uuid,text,integer) from public;

grant execute on function public.search_campaign_influencers(uuid,text,integer) to authenticated;

commit;

notify pgrst, 'reload schema';
