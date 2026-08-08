-- Campaign ownership, future marketing-project readiness, measurable targets,
-- and automatic campaign progress/completion.

alter table public.campaigns
  add column if not exists campaign_owner_type text not null default 'internal',
  add column if not exists campaign_category text not null default 'influencer_campaign',
  add column if not exists marketing_project_id uuid null,
  add column if not exists external_organization_name text null,
  add column if not exists external_contact_name text null,
  add column if not exists external_contact_mobile text null,
  add column if not exists external_contact_email text null,
  add column if not exists progress_percentage numeric(5,2) not null default 0,
  add column if not exists target_completion_percentage numeric(5,2) not null default 0,
  add column if not exists execution_completion_percentage numeric(5,2) not null default 0,
  add column if not exists auto_complete_enabled boolean not null default false,
  add column if not exists completion_mode text not null default 'all_required_targets_and_assignments',
  add column if not exists auto_completed_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists completion_notes text null,
  add column if not exists progress_review_required boolean not null default false;

alter table public.campaigns drop constraint if exists campaigns_owner_type_check;
alter table public.campaigns add constraint campaigns_owner_type_check
  check (campaign_owner_type in ('internal','external_supplier','joint'));

alter table public.campaigns drop constraint if exists campaigns_category_check;
alter table public.campaigns add constraint campaigns_category_check
  check (campaign_category in ('influencer_campaign','product_launch','brand_awareness','sales_activation','store_activation','seasonal_campaign','event_support','mixed'));

alter table public.campaigns drop constraint if exists campaigns_completion_mode_check;
alter table public.campaigns add constraint campaigns_completion_mode_check
  check (completion_mode in ('manual','all_required_targets','any_primary_target','all_required_targets_and_assignments'));

create table if not exists public.campaign_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  target_type text not null,
  target_label text not null,
  target_value numeric(18,2) not null check (target_value > 0),
  current_value numeric(18,2) not null default 0 check (current_value >= 0),
  weight numeric(8,3) not null default 1 check (weight > 0),
  measurement_source text not null default 'automatic',
  completion_rule text not null default 'greater_or_equal',
  is_required boolean not null default true,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  completed_at timestamptz null,
  created_by uuid null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_targets_type_check check (target_type in (
    'influencers_count','accepted_influencers_count','published_content_count',
    'approved_content_count','views','likes','comments','shares','saves',
    'engagement','promo_code_uses','sales_amount','reach','attendance','custom'
  )),
  constraint campaign_targets_source_check check (measurement_source in ('automatic','manual','external_import')),
  constraint campaign_targets_rule_check check (completion_rule in ('greater_or_equal','less_or_equal','equal'))
);

create index if not exists campaign_targets_campaign_idx on public.campaign_targets(campaign_id, is_active);
create unique index if not exists campaign_targets_unique_label_idx on public.campaign_targets(campaign_id, lower(target_label)) where is_active;

alter table public.campaign_targets enable row level security;
drop policy if exists campaign_targets_select on public.campaign_targets;
create policy campaign_targets_select on public.campaign_targets for select to authenticated
  using (private.is_staff());
drop policy if exists campaign_targets_write on public.campaign_targets;
create policy campaign_targets_write on public.campaign_targets for all to authenticated
  using (private.is_staff()) with check (private.is_staff());

create or replace view public.campaign_live_metrics as
select
  c.id as campaign_id,
  count(distinct a.id)::numeric as influencers_count,
  count(distinct a.id) filter (where a.status not in ('invited','rejected','cancelled'))::numeric as accepted_influencers_count,
  count(distinct ci.id) filter (where ci.status in ('approved','published'))::numeric as approved_content_count,
  count(distinct ci.id) filter (where ci.status = 'published' or ci.publication_verified_at is not null or ci.post_url is not null)::numeric as published_content_count,
  count(distinct a.id) filter (where a.status not in ('paid','closed','rejected','cancelled'))::numeric as open_assignments_count,
  count(distinct a.id) filter (where a.status in ('paid','closed','rejected','cancelled'))::numeric as closed_assignments_count,
  count(distinct a.id)::numeric as total_assignments_count
from public.campaigns c
left join public.campaign_assignments a on a.campaign_id = c.id
left join public.assignment_platforms ap on ap.assignment_id = a.id
left join public.content_items ci on ci.assignment_platform_id = ap.id
group by c.id;

