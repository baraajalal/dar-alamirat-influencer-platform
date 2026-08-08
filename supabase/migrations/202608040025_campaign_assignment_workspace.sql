begin;

alter table public.campaigns
  add column if not exists brief_file_path text null,
  add column if not exists brief_public_url text null,
  add column if not exists brief_version integer not null default 1,
  add column if not exists brief_updated_at timestamptz null;

alter table public.campaign_assignments
  add column if not exists assigned_by uuid null references public.profiles(id),
  add column if not exists invitation_status text not null default 'not_sent',
  add column if not exists invitation_sent_at timestamptz null,
  add column if not exists invitation_sent_by uuid null references public.profiles(id),
  add column if not exists invitation_channel text null,
  add column if not exists brief_version_sent integer null,
  add column if not exists brief_sent_at timestamptz null,
  add column if not exists transferred_from_assignment_id uuid null references public.campaign_assignments(id),
  add column if not exists transfer_reason text null,
  add column if not exists coordinator_progress numeric not null default 0,
  add column if not exists last_follow_up_at timestamptz null,
  add column if not exists next_follow_up_at timestamptz null;

update public.campaign_assignments
set assigned_by = coalesce(assigned_by, coordinator_id)
where assigned_by is null;

create table if not exists public.assignment_invitations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  channel text not null default 'whatsapp',
  recipient_mobile text not null,
  message_snapshot text not null,
  brief_version integer null,
  brief_url text null,
  sent_by uuid null references public.profiles(id),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists assignment_invitations_assignment_idx
  on public.assignment_invitations(assignment_id, sent_at desc);

create table if not exists public.assignment_follow_ups (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  follow_up_type text not null default 'general',
  notes text null,
  next_follow_up_at timestamptz null,
  created_by uuid null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_transfer_history (
  id uuid primary key default gen_random_uuid(),
  old_assignment_id uuid not null references public.campaign_assignments(id),
  new_assignment_id uuid null references public.campaign_assignments(id),
  from_campaign_id uuid not null references public.campaigns(id),
  to_campaign_id uuid not null references public.campaigns(id),
  reason text not null,
  transferred_by uuid null references public.profiles(id),
  created_at timestamptz not null default now()
);

create or replace function public.calculate_assignment_progress(p_assignment_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with a as (
    select ca.*
    from public.campaign_assignments ca
    where ca.id = p_assignment_id
  ), content_stats as (
    select
      count(*) filter (where ci.submitted_at is not null)::numeric as submitted,
      count(*) filter (where ci.status in ('approved','published'))::numeric as approved,
      count(*) filter (where ci.status = 'published' or ci.publication_verified_at is not null)::numeric as published,
      count(*)::numeric as total
    from public.content_items ci
    join public.assignment_platforms ap on ap.id = ci.assignment_platform_id
    where ap.assignment_id = p_assignment_id
  )
  select least(100,
      case when a.id is not null then 10 else 0 end
    + case when a.invitation_status = 'sent' or a.invitation_sent_at is not null then 10 else 0 end
    + case when a.accepted_at is not null or a.status not in ('invited','rejected','cancelled') then 15 else 0 end
    + case when not a.has_contract or a.contract_reference is not null then 10 else 0 end
    + case when cs.total = 0 or cs.submitted >= cs.total then 20 else (20 * cs.submitted / nullif(cs.total,0)) end
    + case when cs.total = 0 or cs.approved >= cs.total then 15 else (15 * cs.approved / nullif(cs.total,0)) end
    + case when cs.total = 0 or cs.published >= cs.total then 15 else (15 * cs.published / nullif(cs.total,0)) end
    + case when a.status in ('payment_pending','paid','closed') then 5 else 0 end
  )
  from a cross join content_stats cs;
$$;

create or replace function public.refresh_assignment_progress(p_assignment_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_progress numeric;
begin
  v_progress := public.calculate_assignment_progress(p_assignment_id);
  update public.campaign_assignments
  set coordinator_progress = coalesce(v_progress,0), updated_at = now()
  where id = p_assignment_id;
  return coalesce(v_progress,0);
end;
$$;

create or replace view public.coordinator_assignment_dashboard as
select
  ca.coordinator_id,
  count(*)::int as total_assignments,
  count(distinct ca.influencer_id)::int as influencer_count,
  count(*) filter (where ca.status not in ('paid','closed','rejected','cancelled'))::int as active_assignments,
  count(*) filter (where ca.invitation_status = 'sent' or ca.invitation_sent_at is not null)::int as invitations_sent,
  count(*) filter (where ca.accepted_at is not null)::int as accepted_count,
  count(*) filter (where ca.declined_at is not null or ca.status = 'rejected')::int as declined_count,
  count(*) filter (where ca.has_contract and ca.contract_reference is not null)::int as completed_contracts,
  count(*) filter (where ca.status in ('paid','closed'))::int as completed_assignments,
  round(coalesce(avg(ca.coordinator_progress),0),2) as average_progress
from public.campaign_assignments ca
group by ca.coordinator_id;

create or replace view public.coordinator_campaign_progress as
select
  ca.coordinator_id,
  ca.campaign_id,
  c.name as campaign_name,
  c.brand,
  c.status as campaign_status,
  c.start_date,
  c.end_date,
  c.progress_percentage as campaign_progress,
  count(*)::int as assigned_count,
  count(*) filter (where ca.accepted_at is not null)::int as accepted_count,
  count(*) filter (where ca.status in ('paid','closed'))::int as completed_count,
  round(coalesce(avg(ca.coordinator_progress),0),2) as coordinator_progress
from public.campaign_assignments ca
join public.campaigns c on c.id = ca.campaign_id
group by ca.coordinator_id, ca.campaign_id, c.name, c.brand, c.status, c.start_date, c.end_date, c.progress_percentage;

alter table public.assignment_invitations enable row level security;
alter table public.assignment_follow_ups enable row level security;
alter table public.assignment_transfer_history enable row level security;

drop policy if exists assignment_invitations_staff_all on public.assignment_invitations;
create policy assignment_invitations_staff_all on public.assignment_invitations
for all to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists assignment_follow_ups_staff_all on public.assignment_follow_ups;
create policy assignment_follow_ups_staff_all on public.assignment_follow_ups
for all to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists assignment_transfer_history_staff_all on public.assignment_transfer_history;
create policy assignment_transfer_history_staff_all on public.assignment_transfer_history
for all to authenticated
using (private.is_staff())
with check (private.is_staff());

notify pgrst, 'reload schema';
commit;
