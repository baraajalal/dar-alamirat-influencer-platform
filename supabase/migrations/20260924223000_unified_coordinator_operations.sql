-- Dar Al Amirat Creator Community
-- beta.9.1.1 - Unified coordinator operations
-- Additive/idempotent. Does NOT alter auth.users, staff login, creator login, passwords, or existing sessions.

begin;

-- ---------------------------------------------------------------------------
-- 1) Internal creator restriction state: operational only, never exposed to creator.
-- ---------------------------------------------------------------------------
alter table public.influencers
  add column if not exists restriction_status text not null default 'normal',
  add column if not exists restriction_reason text,
  add column if not exists restriction_expires_at timestamptz,
  add column if not exists restriction_updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists restriction_updated_at timestamptz;

alter table public.influencers
  drop constraint if exists influencers_restriction_status_check;
alter table public.influencers
  add constraint influencers_restriction_status_check
  check (restriction_status in ('normal','watchlist','blacklisted'));

create table if not exists public.influencer_restriction_events (
  id bigint generated always as identity primary key,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  status_before text,
  status_after text not null,
  reason text,
  expires_at timestamptz,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists influencer_restriction_events_influencer_idx
  on public.influencer_restriction_events(influencer_id, created_at desc);

alter table public.influencer_restriction_events enable row level security;
drop policy if exists influencer_restriction_events_staff_select on public.influencer_restriction_events;
create policy influencer_restriction_events_staff_select
on public.influencer_restriction_events
for select to authenticated
using (private.current_user_role() in ('admin','coordinator','reviewer','finance','viewer'));

grant select on public.influencer_restriction_events to authenticated;
revoke insert, update, delete on public.influencer_restriction_events from authenticated;

create or replace function public.set_influencer_restriction(
  p_influencer_id uuid,
  p_status text,
  p_reason text default null,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before text;
  v_reason text := nullif(trim(coalesce(p_reason,'')), '');
begin
  if private.current_user_role() <> 'admin' then raise exception 'NOT_AUTHORIZED'; end if;
  if p_status not in ('normal','watchlist','blacklisted') then raise exception 'INVALID_RESTRICTION_STATUS'; end if;
  if p_status in ('watchlist','blacklisted') and v_reason is null then raise exception 'REASON_REQUIRED'; end if;

  select restriction_status into v_before
  from public.influencers
  where id = p_influencer_id
  for update;
  if not found then raise exception 'INFLUENCER_NOT_FOUND'; end if;

  update public.influencers
  set restriction_status = p_status,
      restriction_reason = case when p_status='normal' then null else v_reason end,
      restriction_expires_at = case when p_status='normal' then null else p_expires_at end,
      restriction_updated_by = auth.uid(),
      restriction_updated_at = now(),
      updated_at = now()
  where id = p_influencer_id;

  insert into public.influencer_restriction_events(
    influencer_id,status_before,status_after,reason,expires_at,changed_by
  ) values (
    p_influencer_id,v_before,p_status,v_reason,p_expires_at,auth.uid()
  );

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'influencer',p_influencer_id,'influencer_restriction_changed',
    jsonb_build_object('from',v_before,'to',p_status,'reason',v_reason,'expires_at',p_expires_at));
end;
$$;

revoke all on function public.set_influencer_restriction(uuid,text,text,timestamptz) from public, anon;
grant execute on function public.set_influencer_restriction(uuid,text,text,timestamptz) to authenticated;

-- Portal access is managed independently from creator directory/restriction state.
create or replace function public.set_influencer_portal_account_state(
  p_influencer_id uuid,
  p_state text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid; v_before text;
begin
  if private.current_user_role() <> 'admin' then raise exception 'NOT_AUTHORIZED'; end if;
  if p_state not in ('active','suspended') then raise exception 'INVALID_PORTAL_STATE'; end if;
  if p_state='suspended' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'REASON_REQUIRED'; end if;
  select user_id,activation_status into v_user_id,v_before from public.influencers where id=p_influencer_id for update;
  if not found then raise exception 'INFLUENCER_NOT_FOUND'; end if;
  if v_user_id is null then raise exception 'PORTAL_ACCOUNT_REQUIRED'; end if;
  update public.profiles set is_active=(p_state='active'),updated_at=now() where id=v_user_id;
  update public.influencers
    set activation_status=p_state,
        account_status=case when p_state='active' and account_status='suspended' then 'active' else account_status end,
        updated_at=now()
  where id=p_influencer_id;
  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'influencer',p_influencer_id,'portal_account_state_changed',jsonb_build_object('from',v_before,'to',p_state,'reason',p_reason));
end;
$$;
revoke all on function public.set_influencer_portal_account_state(uuid,text,text) from public, anon;
grant execute on function public.set_influencer_portal_account_state(uuid,text,text) to authenticated;

-- Automatically release an expired temporary watch/blacklist when a new campaign action is attempted.
create or replace function private.refresh_expired_influencer_restriction(p_influencer_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text; v_expiry timestamptz;
begin
  select restriction_status,restriction_expires_at into v_status,v_expiry
  from public.influencers where id=p_influencer_id for update;
  if not found then return null; end if;
  if v_status <> 'normal' and v_expiry is not null and v_expiry <= now() then
    update public.influencers
    set restriction_status='normal',restriction_reason=null,restriction_expires_at=null,
        restriction_updated_by=null,restriction_updated_at=now(),updated_at=now()
    where id=p_influencer_id;
    return 'normal';
  end if;
  return v_status;
end;
$$;
revoke all on function private.refresh_expired_influencer_restriction(uuid) from public, anon, authenticated;

create or replace function private.prevent_blacklisted_campaign_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  -- Existing applications must still be rejectable/withdrawable after a restriction is applied.
  if tg_table_name = 'campaign_applications' and coalesce(new.status::text,'') in ('rejected','withdrawn','cancelled') then
    return new;
  end if;
  v_status := private.refresh_expired_influencer_restriction(new.influencer_id);
  if v_status = 'blacklisted' then raise exception 'INFLUENCER_BLACKLISTED'; end if;
  return new;
end;
$$;

drop trigger if exists aa_prevent_blacklisted_assignment on public.campaign_assignments;
create trigger aa_prevent_blacklisted_assignment
before insert on public.campaign_assignments
for each row execute function private.prevent_blacklisted_campaign_activity();

do $$
begin
  if to_regclass('public.campaign_applications') is not null then
    execute 'drop trigger if exists aa_prevent_blacklisted_application on public.campaign_applications';
    execute 'create trigger aa_prevent_blacklisted_application before insert or update of status on public.campaign_applications for each row execute function private.prevent_blacklisted_campaign_activity()';
  end if;
end $$;

-- Keep the existing creator search behavior, but never offer internally blacklisted creators for new campaign work.
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
    where not (coalesce(i.restriction_status,'normal') = 'blacklisted' and (i.restriction_expires_at is null or i.restriction_expires_at > now()))
      and (i.full_name ilike '%'||v_query||'%'
      or coalesce(i.profile_bio,'') ilike '%'||v_query||'%'
      or coalesce(i.primary_category,'') ilike '%'||v_query||'%'
      or (char_length(v_digits)>=4 and regexp_replace(i.mobile_e164,'[^0-9]','','g') like '%'||v_digits||'%')
      or exists(select 1 from public.social_accounts sa where sa.influencer_id=i.id and (sa.username ilike '%'||v_query||'%' or coalesce(sa.profile_url,'') ilike '%'||v_query||'%'))
      or exists(select 1 from public.influencer_work_history wh where wh.influencer_id=i.id and (coalesce(wh.brand_name,'') ilike '%'||v_query||'%' or wh.campaign_name ilike '%'||v_query||'%'))
      )
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

-- ---------------------------------------------------------------------------
-- 2) Participant draft: checkbox selection does not create an Assignment yet.
-- ---------------------------------------------------------------------------
create table if not exists public.campaign_participant_drafts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  application_id uuid references public.campaign_applications(id) on delete set null,
  source text not null default 'direct',
  coordinator_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft',
  assignment_id uuid references public.campaign_assignments(id) on delete set null,
  notes text,
  selected_by uuid references public.profiles(id) on delete set null,
  selected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_participant_drafts_source_check check (source in ('direct','application')),
  constraint campaign_participant_drafts_status_check check (status in ('draft','assigned','removed'))
);

