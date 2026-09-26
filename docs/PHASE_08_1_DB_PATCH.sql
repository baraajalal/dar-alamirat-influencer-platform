-- Phase 08.1: influencer qualification and evaluation foundation.
-- Staff decision support only. The system suggestion never replaces the staff final decision.

begin;

create table if not exists public.influencer_evaluations (
  influencer_id uuid primary key references public.influencers(id) on delete cascade,
  content_quality_rating smallint,
  brand_fit_rating smallint,
  reliability_rating smallint,
  content_quality_notes text,
  brand_fit_notes text,
  reliability_notes text,
  total_score smallint not null default 0,
  suggested_status text not null default 'needs_review',
  final_status text,
  final_reason text,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  scoring_version text not null default 'phase08.1-v1',
  evaluated_by uuid references public.profiles(id) on delete set null,
  evaluated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint influencer_evaluations_content_quality_check check (content_quality_rating is null or content_quality_rating between 1 and 5),
  constraint influencer_evaluations_brand_fit_check check (brand_fit_rating is null or brand_fit_rating between 1 and 5),
  constraint influencer_evaluations_reliability_check check (reliability_rating is null or reliability_rating between 1 and 5),
  constraint influencer_evaluations_score_check check (total_score between 0 and 100),
  constraint influencer_evaluations_suggested_status_check check (suggested_status in ('qualified','needs_review','waitlist','not_qualified')),
  constraint influencer_evaluations_final_status_check check (final_status is null or final_status in ('qualified','needs_review','waitlist','not_qualified'))
);

create index if not exists influencer_evaluations_final_status_idx
  on public.influencer_evaluations(final_status, updated_at desc);
create index if not exists influencer_evaluations_suggested_status_idx
  on public.influencer_evaluations(suggested_status, total_score desc);

drop trigger if exists influencer_evaluations_set_updated_at on public.influencer_evaluations;
create trigger influencer_evaluations_set_updated_at
before update on public.influencer_evaluations
for each row execute function public.set_updated_at();

