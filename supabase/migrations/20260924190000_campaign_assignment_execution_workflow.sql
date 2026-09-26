-- Dar Al Amirat Creator Community
-- Phase 09.1: Assignment + Brief + Execution Workflow
-- Safe/idempotent migration for campaign execution milestones.

begin;

alter table public.campaign_assignments
  add column if not exists assignment_brief_override text,
  add column if not exists product_required boolean not null default false,
  add column if not exists product_fulfillment_status text not null default 'not_required',
  add column if not exists product_dispatched_at timestamptz,
  add column if not exists product_received_at timestamptz,
  add column if not exists execution_notes text;

alter table public.campaign_assignments
  drop constraint if exists campaign_assignments_product_fulfillment_status_check;

alter table public.campaign_assignments
  add constraint campaign_assignments_product_fulfillment_status_check
  check (product_fulfillment_status in ('not_required','pending','dispatched','received'));

-- Infer product/PR requirement for existing assignments without disturbing progressed records.
update public.campaign_assignments a
set product_required = true,
    product_fulfillment_status = case
      when a.status in ('under_review','needs_changes','approved','payment_pending','paid','closed') then 'received'
      else 'pending'
    end,
    product_received_at = case
      when a.status in ('under_review','needs_changes','approved','payment_pending','paid','closed') then coalesce(a.product_received_at, a.updated_at, now())
      else a.product_received_at
    end
where a.product_required = false
  and (
    exists (
      select 1
      from public.campaigns c
      where c.id = a.campaign_id
        and coalesce(c.opportunity_type, '') = 'pr'
    )
    or exists (
      select 1
      from public.assignment_compensations ac
      where ac.assignment_id = a.id
        and ac.type = 'product'
    )
  );

create table if not exists public.assignment_execution_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  action text not null,
  status_before text,
  status_after text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists assignment_execution_events_assignment_idx
  on public.assignment_execution_events(assignment_id, created_at desc);

alter table public.assignment_execution_events enable row level security;

drop policy if exists assignment_execution_events_staff_all on public.assignment_execution_events;
create policy assignment_execution_events_staff_all
on public.assignment_execution_events
for all
to authenticated
using (private.is_staff())
with check (private.is_staff());

drop policy if exists assignment_execution_events_influencer_select on public.assignment_execution_events;
create policy assignment_execution_events_influencer_select
on public.assignment_execution_events
for select
to authenticated
using (
  exists (
    select 1
    from public.campaign_assignments a
    join public.influencers i on i.id = a.influencer_id
    where a.id = assignment_execution_events.assignment_id
      and i.user_id = auth.uid()
  )
);

grant select on public.assignment_execution_events to authenticated;

-- Community applications have already been initiated by the creator, so once staff accepts
-- the application the assignment should start at the brief stage rather than a fresh invite.
create or replace function private.normalize_community_application_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.source = 'community_application' then
    new.accepted_at := coalesce(new.accepted_at, now());
    if new.status = 'invited' then
      new.status := 'brief_pending';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists aa_community_application_assignment_initial_stage on public.campaign_assignments;
create trigger aa_community_application_assignment_initial_stage
before insert on public.campaign_assignments
for each row
execute function private.normalize_community_application_assignment();

-- Recalculate progress so Phase 09 milestones are visible in the coordinator workspace.
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
    + case when a.source = 'community_application' or a.invitation_status = 'sent' or a.invitation_sent_at is not null then 10 else 0 end
    + case when a.accepted_at is not null or a.status not in ('invited','rejected','cancelled') then 10 else 0 end
    + case when a.brief_sent_at is not null then 10 else 0 end
    + case
        when not a.product_required then 10
        when a.product_fulfillment_status = 'received' or a.product_received_at is not null then 10
        when a.product_fulfillment_status = 'dispatched' or a.product_dispatched_at is not null then 5
        else 0
      end
    + case when not a.has_contract or a.contract_reference is not null then 10 else 0 end
    + case when cs.total = 0 or cs.submitted >= cs.total then 15 else (15 * cs.submitted / nullif(cs.total,0)) end
    + case when cs.total = 0 or cs.approved >= cs.total then 10 else (10 * cs.approved / nullif(cs.total,0)) end
    + case when cs.total = 0 or cs.published >= cs.total then 10 else (10 * cs.published / nullif(cs.total,0)) end
    + case when a.status in ('payment_pending','paid','closed') then 5 else 0 end
  )
  from a cross join content_stats cs;