create unique index if not exists campaign_participant_drafts_active_unique
  on public.campaign_participant_drafts(campaign_id,influencer_id)
  where status='draft';
create index if not exists campaign_participant_drafts_campaign_idx
  on public.campaign_participant_drafts(campaign_id,status,selected_at desc);
create index if not exists campaign_participant_drafts_coordinator_idx
  on public.campaign_participant_drafts(coordinator_id,status,selected_at desc);

drop trigger if exists campaign_participant_drafts_set_updated_at on public.campaign_participant_drafts;
create trigger campaign_participant_drafts_set_updated_at
before update on public.campaign_participant_drafts
for each row execute function public.set_updated_at();

alter table public.campaign_participant_drafts enable row level security;
drop policy if exists campaign_participant_drafts_staff_select on public.campaign_participant_drafts;
create policy campaign_participant_drafts_staff_select
on public.campaign_participant_drafts for select to authenticated
using (private.current_user_role() in ('admin','coordinator','reviewer','finance','viewer'));

grant select on public.campaign_participant_drafts to authenticated;
revoke insert, update, delete on public.campaign_participant_drafts from authenticated;

create or replace function private.assert_creator_can_enter_campaign(p_influencer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_directory text; v_restriction text;
begin
  select directory_status,private.refresh_expired_influencer_restriction(id)
  into v_directory,v_restriction
  from public.influencers where id=p_influencer_id;
  if not found then raise exception 'INFLUENCER_NOT_FOUND'; end if;
  if v_restriction='blacklisted' then raise exception 'INFLUENCER_BLACKLISTED'; end if;
  if v_directory not in ('active','managed') then raise exception 'PORTAL_ACTIVATION_REQUIRED'; end if;
end;
$$;
revoke all on function private.assert_creator_can_enter_campaign(uuid) from public, anon, authenticated;

create or replace function public.save_campaign_application_drafts(
  p_campaign_id uuid,
  p_application_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid; v_app record; v_count integer:=0;
begin
  if private.current_user_role() not in ('admin','coordinator') then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists(select 1 from public.campaigns where id=p_campaign_id) then raise exception 'CAMPAIGN_NOT_FOUND'; end if;

  foreach v_id in array coalesce(p_application_ids,array[]::uuid[])
  loop
    select id,campaign_id,influencer_id,status into v_app
    from public.campaign_applications
    where id=v_id and campaign_id=p_campaign_id;
    if not found then continue; end if;
    if v_app.status not in ('pending','shortlisted') then continue; end if;
    perform private.assert_creator_can_enter_campaign(v_app.influencer_id);

    insert into public.campaign_participant_drafts(
      campaign_id,influencer_id,application_id,source,coordinator_id,status,selected_by
    ) values (
      p_campaign_id,v_app.influencer_id,v_app.id,'application',auth.uid(),'draft',auth.uid()
    )
    on conflict (campaign_id,influencer_id) where status='draft'
    do update set application_id=excluded.application_id,source='application',
                  coordinator_id=coalesce(public.campaign_participant_drafts.coordinator_id,auth.uid()),
                  selected_by=auth.uid(),selected_at=now(),updated_at=now();
    v_count:=v_count+1;
  end loop;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'campaign',p_campaign_id,'participant_draft_saved',jsonb_build_object('count',v_count,'source','application'));
  return v_count;
end;
$$;
revoke all on function public.save_campaign_application_drafts(uuid,uuid[]) from public, anon;
grant execute on function public.save_campaign_application_drafts(uuid,uuid[]) to authenticated;

create or replace function public.save_campaign_direct_drafts(
  p_campaign_id uuid,
  p_influencer_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid; v_count integer:=0;
begin
  if private.current_user_role() not in ('admin','coordinator') then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists(select 1 from public.campaigns where id=p_campaign_id) then raise exception 'CAMPAIGN_NOT_FOUND'; end if;

  foreach v_id in array coalesce(p_influencer_ids,array[]::uuid[])
  loop
    perform private.assert_creator_can_enter_campaign(v_id);
    if exists(select 1 from public.campaign_assignments a where a.campaign_id=p_campaign_id and a.influencer_id=v_id and a.status not in ('closed','rejected','cancelled')) then
      continue;
    end if;
    insert into public.campaign_participant_drafts(
      campaign_id,influencer_id,source,coordinator_id,status,selected_by
    ) values (p_campaign_id,v_id,'direct',auth.uid(),'draft',auth.uid())
    on conflict (campaign_id,influencer_id) where status='draft'
    do update set coordinator_id=coalesce(public.campaign_participant_drafts.coordinator_id,auth.uid()),
                  selected_by=auth.uid(),selected_at=now(),updated_at=now();
    v_count:=v_count+1;
  end loop;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'campaign',p_campaign_id,'participant_draft_saved',jsonb_build_object('count',v_count,'source','direct'));
  return v_count;
end;
$$;
revoke all on function public.save_campaign_direct_drafts(uuid,uuid[]) from public, anon;
grant execute on function public.save_campaign_direct_drafts(uuid,uuid[]) to authenticated;

create or replace function public.remove_campaign_participant_draft(p_draft_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_campaign uuid;
begin
  if private.current_user_role() not in ('admin','coordinator') then raise exception 'NOT_AUTHORIZED'; end if;
  update public.campaign_participant_drafts set status='removed',updated_at=now()
  where id=p_draft_id and status='draft' returning campaign_id into v_campaign;
  if v_campaign is null then raise exception 'DRAFT_NOT_FOUND'; end if;
end;
$$;
revoke all on function public.remove_campaign_participant_draft(uuid) from public, anon;
grant execute on function public.remove_campaign_participant_draft(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Automatic campaign ranking: no manual per-creator evaluation required.
-- ---------------------------------------------------------------------------
create or replace function public.get_campaign_application_auto_rank(p_application_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_campaign uuid; v_influencer uuid; v_city text; v_brand uuid; v_restriction text;
  v_settings public.campaign_qualification_settings%rowtype;
  v_platforms text[]:=array[]::text[]; v_followers bigint:=0; v_views numeric:=0; v_engagement numeric:=0; v_brand_history int:=0;
  v_city_match boolean; v_platform_match boolean; v_score int:=0;
  v_followers_score int:=0; v_views_score int:=0; v_engagement_score int:=0;
begin
  if private.current_user_role() not in ('admin','coordinator','reviewer','finance','viewer') then raise exception 'NOT_AUTHORIZED'; end if;
  select ca.campaign_id,ca.influencer_id,i.city,c.brand_id,
         case when coalesce(i.restriction_status,'normal') <> 'normal' and i.restriction_expires_at is not null and i.restriction_expires_at <= now() then 'normal' else coalesce(i.restriction_status,'normal') end
  into v_campaign,v_influencer,v_city,v_brand,v_restriction
  from public.campaign_applications ca
  join public.influencers i on i.id=ca.influencer_id
  join public.campaigns c on c.id=ca.campaign_id
  where ca.id=p_application_id;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;

  select * into v_settings from public.campaign_qualification_settings where campaign_id=v_campaign;
  if not found then
    v_settings.target_cities:=array[]::text[]; v_settings.target_platforms:=array[]::text[]; v_settings.prefer_previous_brand_experience:=false;
  end if;

  select coalesce(array_agg(distinct lower(sa.platform::text)) filter(where sa.platform is not null),array[]::text[]),
         coalesce(sum(coalesce(sa.followers_count,0)),0)::bigint,
         coalesce(round(avg(sa.average_views) filter(where sa.average_views is not null),2),0),
         coalesce(round(avg(sa.engagement_rate) filter(where sa.engagement_rate is not null),2),0)
  into v_platforms,v_followers,v_views,v_engagement
  from public.social_accounts sa where sa.influencer_id=v_influencer;

  if v_brand is not null then
    select count(*)::int into v_brand_history from public.influencer_work_history h where h.influencer_id=v_influencer and h.brand_id=v_brand;
  end if;

  v_city_match := case when coalesce(cardinality(v_settings.target_cities),0)=0 then null else exists(select 1 from unnest(v_settings.target_cities) x where lower(trim(x))=lower(trim(coalesce(v_city,'')))) end;
  v_platform_match := case when coalesce(cardinality(v_settings.target_platforms),0)=0 then null else exists(select 1 from unnest(v_settings.target_platforms) x where lower(trim(x))=any(v_platforms)) end;

  v_score := v_score + case when v_city_match is null then 15 when v_city_match then 15 else 0 end;
  v_score := v_score + case when v_platform_match is null then 20 when v_platform_match then 20 else 0 end;

  if v_settings.min_followers is not null and v_settings.min_followers>0 then
    v_followers_score:=least(20,round(20*least(1::numeric,v_followers::numeric/v_settings.min_followers::numeric))::int);
  else
    v_followers_score:=case when v_followers>=100000 then 20 when v_followers>=50000 then 17 when v_followers>=20000 then 14 when v_followers>=10000 then 11 when v_followers>=5000 then 8 when v_followers>=1000 then 4 else 0 end;
  end if;
  if v_settings.min_average_views is not null and v_settings.min_average_views>0 then
    v_views_score:=least(20,round(20*least(1::numeric,v_views/v_settings.min_average_views))::int);
  else
    v_views_score:=case when v_views>=50000 then 20 when v_views>=20000 then 17 when v_views>=10000 then 14 when v_views>=5000 then 11 when v_views>=2000 then 8 when v_views>=500 then 4 else 0 end;
  end if;
  if v_settings.min_engagement_rate is not null and v_settings.min_engagement_rate>0 then
    v_engagement_score:=least(15,round(15*least(1::numeric,v_engagement/v_settings.min_engagement_rate))::int);
  else
    v_engagement_score:=case when v_engagement>=8 then 15 when v_engagement>=5 then 13 when v_engagement>=3 then 10 when v_engagement>=2 then 7 when v_engagement>=1 then 4 else 0 end;
  end if;
  v_score:=v_score+v_followers_score+v_views_score+v_engagement_score;
  v_score:=v_score+case when coalesce(v_settings.prefer_previous_brand_experience,false) then case when v_brand_history>0 then 10 else 0 end else 10 end;
  if v_restriction='blacklisted' then v_score:=0; end if;

  return jsonb_build_object(
    'score',least(100,v_score),
    'blocked',v_restriction='blacklisted',
    'restriction_status',v_restriction,
    'metrics',jsonb_build_object('city',v_city,'platforms',to_jsonb(v_platforms),'followers',v_followers,'average_views',v_views,'engagement_rate',v_engagement,'same_brand_history_count',v_brand_history),
    'criteria',jsonb_build_object('city_match',v_city_match,'platform_match',v_platform_match,'followers_target',v_settings.min_followers,'views_target',v_settings.min_average_views,'engagement_target',v_settings.min_engagement_rate,'brand_experience_preferred',coalesce(v_settings.prefer_previous_brand_experience,false))
  );
end;
$$;
revoke all on function public.get_campaign_application_auto_rank(uuid) from public, anon;
grant execute on function public.get_campaign_application_auto_rank(uuid) to authenticated;

create or replace function public.list_campaign_application_auto_rankings(p_campaign_id uuid)
returns table(application_id uuid, score integer, blocked boolean, metrics jsonb, criteria jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select ca.id,
         coalesce((r.payload->>'score')::integer,0),
         coalesce((r.payload->>'blocked')::boolean,false),
         coalesce(r.payload->'metrics','{}'::jsonb),
         coalesce(r.payload->'criteria','{}'::jsonb)
  from public.campaign_applications ca
  cross join lateral (select public.get_campaign_application_auto_rank(ca.id) as payload) r
  where ca.campaign_id=p_campaign_id
  order by coalesce((r.payload->>'score')::integer,0) desc, ca.created_at asc;
$$;
revoke all on function public.list_campaign_application_auto_rankings(uuid) from public, anon;
grant execute on function public.list_campaign_application_auto_rankings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Simplified one-by-one Assignment finalization from participant draft.
-- ---------------------------------------------------------------------------
alter table public.campaign_assignments
  add column if not exists attention_required boolean not null default false,
  add column if not exists attention_reason text;

create or replace function public.create_assignment_from_participant_draft(
  p_draft_id uuid,
  p_mode text,
  p_order_number text default null,
  p_amount numeric default null,
  p_branch_name text default null,
  p_attendance_at timestamptz default null,
  p_social_account_id uuid default null,
  p_content_type text default null,
  p_requires_content boolean default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text:=coalesce(private.current_user_role()::text,'');
  v_draft public.campaign_participant_drafts%rowtype;
  v_campaign public.campaigns%rowtype;
  v_influencer public.influencers%rowtype;
  v_assignment uuid; v_social uuid; v_platform uuid; v_content text; v_requires boolean; v_execution public.execution_type;
  v_amount numeric; v_currency text; v_source text; v_product_required boolean:=false; v_branch text; v_brief_version integer;
  v_compensation uuid;
  v_app public.campaign_applications%rowtype;
begin
  if v_role not in ('admin','coordinator') then raise exception 'NOT_AUTHORIZED'; end if;
  if p_mode not in ('pr','paid','pr_paid','attendance','content') then raise exception 'INVALID_COLLABORATION_MODE'; end if;

  select * into v_draft from public.campaign_participant_drafts where id=p_draft_id and status='draft' for update;
  if not found then raise exception 'DRAFT_NOT_FOUND'; end if;
  perform private.assert_creator_can_enter_campaign(v_draft.influencer_id);
  select * into v_campaign from public.campaigns where id=v_draft.campaign_id;
  select * into v_influencer from public.influencers where id=v_draft.influencer_id;

  if exists(select 1 from public.campaign_assignments a where a.campaign_id=v_draft.campaign_id and a.influencer_id=v_draft.influencer_id and a.status not in ('closed','rejected','cancelled')) then raise exception 'ALREADY_ASSIGNED'; end if;
  if p_mode in ('pr','pr_paid') and nullif(trim(coalesce(p_order_number,'')),'') is null then raise exception 'ORDER_NUMBER_REQUIRED'; end if;
  if p_mode in ('paid','pr_paid') and coalesce(p_amount,v_campaign.public_compensation_amount,0)<=0 then raise exception 'AMOUNT_REQUIRED'; end if;
  if p_mode='attendance' and nullif(trim(coalesce(p_branch_name,'')),'') is null then raise exception 'BRANCH_REQUIRED'; end if;

  v_execution:=case when p_mode in ('pr','pr_paid') then 'home'::public.execution_type when p_mode='attendance' then 'in_branch'::public.execution_type else 'remote'::public.execution_type end;
  v_requires:=coalesce(p_requires_content,case when p_mode='attendance' then false else true end);
  v_amount:=case when p_mode in ('paid','pr_paid') then coalesce(p_amount,v_campaign.public_compensation_amount) else 0 end;
  v_currency:=coalesce(nullif(v_campaign.public_compensation_currency,''),'SAR');
  v_source:=case when v_draft.source='application' then 'community_application' else 'participant_draft' end;
  v_product_required:=p_mode in ('pr','pr_paid');
  v_branch:=nullif(trim(coalesce(p_branch_name,'')),'');
  v_brief_version:=coalesce(v_campaign.brief_version,1);

  if v_requires then
    v_social:=p_social_account_id;
    if v_social is null then
      select sa.id into v_social from public.social_accounts sa where sa.influencer_id=v_draft.influencer_id order by sa.followers_count desc nulls last,sa.created_at limit 1;
    end if;
    if v_social is null then raise exception 'SOCIAL_ACCOUNT_REQUIRED'; end if;
    if not exists(select 1 from public.social_accounts where id=v_social and influencer_id=v_draft.influencer_id) then raise exception 'INVALID_SOCIAL_ACCOUNT'; end if;
  end if;

  v_content:=coalesce(nullif(trim(coalesce(p_content_type,'')),''),nullif(trim(coalesce(v_campaign.campaign_type,'')),''),'content');

  insert into public.campaign_assignments(
    campaign_id,influencer_id,coordinator_id,status,execution_type,requires_content,
    content_due_at,publishing_date,branch,attendance_at,order_number,order_invoice_amount,
    coordinator_notes,agreed_amount,currency,invited_at,accepted_at,brief_sent_at,brief_version_sent,
    invitation_status,invitation_sent_at,source,product_required,product_fulfillment_status,
    product_dispatched_at,attention_required
  ) values (
    v_draft.campaign_id,v_draft.influencer_id,coalesce(v_draft.coordinator_id,auth.uid()),
    case when v_requires then 'content_pending'::public.assignment_status else 'accepted'::public.assignment_status end,
    v_execution,v_requires,
    case when v_requires then v_campaign.content_due_at else null end,
    case when v_requires then v_campaign.publishing_date else null end,
    v_branch,p_attendance_at,nullif(trim(coalesce(p_order_number,'')),''),null,
    nullif(trim(coalesce(p_notes,'')),''),v_amount,v_currency,now(),now(),now(),v_brief_version,
    'sent',now(),v_source,v_product_required,
    case when v_product_required then 'dispatched' else 'not_required' end,
    case when v_product_required then now() else null end,false
  ) returning id into v_assignment;

  if v_requires then
    insert into public.assignment_platforms(assignment_id,social_account_id,required_deliverables)
    values(v_assignment,v_social,jsonb_build_array(jsonb_build_object('contentType',v_content,'quantity',1)))
    returning id into v_platform;
    insert into public.content_items(assignment_platform_id,sequence_no,content_type,status)
    values(v_platform,1,v_content,'draft');
  end if;

  if p_mode in ('paid','pr_paid') then
    insert into public.assignment_compensations(assignment_id,type,amount,notes)
    values(v_assignment,'bank_transfer',v_amount,'Created from simplified participant draft')
    on conflict (assignment_id,type) do update set amount=excluded.amount
    returning id into v_compensation;
    insert into public.payments(assignment_id,compensation_id,type,amount,expected_amount,status,finance_notes)
    values(v_assignment,v_compensation,'bank_transfer',v_amount,v_amount,'draft','Created automatically from campaign assignment')
    on conflict (assignment_id,type) do update
      set compensation_id=excluded.compensation_id,amount=excluded.amount,expected_amount=excluded.expected_amount,updated_at=now();
  end if;

  if p_mode in ('pr','pr_paid') then
    insert into public.assignment_compensations(assignment_id,type,amount,product_description,product_reference_value,notes)
    values(v_assignment,'product',0,coalesce(nullif(v_campaign.product,''),'PR products'),0,'Order: '||trim(p_order_number))
    on conflict (assignment_id,type) do nothing;
  end if;

  update public.campaign_participant_drafts
  set status='assigned',assignment_id=v_assignment,updated_at=now()
  where id=v_draft.id;

  if v_draft.application_id is not null then
    select * into v_app from public.campaign_applications where id=v_draft.application_id for update;
    update public.campaign_applications
    set status='accepted',assignment_id=v_assignment,reviewed_by=auth.uid(),reviewed_at=now(),rejection_reason=null,updated_at=now()
    where id=v_draft.application_id;
  end if;

  insert into public.assignment_execution_events(assignment_id,action,status_before,status_after,notes,metadata,created_by)
  values(v_assignment,'simplified_assignment_created',null,(select status::text from public.campaign_assignments where id=v_assignment),p_notes,
    jsonb_build_object('mode',p_mode,'draft_id',v_draft.id,'order_number',p_order_number,'amount',v_amount,'auto_brief',true),auth.uid());

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'campaign_assignment',v_assignment,'simplified_assignment_created',jsonb_build_object('campaign_id',v_draft.campaign_id,'influencer_id',v_draft.influencer_id,'mode',p_mode,'draft_id',v_draft.id));

  return v_assignment;
end;
$$;
revoke all on function public.create_assignment_from_participant_draft(uuid,text,text,numeric,text,timestamptz,uuid,text,boolean,text) from public, anon;
grant execute on function public.create_assignment_from_participant_draft(uuid,text,text,numeric,text,timestamptz,uuid,text,boolean,text) to authenticated;

create or replace function public.set_assignment_attention(p_assignment_id uuid,p_attention boolean,p_reason text default null)
returns void
language plpgsql
security definer
set search_path=''
as $$
begin
  if private.current_user_role() not in ('admin','coordinator') then raise exception 'NOT_AUTHORIZED'; end if;
  if p_attention and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'REASON_REQUIRED'; end if;
  update public.campaign_assignments set attention_required=p_attention,attention_reason=case when p_attention then nullif(trim(p_reason),'') else null end,updated_at=now() where id=p_assignment_id;
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
end;
$$;
revoke all on function public.set_assignment_attention(uuid,boolean,text) from public, anon;
grant execute on function public.set_assignment_attention(uuid,boolean,text) to authenticated;

notify pgrst, 'reload schema';
commit;
