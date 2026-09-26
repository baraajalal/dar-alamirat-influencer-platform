-- Beta phase 02
-- Versioned legal consent + canonical influencer portal review workflow.
begin;

create table if not exists public.influencer_legal_consents (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  document_type text not null check (document_type in ('terms', 'privacy')),
  document_version text not null,
  locale text not null default 'ar' check (locale in ('ar', 'en')),
  accepted_at timestamptz not null default now(),
  source text not null default 'public_registration',
  created_at timestamptz not null default now(),
  constraint influencer_legal_consents_unique_version
    unique (influencer_id, document_type, document_version)
);

create index if not exists influencer_legal_consents_influencer_idx
  on public.influencer_legal_consents (influencer_id, accepted_at desc);

alter table public.influencer_legal_consents enable row level security;

drop policy if exists influencer_legal_consents_staff_select
  on public.influencer_legal_consents;
create policy influencer_legal_consents_staff_select
on public.influencer_legal_consents
for select
to authenticated
using (
  (select private.is_staff())
  or exists (
    select 1
    from public.influencers i
    where i.id = influencer_id
      and i.user_id = (select auth.uid())
  )
);

revoke insert, update, delete on public.influencer_legal_consents from anon, authenticated;
grant select on public.influencer_legal_consents to authenticated;

alter table public.portal_access_requests
  add column if not exists review_started_at timestamptz;

-- Convert the old status vocabulary once, then enforce the canonical workflow.
alter table public.portal_access_requests
  drop constraint if exists portal_access_requests_status_check;

update public.portal_access_requests
set status = 'submitted'
where status = 'pending';

update public.portal_access_requests
set status = 'activated'
where status = 'completed';

alter table public.portal_access_requests
  alter column status set default 'submitted';

alter table public.portal_access_requests
  add constraint portal_access_requests_status_check
  check (status in (
    'submitted',
    'under_review',
    'needs_changes',
    'approved',
    'rejected',
    'activated',
    'cancelled'
  ));

drop index if exists portal_access_requests_one_open_idx;
create unique index portal_access_requests_one_open_idx
  on public.portal_access_requests (influencer_id)
  where status in ('submitted', 'under_review', 'needs_changes', 'approved');

create or replace function public.link_influencer_portal_invitation(
  p_request_id uuid,
  p_influencer_id uuid,
  p_user_id uuid,
  p_approved_by uuid,
  p_email text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_mobile text;
  v_request_status text;
begin
  select full_name, mobile_e164
  into v_name, v_mobile
  from public.influencers
  where id = p_influencer_id
    and user_id is null
  for update;

  if v_name is null then
    raise exception 'INFLUENCER_ALREADY_LINKED_OR_MISSING';
  end if;

  select status
  into v_request_status
  from public.portal_access_requests
  where id = p_request_id
    and influencer_id = p_influencer_id
  for update;

  if v_request_status is null or v_request_status <> 'approved' then
    raise exception 'ACCESS_REQUEST_NOT_APPROVED';
  end if;

  insert into public.profiles (
    id,
    role,
    full_name,
    mobile_e164,
    is_active
  )
  values (
    p_user_id,
    'influencer'::public.user_role,
    v_name,
    v_mobile,
    true
  );

  update public.influencers
  set
    user_id = p_user_id,
    email = lower(trim(p_email)),
    account_status = 'invited',
    claimed_at = now(),
    approved_by = p_approved_by,
    approved_at = coalesce(approved_at, now()),
    updated_at = now()
  where id = p_influencer_id;

  update public.portal_access_requests
  set
    status = 'approved',
    reviewed_by = coalesce(reviewed_by, p_approved_by),
    reviewed_at = coalesce(reviewed_at, now()),
    updated_at = now()
  where id = p_request_id;

  insert into public.activity_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    p_approved_by,
    'influencer',
    p_influencer_id,
    'portal_invitation_linked',
    jsonb_build_object(
      'request_id', p_request_id,
      'invited_user_id', p_user_id
    )
  );
end;
$$;

create or replace function public.complete_influencer_portal_activation(
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_influencer_id uuid;
begin
  update public.influencers
  set
    account_status = 'active',
    portal_access_required = false,
    updated_at = now()
  where user_id = p_user_id
  returning id into v_influencer_id;

  if v_influencer_id is null then
    raise exception 'INFLUENCER_PROFILE_NOT_FOUND';
  end if;

  update public.portal_access_requests
  set
    status = 'activated',
    updated_at = now()
  where influencer_id = v_influencer_id
    and status = 'approved';

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
    v_influencer_id,
    'portal_account_activated',
    '{}'::jsonb
  );

  return v_influencer_id;
end;
$$;

commit;
notify pgrst, 'reload schema';
