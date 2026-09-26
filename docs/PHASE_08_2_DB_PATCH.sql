-- Dar Al Amirat Creator Community
-- Phase 08.2 - Campaign qualification and application evaluation
-- Apply after Phase 08.1.

begin;

create table if not exists public.campaign_qualification_settings (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  target_cities text[] not null default '{}',
  target_platforms text[] not null default '{}',
  min_followers bigint,
  min_average_views numeric(14,2),
  min_engagement_rate numeric(8,4),
  prefer_previous_brand_experience boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_qualification_min_followers_check check (min_followers is null or min_followers >= 0),
  constraint campaign_qualification_min_views_check check (min_average_views is null or min_average_views >= 0),
  constraint campaign_qualification_min_engagement_check check (min_engagement_rate is null or min_engagement_rate >= 0)
);

drop trigger if exists campaign_qualification_settings_set_updated_at on public.campaign_qualification_settings;
create trigger campaign_qualification_settings_set_updated_at
before update on public.campaign_qualification_settings
for each row execute function public.set_updated_at();

create table if not exists public.campaign_application_evaluations (
  application_id uuid primary key references public.campaign_applications(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  campaign_fit_rating smallint,
  campaign_fit_notes text,
  total_score smallint not null default 0,
  suggested_status text not null default 'needs_review',
  final_status text,
  final_reason text,
  staff_notes text,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  criteria_snapshot jsonb not null default '{}'::jsonb,
  settings_snapshot jsonb not null default '{}'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  scoring_version text not null default 'phase08.2-v1',
  evaluated_by uuid references public.profiles(id) on delete set null,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_application_eval_fit_check check (campaign_fit_rating is null or campaign_fit_rating between 1 and 5),
  constraint campaign_application_eval_score_check check (total_score between 0 and 100),
  constraint campaign_application_eval_suggested_check check (suggested_status in ('qualified','needs_review','waitlist','not_qualified')),
  constraint campaign_application_eval_final_check check (final_status is null or final_status in ('qualified','needs_review','waitlist','not_qualified'))
);

create index if not exists campaign_application_evaluations_campaign_idx
  on public.campaign_application_evaluations(campaign_id, suggested_status, total_score desc);
create index if not exists campaign_application_evaluations_influencer_idx
  on public.campaign_application_evaluations(influencer_id, updated_at desc);

drop trigger if exists campaign_application_evaluations_set_updated_at on public.campaign_application_evaluations;
create trigger campaign_application_evaluations_set_updated_at
before update on public.campaign_application_evaluations
for each row execute function public.set_updated_at();

create table if not exists public.campaign_application_evaluation_history (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.campaign_applications(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  event_type text not null default 'manual_save',
  application_status text,
  campaign_fit_rating smallint,
  campaign_fit_notes text,
  total_score smallint not null,
  suggested_status text not null,
  final_status text,
  final_reason text,
  staff_notes text,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  criteria_snapshot jsonb not null default '{}'::jsonb,
  settings_snapshot jsonb not null default '{}'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  scoring_version text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint campaign_application_eval_history_event_check check (event_type in ('manual_save','application_decision'))
);

create index if not exists campaign_application_eval_history_app_idx
  on public.campaign_application_evaluation_history(application_id, created_at desc);

alter table public.campaign_qualification_settings enable row level security;
alter table public.campaign_application_evaluations enable row level security;
alter table public.campaign_application_evaluation_history enable row level security;

drop policy if exists campaign_qualification_settings_staff_select on public.campaign_qualification_settings;
create policy campaign_qualification_settings_staff_select
on public.campaign_qualification_settings for select to authenticated
using (private.current_user_role() in ('admin','coordinator','finance','reviewer','viewer'));

drop policy if exists campaign_application_evaluations_staff_select on public.campaign_application_evaluations;
create policy campaign_application_evaluations_staff_select
on public.campaign_application_evaluations for select to authenticated
using (private.current_user_role() in ('admin','coordinator','finance','reviewer','viewer'));

drop policy if exists campaign_application_eval_history_staff_select on public.campaign_application_evaluation_history;
create policy campaign_application_eval_history_staff_select
on public.campaign_application_evaluation_history for select to authenticated
using (private.current_user_role() in ('admin','coordinator','finance','reviewer','viewer'));

revoke insert, update, delete on public.campaign_qualification_settings from authenticated;
revoke insert, update, delete on public.campaign_application_evaluations from authenticated;
revoke insert, update, delete on public.campaign_application_evaluation_history from authenticated;
grant select on public.campaign_qualification_settings to authenticated;
grant select on public.campaign_application_evaluations to authenticated;
grant select on public.campaign_application_evaluation_history to authenticated;

create or replace function private.compute_campaign_application_evaluation(
  p_application_id uuid,
  p_campaign_fit_rating smallint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
  v_influencer_id uuid;
  v_brand_id uuid;
  v_city text;
  v_settings public.campaign_qualification_settings%rowtype;
  v_general public.influencer_evaluations%rowtype;
  v_general_exists boolean := false;
  v_general_score integer := 0;
  v_general_status text;
  v_platforms text[] := array[]::text[];
  v_total_followers bigint := 0;
  v_average_views numeric := 0;
  v_average_engagement numeric := 0;
  v_same_brand_history integer := 0;
  v_same_brand_positive integer := 0;
  v_city_match boolean;
  v_platform_match boolean;
  v_followers_match boolean;
  v_views_match boolean;
  v_engagement_match boolean;
  v_brand_history_match boolean;
  v_general_points integer := 0;
  v_campaign_fit_points integer := 0;
  v_brand_history_points integer := 0;
  v_city_points integer := 0;
  v_platform_points integer := 0;
  v_followers_points integer := 0;
  v_views_points integer := 0;
  v_engagement_points integer := 0;
  v_total integer := 0;
  v_suggested text := 'needs_review';
begin
  select ca.campaign_id, ca.influencer_id, c.brand_id, i.city
  into v_campaign_id, v_influencer_id, v_brand_id, v_city
  from public.campaign_applications ca
  join public.campaigns c on c.id = ca.campaign_id
  join public.influencers i on i.id = ca.influencer_id
  where ca.id = p_application_id;

  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;

  select * into v_settings from public.campaign_qualification_settings s where s.campaign_id = v_campaign_id;
  if not found then
    v_settings.campaign_id := v_campaign_id;
    v_settings.target_cities := array[]::text[];
    v_settings.target_platforms := array[]::text[];
    v_settings.prefer_previous_brand_experience := false;
  end if;

  select * into v_general from public.influencer_evaluations e where e.influencer_id = v_influencer_id;
  v_general_exists := found;
  if v_general_exists then
    v_general_score := coalesce(v_general.total_score, 0);
    v_general_status := coalesce(v_general.final_status, v_general.suggested_status);
  end if;

  select
    coalesce(array_agg(distinct lower(sa.platform::text)) filter (where sa.platform is not null), array[]::text[]),
    coalesce(sum(coalesce(sa.followers_count,0)),0)::bigint,
    coalesce(round(avg(sa.average_views) filter (where sa.average_views is not null),2),0),
    coalesce(round(avg(sa.engagement_rate) filter (where sa.engagement_rate is not null),2),0)
  into v_platforms, v_total_followers, v_average_views, v_average_engagement
  from public.social_accounts sa where sa.influencer_id = v_influencer_id;

  if v_brand_id is not null then
    select count(*)::integer,
           count(*) filter (where h.outcome = 'positive')::integer
    into v_same_brand_history, v_same_brand_positive
    from public.influencer_work_history h
    where h.influencer_id = v_influencer_id and h.brand_id = v_brand_id;
  end if;

  v_city_match := case
    when coalesce(cardinality(v_settings.target_cities),0) = 0 then null
    else exists(select 1 from unnest(v_settings.target_cities) x where lower(trim(x)) = lower(trim(coalesce(v_city,''))))
  end;

  v_platform_match := case
    when coalesce(cardinality(v_settings.target_platforms),0) = 0 then null
    else exists(
      select 1 from unnest(v_settings.target_platforms) x
      where lower(trim(x)) = any(v_platforms)
    )
  end;

  v_followers_match := case when v_settings.min_followers is null then null else v_total_followers >= v_settings.min_followers end;
  v_views_match := case when v_settings.min_average_views is null then null else v_average_views >= v_settings.min_average_views end;
  v_engagement_match := case when v_settings.min_engagement_rate is null then null else v_average_engagement >= v_settings.min_engagement_rate end;
  v_brand_history_match := case when not coalesce(v_settings.prefer_previous_brand_experience,false) or v_brand_id is null then null else v_same_brand_history > 0 end;

  v_general_points := least(30, round(v_general_score * 0.30)::integer);
  v_campaign_fit_points := coalesce(p_campaign_fit_rating,0) * 3;
  v_brand_history_points := case
    when not coalesce(v_settings.prefer_previous_brand_experience,false) or v_brand_id is null then 15
    when v_same_brand_history > 0 then 15 else 0 end;
  v_city_points := case when v_city_match is null then 10 when v_city_match then 10 else 0 end;
  v_platform_points := case when v_platform_match is null then 10 when v_platform_match then 10 else 0 end;
  v_followers_points := case
    when v_settings.min_followers is null or v_settings.min_followers = 0 then 8
    else least(8, floor(8 * v_total_followers::numeric / v_settings.min_followers::numeric)::integer)
  end;
  v_views_points := case
    when v_settings.min_average_views is null or v_settings.min_average_views = 0 then 7
    else least(7, floor(7 * v_average_views / v_settings.min_average_views)::integer)
  end;
  v_engagement_points := case
    when v_settings.min_engagement_rate is null or v_settings.min_engagement_rate = 0 then 5
    else least(5, floor(5 * v_average_engagement / v_settings.min_engagement_rate)::integer)
  end;

  v_total := least(100, v_general_points + v_campaign_fit_points + v_brand_history_points + v_city_points + v_platform_points + v_followers_points + v_views_points + v_engagement_points);

  if not v_general_exists or p_campaign_fit_rating is null then
    v_suggested := 'needs_review';
  elsif v_general_status = 'not_qualified' then
    v_suggested := 'not_qualified';
  elsif v_total >= 80 then v_suggested := 'qualified';
  elsif v_total >= 65 then v_suggested := 'needs_review';
  elsif v_total >= 50 then v_suggested := 'waitlist';
  else v_suggested := 'not_qualified';
  end if;

  return jsonb_build_object(
    'scoring_version','phase08.2-v1',
    'total_score',v_total,
    'suggested_status',v_suggested,
    'general_evaluation',jsonb_build_object(
      'exists',v_general_exists,
      'total_score',v_general_score,
      'suggested_status',v_general.suggested_status,
      'final_status',v_general.final_status
    ),
    'metrics',jsonb_build_object(
      'city',v_city,
      'platforms',to_jsonb(v_platforms),
      'total_followers',v_total_followers,
      'average_views',v_average_views,
      'average_engagement',v_average_engagement,
      'same_brand_history_count',v_same_brand_history,
      'same_brand_positive_count',v_same_brand_positive
    ),
    'criteria',jsonb_build_object(
      'city_match',v_city_match,
      'platform_match',v_platform_match,
      'followers_match',v_followers_match,
      'views_match',v_views_match,
      'engagement_match',v_engagement_match,
      'brand_history_match',v_brand_history_match
    ),
    'settings',jsonb_build_object(
      'target_cities',coalesce(v_settings.target_cities,array[]::text[]),
      'target_platforms',coalesce(v_settings.target_platforms,array[]::text[]),
      'min_followers',v_settings.min_followers,
      'min_average_views',v_settings.min_average_views,
      'min_engagement_rate',v_settings.min_engagement_rate,
      'prefer_previous_brand_experience',coalesce(v_settings.prefer_previous_brand_experience,false)
    ),
    'score_breakdown',jsonb_build_object(
      'general_evaluation',v_general_points,
      'campaign_fit',v_campaign_fit_points,
      'same_brand_history',v_brand_history_points,
      'city',v_city_points,
      'platform',v_platform_points,
      'followers',v_followers_points,
      'average_views',v_views_points,
      'engagement',v_engagement_points
    )
  );
end;
$$;

revoke all on function private.compute_campaign_application_evaluation(uuid,smallint) from public, anon, authenticated;

create or replace function public.get_campaign_application_evaluation_summary(p_application_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_user_role()::text;
  v_eval public.campaign_application_evaluations%rowtype;
  v_snapshot jsonb;
  v_name text;
  v_exists boolean := false;
begin
  if v_role not in ('admin','coordinator','finance','reviewer','viewer') then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_eval from public.campaign_application_evaluations e where e.application_id = p_application_id;
  v_exists := found;
  v_snapshot := private.compute_campaign_application_evaluation(p_application_id, v_eval.campaign_fit_rating);
  if v_eval.evaluated_by is not null then select p.full_name into v_name from public.profiles p where p.id=v_eval.evaluated_by; end if;
  return v_snapshot || jsonb_build_object(
    'evaluation_exists',v_exists,
    'campaign_fit_rating',v_eval.campaign_fit_rating,
    'campaign_fit_notes',v_eval.campaign_fit_notes,
    'final_status',v_eval.final_status,
    'final_reason',v_eval.final_reason,
    'staff_notes',v_eval.staff_notes,
    'evaluated_by',v_eval.evaluated_by,
    'evaluator_name',v_name,
    'evaluated_at',v_eval.evaluated_at
  );
end;
$$;
revoke all on function public.get_campaign_application_evaluation_summary(uuid) from public, anon;
grant execute on function public.get_campaign_application_evaluation_summary(uuid) to authenticated;

create or replace function public.save_campaign_qualification_settings(
  p_campaign_id uuid,
  p_target_cities text[],
  p_target_platforms text[],
  p_min_followers bigint,
  p_min_average_views numeric,
  p_min_engagement_rate numeric,
  p_prefer_previous_brand_experience boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_role text := private.current_user_role()::text;
begin
  if v_role not in ('admin','coordinator') then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists(select 1 from public.campaigns c where c.id=p_campaign_id) then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  if p_min_followers is not null and p_min_followers < 0 then raise exception 'INVALID_MIN_FOLLOWERS'; end if;
  if p_min_average_views is not null and p_min_average_views < 0 then raise exception 'INVALID_MIN_VIEWS'; end if;
  if p_min_engagement_rate is not null and p_min_engagement_rate < 0 then raise exception 'INVALID_MIN_ENGAGEMENT'; end if;
  insert into public.campaign_qualification_settings(
    campaign_id,target_cities,target_platforms,min_followers,min_average_views,min_engagement_rate,prefer_previous_brand_experience,updated_by
  ) values (
    p_campaign_id,
    coalesce((select array_agg(distinct trim(x)) from unnest(coalesce(p_target_cities,array[]::text[])) x where nullif(trim(x),'') is not null),array[]::text[]),
    coalesce((select array_agg(distinct lower(trim(x))) from unnest(coalesce(p_target_platforms,array[]::text[])) x where nullif(trim(x),'') is not null),array[]::text[]),
    p_min_followers,p_min_average_views,p_min_engagement_rate,coalesce(p_prefer_previous_brand_experience,false),auth.uid()
  )
  on conflict (campaign_id) do update set
    target_cities=excluded.target_cities,target_platforms=excluded.target_platforms,min_followers=excluded.min_followers,
    min_average_views=excluded.min_average_views,min_engagement_rate=excluded.min_engagement_rate,
    prefer_previous_brand_experience=excluded.prefer_previous_brand_experience,updated_by=excluded.updated_by;
end;
$$;
revoke all on function public.save_campaign_qualification_settings(uuid,text[],text[],bigint,numeric,numeric,boolean) from public, anon;
grant execute on function public.save_campaign_qualification_settings(uuid,text[],text[],bigint,numeric,numeric,boolean) to authenticated;

create or replace function public.save_campaign_application_evaluation(
  p_application_id uuid,
  p_campaign_fit_rating smallint,
  p_campaign_fit_notes text,
  p_final_status text,
  p_final_reason text,
  p_staff_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_user_role()::text;
  v_app public.campaign_applications%rowtype;
  v_snapshot jsonb;
  v_now timestamptz := now();
begin
  if v_role not in ('admin','coordinator','reviewer') then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_app from public.campaign_applications where id=p_application_id;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if p_campaign_fit_rating is not null and p_campaign_fit_rating not between 1 and 5 then raise exception 'INVALID_CAMPAIGN_FIT_RATING'; end if;
  if p_final_status is not null and p_final_status not in ('qualified','needs_review','waitlist','not_qualified') then raise exception 'INVALID_FINAL_STATUS'; end if;
  if p_final_status in ('waitlist','not_qualified') and nullif(trim(coalesce(p_final_reason,'')),'') is null then raise exception 'DECISION_REASON_REQUIRED'; end if;
  if length(coalesce(p_campaign_fit_notes,'')) > 2000 or length(coalesce(p_staff_notes,'')) > 3000 or length(coalesce(p_final_reason,'')) > 3000 then raise exception 'NOTE_TOO_LONG'; end if;

  v_snapshot := private.compute_campaign_application_evaluation(p_application_id,p_campaign_fit_rating);

  insert into public.campaign_application_evaluations(
    application_id,campaign_id,influencer_id,campaign_fit_rating,campaign_fit_notes,total_score,suggested_status,
    final_status,final_reason,staff_notes,metrics_snapshot,criteria_snapshot,settings_snapshot,score_breakdown,scoring_version,evaluated_by,evaluated_at
  ) values (
    p_application_id,v_app.campaign_id,v_app.influencer_id,p_campaign_fit_rating,nullif(trim(coalesce(p_campaign_fit_notes,'')),''),
    (v_snapshot->>'total_score')::integer,v_snapshot->>'suggested_status',p_final_status,nullif(trim(coalesce(p_final_reason,'')),''),
    nullif(trim(coalesce(p_staff_notes,'')),''),v_snapshot->'metrics',v_snapshot->'criteria',v_snapshot->'settings',v_snapshot->'score_breakdown',
    v_snapshot->>'scoring_version',auth.uid(),v_now
  ) on conflict (application_id) do update set
    campaign_id=excluded.campaign_id,influencer_id=excluded.influencer_id,campaign_fit_rating=excluded.campaign_fit_rating,
    campaign_fit_notes=excluded.campaign_fit_notes,total_score=excluded.total_score,suggested_status=excluded.suggested_status,
    final_status=excluded.final_status,final_reason=excluded.final_reason,staff_notes=excluded.staff_notes,
    metrics_snapshot=excluded.metrics_snapshot,criteria_snapshot=excluded.criteria_snapshot,settings_snapshot=excluded.settings_snapshot,
    score_breakdown=excluded.score_breakdown,scoring_version=excluded.scoring_version,evaluated_by=excluded.evaluated_by,evaluated_at=excluded.evaluated_at;

  insert into public.campaign_application_evaluation_history(
    application_id,campaign_id,influencer_id,event_type,application_status,campaign_fit_rating,campaign_fit_notes,total_score,
    suggested_status,final_status,final_reason,staff_notes,metrics_snapshot,criteria_snapshot,settings_snapshot,score_breakdown,scoring_version,changed_by
  ) values (
    p_application_id,v_app.campaign_id,v_app.influencer_id,'manual_save',v_app.status::text,p_campaign_fit_rating,nullif(trim(coalesce(p_campaign_fit_notes,'')),''),
    (v_snapshot->>'total_score')::integer,v_snapshot->>'suggested_status',p_final_status,nullif(trim(coalesce(p_final_reason,'')),''),nullif(trim(coalesce(p_staff_notes,'')),''),
    v_snapshot->'metrics',v_snapshot->'criteria',v_snapshot->'settings',v_snapshot->'score_breakdown',v_snapshot->>'scoring_version',auth.uid()
  );

  return public.get_campaign_application_evaluation_summary(p_application_id);
end;
$$;
revoke all on function public.save_campaign_application_evaluation(uuid,smallint,text,text,text,text) from public, anon;
grant execute on function public.save_campaign_application_evaluation(uuid,smallint,text,text,text,text) to authenticated;

create or replace function public.snapshot_campaign_application_evaluation_on_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eval public.campaign_application_evaluations%rowtype;
  v_snapshot jsonb;
begin
  if old.status is distinct from new.status and new.status::text in ('shortlisted','accepted','rejected') then
    select * into v_eval from public.campaign_application_evaluations e where e.application_id=new.id;
    v_snapshot := private.compute_campaign_application_evaluation(new.id,v_eval.campaign_fit_rating);
    insert into public.campaign_application_evaluation_history(
      application_id,campaign_id,influencer_id,event_type,application_status,campaign_fit_rating,campaign_fit_notes,total_score,
      suggested_status,final_status,final_reason,staff_notes,metrics_snapshot,criteria_snapshot,settings_snapshot,score_breakdown,scoring_version,changed_by
    ) values (
      new.id,new.campaign_id,new.influencer_id,'application_decision',new.status::text,v_eval.campaign_fit_rating,v_eval.campaign_fit_notes,
      (v_snapshot->>'total_score')::integer,v_snapshot->>'suggested_status',v_eval.final_status,v_eval.final_reason,v_eval.staff_notes,
      v_snapshot->'metrics',v_snapshot->'criteria',v_snapshot->'settings',v_snapshot->'score_breakdown',v_snapshot->>'scoring_version',auth.uid()
    );
  end if;
  return new;
end;
$$;

drop trigger if exists campaign_application_evaluation_decision_snapshot on public.campaign_applications;
create trigger campaign_application_evaluation_decision_snapshot
after update of status on public.campaign_applications
for each row execute function public.snapshot_campaign_application_evaluation_on_decision();

commit;