$$;

create or replace function public.update_assignment_execution_workflow(
  p_assignment_id uuid,
  p_action text,
  p_brief_override text default null,
  p_notes text default null,
  p_content_due_at timestamptz default null,
  p_publishing_date date default null,
  p_product_required boolean default null
)
returns public.campaign_assignments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.campaign_assignments%rowtype;
  v_before text;
  v_role text := coalesce(private.current_user_role()::text, '');
  v_campaign_brief_version integer;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_terminal boolean;
begin
  if v_role not in ('admin','coordinator') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into v_assignment
  from public.campaign_assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'ASSIGNMENT_NOT_FOUND';
  end if;

  v_before := v_assignment.status::text;
  v_terminal := v_before in ('under_review','needs_changes','approved','payment_pending','paid','closed','rejected','cancelled');

  if v_action = 'save_details' then
    update public.campaign_assignments
    set assignment_brief_override = nullif(trim(coalesce(p_brief_override,'')), ''),
        execution_notes = nullif(trim(coalesce(p_notes,'')), ''),
        content_due_at = p_content_due_at,
        publishing_date = p_publishing_date,
        product_required = coalesce(p_product_required, product_required),
        product_fulfillment_status = case
          when coalesce(p_product_required, product_required) = false then 'not_required'
          when product_fulfillment_status = 'not_required' then 'pending'
          else product_fulfillment_status
        end,
        product_dispatched_at = case when coalesce(p_product_required, product_required) = false then null else product_dispatched_at end,
        product_received_at = case when coalesce(p_product_required, product_required) = false then null else product_received_at end,
        status = case
          when status in ('under_review','needs_changes','approved','payment_pending','paid','closed','rejected','cancelled') then status
          when accepted_at is not null and brief_sent_at is not null and coalesce(p_product_required, product_required) = false then 'content_pending'::public.assignment_status
          when accepted_at is not null and brief_sent_at is not null and coalesce(p_product_required, product_required) = true and product_fulfillment_status <> 'received' then 'product_pending'::public.assignment_status
          when accepted_at is not null and brief_sent_at is not null and coalesce(p_product_required, product_required) = true and product_fulfillment_status = 'received' then 'content_pending'::public.assignment_status
          else status
        end
    where id = p_assignment_id
    returning * into v_assignment;

  elsif v_action = 'confirm_acceptance' then
    if v_before in ('rejected','cancelled','closed') then raise exception 'INVALID_WORKFLOW_TRANSITION'; end if;
    update public.campaign_assignments
    set accepted_at = coalesce(accepted_at, now()),
        status = case
          when brief_sent_at is null then 'brief_pending'::public.assignment_status
          when product_required and product_fulfillment_status <> 'received' then 'product_pending'::public.assignment_status
          else 'content_pending'::public.assignment_status
        end
    where id = p_assignment_id
    returning * into v_assignment;

  elsif v_action = 'send_brief' then
    if v_before in ('rejected','cancelled','closed') then raise exception 'INVALID_WORKFLOW_TRANSITION'; end if;
    select c.brief_version into v_campaign_brief_version from public.campaigns c where c.id = v_assignment.campaign_id;
    update public.campaign_assignments
    set brief_sent_at = coalesce(brief_sent_at, now()),
        brief_version_sent = coalesce(v_campaign_brief_version, brief_version_sent),
        status = case
          when accepted_at is null and source <> 'community_application' then status
          when product_required and product_fulfillment_status <> 'received' then 'product_pending'::public.assignment_status
          else 'content_pending'::public.assignment_status
        end
    where id = p_assignment_id
    returning * into v_assignment;

  elsif v_action = 'product_pending' then
    if v_terminal then raise exception 'INVALID_WORKFLOW_TRANSITION'; end if;
    update public.campaign_assignments
    set product_required = true,
        product_fulfillment_status = 'pending',
        product_dispatched_at = null,
        product_received_at = null,
        status = case when accepted_at is not null and brief_sent_at is not null then 'product_pending'::public.assignment_status else status end
    where id = p_assignment_id
    returning * into v_assignment;

  elsif v_action = 'product_dispatched' then
    if v_terminal then raise exception 'INVALID_WORKFLOW_TRANSITION'; end if;
    update public.campaign_assignments
    set product_required = true,
        product_fulfillment_status = 'dispatched',
        product_dispatched_at = coalesce(product_dispatched_at, now()),
        status = case when accepted_at is not null and brief_sent_at is not null then 'product_pending'::public.assignment_status else status end
    where id = p_assignment_id
    returning * into v_assignment;

  elsif v_action = 'product_received' then
    if v_before in ('rejected','cancelled','closed') then raise exception 'INVALID_WORKFLOW_TRANSITION'; end if;
    update public.campaign_assignments
    set product_required = true,
        product_fulfillment_status = 'received',
        product_dispatched_at = coalesce(product_dispatched_at, now()),
        product_received_at = coalesce(product_received_at, now()),
        status = case
          when accepted_at is not null and brief_sent_at is not null and v_before not in ('under_review','needs_changes','approved','payment_pending','paid','closed')
            then 'content_pending'::public.assignment_status
          else status
        end
    where id = p_assignment_id
    returning * into v_assignment;

  elsif v_action = 'product_not_required' then
    if v_before in ('rejected','cancelled','closed') then raise exception 'INVALID_WORKFLOW_TRANSITION'; end if;
    update public.campaign_assignments
    set product_required = false,
        product_fulfillment_status = 'not_required',
        product_dispatched_at = null,
        product_received_at = null,
        status = case
          when accepted_at is not null and brief_sent_at is not null and v_before not in ('under_review','needs_changes','approved','payment_pending','paid','closed')
            then 'content_pending'::public.assignment_status
          else status
        end
    where id = p_assignment_id
    returning * into v_assignment;

  elsif v_action = 'content_pending' then
    if v_before in ('rejected','cancelled','closed') then raise exception 'INVALID_WORKFLOW_TRANSITION'; end if;
    if v_assignment.accepted_at is null then raise exception 'ACCEPTANCE_REQUIRED'; end if;
    if v_assignment.brief_sent_at is null then raise exception 'BRIEF_REQUIRED'; end if;
    if v_assignment.product_required and v_assignment.product_fulfillment_status <> 'received' then raise exception 'PRODUCT_RECEIPT_REQUIRED'; end if;
    update public.campaign_assignments
    set status = 'content_pending'::public.assignment_status
    where id = p_assignment_id
    returning * into v_assignment;

  else
    raise exception 'INVALID_WORKFLOW_ACTION';
  end if;

  insert into public.assignment_execution_events(
    assignment_id, action, status_before, status_after, notes, metadata, created_by
  ) values (
    p_assignment_id,
    v_action,
    v_before,
    v_assignment.status::text,
    nullif(trim(coalesce(p_notes,'')), ''),
    jsonb_build_object(
      'brief_sent_at', v_assignment.brief_sent_at,
      'product_required', v_assignment.product_required,
      'product_fulfillment_status', v_assignment.product_fulfillment_status,
      'content_due_at', v_assignment.content_due_at,
      'publishing_date', v_assignment.publishing_date
    ),
    auth.uid()
  );

  insert into public.activity_logs(actor_id, entity_type, entity_id, action, metadata)
  values (
    auth.uid(),
    'campaign_assignment',
    p_assignment_id,
    'assignment_execution_workflow_updated',
    jsonb_build_object('workflow_action', v_action, 'status_before', v_before, 'status_after', v_assignment.status::text)
  );

  perform public.refresh_assignment_progress(p_assignment_id);
  select * into v_assignment from public.campaign_assignments where id = p_assignment_id;
  return v_assignment;
end;
$$;

revoke all on function public.update_assignment_execution_workflow(uuid,text,text,text,timestamptz,date,boolean) from public;
grant execute on function public.update_assignment_execution_workflow(uuid,text,text,text,timestamptz,date,boolean) to authenticated;

-- Backfill current progress with the Phase 09 milestones.
update public.campaign_assignments a
set coordinator_progress = public.calculate_assignment_progress(a.id);

notify pgrst, 'reload schema';
commit;