create table if not exists public.influencer_evaluation_history (
  id bigint generated always as identity primary key,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  content_quality_rating smallint,
  brand_fit_rating smallint,
  reliability_rating smallint,
  content_quality_notes text,
  brand_fit_notes text,
  reliability_notes text,
  total_score smallint not null,
  suggested_status text not null,
  final_status text,
  final_reason text,
  metrics_snapshot jsonb not null default '{}'::jsonb,
  score_breakdown jsonb not null default '{}'::jsonb,
  scoring_version text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists influencer_evaluation_history_influencer_idx
  on public.influencer_evaluation_history(influencer_id, created_at desc);

alter table public.influencer_evaluations enable row level security;
alter table public.influencer_evaluation_history enable row level security;

drop policy if exists influencer_evaluations_staff_select on public.influencer_evaluations;
create policy influencer_evaluations_staff_select
on public.influencer_evaluations
for select to authenticated
using (private.current_user_role() in ('admin','coordinator','finance','reviewer','viewer'));

drop policy if exists influencer_evaluation_history_staff_select on public.influencer_evaluation_history;
create policy influencer_evaluation_history_staff_select
on public.influencer_evaluation_history
for select to authenticated
using (private.current_user_role() in ('admin','coordinator','finance','reviewer','viewer'));

revoke insert, update, delete on public.influencer_evaluations from authenticated;
revoke insert, update, delete on public.influencer_evaluation_history from authenticated;
grant select on public.influencer_evaluations to authenticated;
grant select on public.influencer_evaluation_history to authenticated;

create or replace function private.compute_influencer_evaluation(
  p_influencer_id uuid,
  p_content_quality_rating smallint,
  p_brand_fit_rating smallint,
  p_reliability_rating smallint
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_completion integer := 0;
  v_city text;
  v_social_count integer := 0;
  v_platforms text[] := array[]::text[];
  v_total_followers bigint := 0;
  v_average_views numeric := 0;
  v_average_engagement numeric := 0;
  v_history_count integer := 0;
  v_positive_count integer := 0;
  v_neutral_count integer := 0;
  v_attention_count integer := 0;
  v_known_outcome_count integer := 0;
  v_previous_brand_count integer := 0;
  v_content_quality_score integer := 0;
  v_brand_fit_score integer := 0;
  v_reliability_score integer := 0;
  v_city_score integer := 0;
  v_platform_score integer := 0;
  v_followers_score integer := 0;
  v_views_score integer := 0;
  v_engagement_score integer := 0;
  v_history_score integer := 0;
  v_history_performance_bonus integer := 0;
  v_total_score integer := 0;
  v_manual_complete boolean := false;
  v_suggested_status text := 'needs_review';
begin
  select coalesce(i.profile_completion, 0), i.city
  into v_profile_completion, v_city
  from public.influencers i
  where i.id = p_influencer_id;

  if not found then
    raise exception 'INFLUENCER_NOT_FOUND';
  end if;

  select
    count(*)::integer,
    coalesce(array_agg(distinct sa.platform::text order by sa.platform::text) filter (where sa.platform is not null), array[]::text[]),
    coalesce(sum(coalesce(sa.followers_count, 0)), 0)::bigint,
    coalesce(round(avg(sa.average_views) filter (where sa.average_views is not null)), 0),
    coalesce(round(avg(sa.engagement_rate) filter (where sa.engagement_rate is not null), 2), 0)
  into v_social_count, v_platforms, v_total_followers, v_average_views, v_average_engagement
  from public.social_accounts sa
  where sa.influencer_id = p_influencer_id;

  select
    count(*)::integer,
    count(*) filter (where h.outcome = 'positive')::integer,
    count(*) filter (where h.outcome = 'neutral')::integer,
    count(*) filter (where h.outcome = 'needs_attention')::integer,
    (count(distinct coalesce(h.brand_id::text, nullif(lower(trim(h.brand_name)), ''))) filter (where h.brand_id is not null or nullif(trim(h.brand_name), '') is not null))::integer
  into v_history_count, v_positive_count, v_neutral_count, v_attention_count, v_previous_brand_count
  from public.influencer_work_history h
  where h.influencer_id = p_influencer_id;

  v_known_outcome_count := v_positive_count + v_neutral_count + v_attention_count;

  v_content_quality_score := coalesce(p_content_quality_rating, 0) * 4;
  v_brand_fit_score := coalesce(p_brand_fit_rating, 0) * 3;
  v_reliability_score := coalesce(p_reliability_rating, 0) * 3;
  v_city_score := case when nullif(trim(coalesce(v_city, '')), '') is not null then 5 else 0 end;
  v_platform_score := case when v_social_count > 0 then 5 else 0 end;

  v_followers_score := case
    when v_total_followers >= 100000 then 10
    when v_total_followers >= 50000 then 8
    when v_total_followers >= 10000 then 6
    when v_total_followers >= 5000 then 4
    when v_total_followers >= 1000 then 2
    else 0
  end;

  v_views_score := case
    when v_average_views >= 50000 then 10
    when v_average_views >= 20000 then 8
    when v_average_views >= 5000 then 6
    when v_average_views >= 2000 then 4
    when v_average_views >= 500 then 2
    else 0
  end;

  v_engagement_score := case
    when v_average_engagement >= 8 then 10
    when v_average_engagement >= 5 then 8
    when v_average_engagement >= 3 then 6
    when v_average_engagement >= 2 then 4
    when v_average_engagement >= 1 then 2
    else 0
  end;

  if v_history_count > 0 then
    v_history_score := least(6, v_history_count * 2);
    if v_known_outcome_count > 0 then
      v_history_performance_bonus := case
        when (v_positive_count::numeric / v_known_outcome_count::numeric) >= 0.75 then 4
        when (v_positive_count::numeric / v_known_outcome_count::numeric) >= 0.50 then 3
        when (v_positive_count::numeric / v_known_outcome_count::numeric) >= 0.25 then 2
        else 1
      end;
    end if;
    v_history_score := least(10, v_history_score + v_history_performance_bonus);
  end if;

  v_total_score := least(100,
    v_content_quality_score + v_brand_fit_score + v_reliability_score +
    v_city_score + v_platform_score + v_followers_score + v_views_score +
    v_engagement_score + v_history_score
  );

  v_manual_complete := p_content_quality_rating is not null
    and p_brand_fit_rating is not null
    and p_reliability_rating is not null;

  if not v_manual_complete or v_social_count = 0 or v_profile_completion < 50 then
    v_suggested_status := 'needs_review';
  elsif v_total_score >= 80 then
    v_suggested_status := 'qualified';
  elsif v_total_score >= 65 then
    v_suggested_status := 'needs_review';
  elsif v_total_score >= 50 then
    v_suggested_status := 'waitlist';
  else
    v_suggested_status := 'not_qualified';
  end if;

  return jsonb_build_object(
    'scoring_version', 'phase08.1-v1',
    'manual_complete', v_manual_complete,
    'total_score', v_total_score,
    'suggested_status', v_suggested_status,
    'metrics', jsonb_build_object(
      'profile_completion', v_profile_completion,
      'city', v_city,
      'platforms', to_jsonb(v_platforms),
      'social_account_count', v_social_count,
      'total_followers', v_total_followers,
      'average_views', v_average_views,
      'average_engagement', v_average_engagement,
      'work_history_count', v_history_count,
      'positive_history_count', v_positive_count,
      'neutral_history_count', v_neutral_count,
      'needs_attention_history_count', v_attention_count,
      'previous_brand_count', v_previous_brand_count
    ),
    'score_breakdown', jsonb_build_object(
      'content_quality', v_content_quality_score,
      'brand_fit', v_brand_fit_score,
      'reliability', v_reliability_score,
      'city', v_city_score,
      'platform', v_platform_score,
      'followers', v_followers_score,
      'average_views', v_views_score,
      'engagement', v_engagement_score,
      'past_work', v_history_score
    )
  );
end;
$$;

revoke all on function private.compute_influencer_evaluation(uuid,smallint,smallint,smallint) from public, anon, authenticated;

create or replace function public.get_influencer_evaluation_summary(p_influencer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_user_role()::text;
  v_eval public.influencer_evaluations%rowtype;
  v_snapshot jsonb;
  v_evaluator_name text;
  v_exists boolean := false;
begin
  if v_role not in ('admin','coordinator','finance','reviewer','viewer') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into v_eval
  from public.influencer_evaluations e
  where e.influencer_id = p_influencer_id;
  v_exists := found;

  v_snapshot := private.compute_influencer_evaluation(
    p_influencer_id,
    v_eval.content_quality_rating,
    v_eval.brand_fit_rating,
    v_eval.reliability_rating
  );

  if v_eval.evaluated_by is not null then
    select p.full_name into v_evaluator_name
    from public.profiles p
    where p.id = v_eval.evaluated_by;
  end if;

  return v_snapshot || jsonb_build_object(
    'evaluation_exists', v_exists,
    'manual', jsonb_build_object(
      'content_quality_rating', v_eval.content_quality_rating,
      'brand_fit_rating', v_eval.brand_fit_rating,
      'reliability_rating', v_eval.reliability_rating,
      'content_quality_notes', v_eval.content_quality_notes,
      'brand_fit_notes', v_eval.brand_fit_notes,
      'reliability_notes', v_eval.reliability_notes
    ),
    'final_status', v_eval.final_status,
    'final_reason', v_eval.final_reason,
    'evaluated_by', v_eval.evaluated_by,
    'evaluator_name', v_evaluator_name,
    'evaluated_at', v_eval.evaluated_at,
    'updated_at', v_eval.updated_at
  );
end;
$$;

revoke all on function public.get_influencer_evaluation_summary(uuid) from public, anon;
grant execute on function public.get_influencer_evaluation_summary(uuid) to authenticated;

create or replace function public.save_influencer_evaluation(
  p_influencer_id uuid,
  p_content_quality_rating smallint,
  p_brand_fit_rating smallint,
  p_reliability_rating smallint,
  p_content_quality_notes text,
  p_brand_fit_notes text,
  p_reliability_notes text,
  p_final_status text,
  p_final_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := private.current_user_role()::text;
  v_snapshot jsonb;
  v_score integer;
  v_suggested_status text;
  v_metrics jsonb;
  v_breakdown jsonb;
  v_now timestamptz := now();
begin
  if v_role not in ('admin','coordinator','reviewer') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not exists(select 1 from public.influencers i where i.id = p_influencer_id) then
    raise exception 'INFLUENCER_NOT_FOUND';
  end if;

  if p_content_quality_rating is not null and p_content_quality_rating not between 1 and 5 then
    raise exception 'INVALID_CONTENT_QUALITY_RATING';
  end if;
  if p_brand_fit_rating is not null and p_brand_fit_rating not between 1 and 5 then
    raise exception 'INVALID_BRAND_FIT_RATING';
  end if;
  if p_reliability_rating is not null and p_reliability_rating not between 1 and 5 then
    raise exception 'INVALID_RELIABILITY_RATING';
  end if;
  if p_final_status is not null and p_final_status not in ('qualified','needs_review','waitlist','not_qualified') then
    raise exception 'INVALID_FINAL_STATUS';
  end if;
  if length(coalesce(p_content_quality_notes, '')) > 2000 or length(coalesce(p_brand_fit_notes, '')) > 2000 or length(coalesce(p_reliability_notes, '')) > 2000 then
    raise exception 'EVALUATION_NOTE_TOO_LONG';
  end if;
  if length(coalesce(p_final_reason, '')) > 3000 then
    raise exception 'DECISION_REASON_TOO_LONG';
  end if;
  if p_final_status in ('waitlist','not_qualified') and nullif(trim(coalesce(p_final_reason, '')), '') is null then
    raise exception 'DECISION_REASON_REQUIRED';
  end if;

  v_snapshot := private.compute_influencer_evaluation(
    p_influencer_id,
    p_content_quality_rating,
    p_brand_fit_rating,
    p_reliability_rating
  );
  v_score := (v_snapshot->>'total_score')::integer;
  v_suggested_status := v_snapshot->>'suggested_status';
  v_metrics := v_snapshot->'metrics';
  v_breakdown := v_snapshot->'score_breakdown';

  insert into public.influencer_evaluations(
    influencer_id,
    content_quality_rating,
    brand_fit_rating,
    reliability_rating,
    content_quality_notes,
    brand_fit_notes,
    reliability_notes,
    total_score,
    suggested_status,
    final_status,
    final_reason,
    metrics_snapshot,
    score_breakdown,
    scoring_version,
    evaluated_by,
    evaluated_at
  ) values (
    p_influencer_id,
    p_content_quality_rating,
    p_brand_fit_rating,
    p_reliability_rating,
    nullif(trim(coalesce(p_content_quality_notes, '')), ''),
    nullif(trim(coalesce(p_brand_fit_notes, '')), ''),
    nullif(trim(coalesce(p_reliability_notes, '')), ''),
    v_score,
    v_suggested_status,
    p_final_status,
    nullif(trim(coalesce(p_final_reason, '')), ''),
    v_metrics,
    v_breakdown,
    v_snapshot->>'scoring_version',
    auth.uid(),
    v_now
  )
  on conflict (influencer_id) do update set
    content_quality_rating = excluded.content_quality_rating,
    brand_fit_rating = excluded.brand_fit_rating,
    reliability_rating = excluded.reliability_rating,
    content_quality_notes = excluded.content_quality_notes,
    brand_fit_notes = excluded.brand_fit_notes,
    reliability_notes = excluded.reliability_notes,
    total_score = excluded.total_score,
    suggested_status = excluded.suggested_status,
    final_status = excluded.final_status,
    final_reason = excluded.final_reason,
    metrics_snapshot = excluded.metrics_snapshot,
    score_breakdown = excluded.score_breakdown,
    scoring_version = excluded.scoring_version,
    evaluated_by = excluded.evaluated_by,
    evaluated_at = excluded.evaluated_at;

  insert into public.influencer_evaluation_history(
    influencer_id,
    content_quality_rating,
    brand_fit_rating,
    reliability_rating,
    content_quality_notes,
    brand_fit_notes,
    reliability_notes,
    total_score,
    suggested_status,
    final_status,
    final_reason,
    metrics_snapshot,
    score_breakdown,
    scoring_version,
    changed_by
  ) values (
    p_influencer_id,
    p_content_quality_rating,
    p_brand_fit_rating,
    p_reliability_rating,
    nullif(trim(coalesce(p_content_quality_notes, '')), ''),
    nullif(trim(coalesce(p_brand_fit_notes, '')), ''),
    nullif(trim(coalesce(p_reliability_notes, '')), ''),
    v_score,
    v_suggested_status,
    p_final_status,
    nullif(trim(coalesce(p_final_reason, '')), ''),
    v_metrics,
    v_breakdown,
    v_snapshot->>'scoring_version',
    auth.uid()
  );

  return public.get_influencer_evaluation_summary(p_influencer_id);
end;
$$;

revoke all on function public.save_influencer_evaluation(uuid,smallint,smallint,smallint,text,text,text,text,text) from public, anon;
grant execute on function public.save_influencer_evaluation(uuid,smallint,smallint,smallint,text,text,text,text,text) to authenticated;

commit;