create or replace function public.refresh_campaign_progress(p_campaign_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_metrics public.campaign_live_metrics%rowtype;
  v_target_pct numeric := 0;
  v_execution_pct numeric := 0;
  v_progress numeric := 0;
  v_required_count integer := 0;
  v_required_complete integer := 0;
  v_primary_complete integer := 0;
  v_open_assignments numeric := 0;
  v_auto boolean := false;
  v_mode text := 'manual';
  v_status public.campaign_status;
  v_should_complete boolean := false;
begin
  select * into v_metrics from public.campaign_live_metrics where campaign_id = p_campaign_id;
  if not found then return; end if;

  update public.campaign_targets t
  set current_value = case t.target_type
      when 'influencers_count' then v_metrics.influencers_count
      when 'accepted_influencers_count' then v_metrics.accepted_influencers_count
      when 'approved_content_count' then v_metrics.approved_content_count
      when 'published_content_count' then v_metrics.published_content_count
      else t.current_value
    end,
    updated_at = now()
  where t.campaign_id = p_campaign_id
    and t.is_active
    and t.measurement_source = 'automatic';

  update public.campaign_targets
  set completed_at = case
      when completion_rule = 'greater_or_equal' and current_value >= target_value then coalesce(completed_at, now())
      when completion_rule = 'less_or_equal' and current_value <= target_value then coalesce(completed_at, now())
      when completion_rule = 'equal' and current_value = target_value then coalesce(completed_at, now())
      else null
    end,
    updated_at = now()
  where campaign_id = p_campaign_id and is_active;

  select
    coalesce(sum(least(100, greatest(0, current_value / nullif(target_value, 0) * 100)) * weight) / nullif(sum(weight), 0), 0),
    count(*) filter (where is_required),
    count(*) filter (where is_required and completed_at is not null),
    count(*) filter (where is_primary and completed_at is not null)
  into v_target_pct, v_required_count, v_required_complete, v_primary_complete
  from public.campaign_targets
  where campaign_id = p_campaign_id and is_active;

  v_execution_pct := case
    when coalesce(v_metrics.total_assignments_count, 0) = 0 then 0
    else least(100, greatest(0, v_metrics.closed_assignments_count / v_metrics.total_assignments_count * 100))
  end;
  v_open_assignments := coalesce(v_metrics.open_assignments_count, 0);
  v_progress := round((v_target_pct * 0.70 + v_execution_pct * 0.30)::numeric, 2);

  select auto_complete_enabled, completion_mode, status
  into v_auto, v_mode, v_status
  from public.campaigns where id = p_campaign_id for update;

  v_should_complete := v_auto and case v_mode
    when 'all_required_targets' then v_required_count > 0 and v_required_complete = v_required_count
    when 'any_primary_target' then v_primary_complete > 0
    when 'all_required_targets_and_assignments' then v_required_count > 0 and v_required_complete = v_required_count and v_open_assignments = 0
    else false
  end;

  update public.campaigns
  set target_completion_percentage = round(v_target_pct, 2),
      execution_completion_percentage = round(v_execution_pct, 2),
      progress_percentage = v_progress,
      status = case when v_should_complete and status not in ('completed','archived') then 'completed'::public.campaign_status else status end,
      completed_at = case when v_should_complete then coalesce(completed_at, now()) else completed_at end,
      auto_completed_at = case when v_should_complete then coalesce(auto_completed_at, now()) else auto_completed_at end,
      progress_review_required = case when status = 'completed' and not v_should_complete and auto_completed_at is not null then true else progress_review_required end,
      updated_at = now()
  where id = p_campaign_id;

  if v_should_complete and v_status not in ('completed','archived') then
    insert into public.activity_logs(actor_id, entity_type, entity_id, action, metadata)
    values (null, 'campaign', p_campaign_id, 'campaign_auto_completed', jsonb_build_object('progress', v_progress, 'mode', v_mode));
  end if;
end;
$$;

create or replace function public.campaign_progress_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_campaign_id uuid;
begin
  if tg_table_name = 'campaign_targets' then
    v_campaign_id := coalesce(new.campaign_id, old.campaign_id);
  elsif tg_table_name = 'campaign_assignments' then
    v_campaign_id := coalesce(new.campaign_id, old.campaign_id);
  elsif tg_table_name = 'content_items' then
    select a.campaign_id into v_campaign_id
    from public.assignment_platforms ap join public.campaign_assignments a on a.id = ap.assignment_id
    where ap.id = coalesce(new.assignment_platform_id, old.assignment_platform_id);
  end if;
  if v_campaign_id is not null then perform public.refresh_campaign_progress(v_campaign_id); end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_campaign_targets_progress on public.campaign_targets;
create trigger trg_campaign_targets_progress after insert or update or delete on public.campaign_targets
for each row execute function public.campaign_progress_trigger();

drop trigger if exists trg_campaign_assignments_progress on public.campaign_assignments;
create trigger trg_campaign_assignments_progress after insert or update or delete on public.campaign_assignments
for each row execute function public.campaign_progress_trigger();

drop trigger if exists trg_content_items_campaign_progress on public.content_items;
create trigger trg_content_items_campaign_progress after insert or update or delete on public.content_items
for each row execute function public.campaign_progress_trigger();

-- Initial calculation for existing campaigns.
do $$ declare r record; begin
  for r in select id from public.campaigns loop
    perform public.refresh_campaign_progress(r.id);
  end loop;
end $$;

notify pgrst, 'reload schema';
