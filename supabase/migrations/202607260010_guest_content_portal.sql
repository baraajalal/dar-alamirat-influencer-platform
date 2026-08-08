-- Dar Al Amirat Influencer Portal
-- Guest assignment access, versioned content delivery, publication links and review workflow.

-- Enum values are added before the transaction so PostgreSQL can safely use the updated type.
alter type public.user_role add value if not exists 'reviewer';
alter type public.user_role add value if not exists 'viewer';

begin;

alter table public.submission_links
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists max_attempts integer not null default 8,
  add column if not exists locked_at timestamptz,
  add column if not exists last_opened_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references public.profiles(id) on delete set null;

alter table public.submission_links
  drop constraint if exists submission_links_attempts_check;
alter table public.submission_links
  add constraint submission_links_attempts_check
  check (failed_attempts >= 0 and max_attempts between 3 and 20);

create index if not exists submission_links_assignment_active_idx
  on public.submission_links (assignment_id, is_active, expires_at desc);

create table if not exists public.guest_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  submission_link_id uuid not null references public.submission_links(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create index if not exists guest_portal_sessions_link_expiry_idx
  on public.guest_portal_sessions (submission_link_id, expires_at desc);

create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  version_no integer not null check (version_no > 0),
  file_path text,
  external_url text,
  original_filename text,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  notes text,
  review_status text not null default 'submitted'
    check (review_status in ('submitted', 'needs_changes', 'approved', 'rejected')),
  submitted_via text not null default 'guest_link'
    check (submitted_via in ('guest_link', 'staff', 'influencer_account')),
  submitted_by_profile uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (content_item_id, version_no),
  check (
    nullif(trim(coalesce(file_path, '')), '') is not null
    or nullif(trim(coalesce(external_url, '')), '') is not null
  )
);

create index if not exists content_versions_item_created_idx
  on public.content_versions (content_item_id, version_no desc);

create table if not exists public.publication_submissions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  platform text not null,
  post_url text not null,
  published_at timestamptz,
  screenshot_path text,
  submitter_notes text,
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'needs_changes', 'rejected')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publication_submissions_item_status_idx
  on public.publication_submissions (content_item_id, status, submitted_at desc);

alter table public.content_items
  add column if not exists latest_version_id uuid references public.content_versions(id) on delete set null,
  add column if not exists publication_verified_at timestamptz,
  add column if not exists publication_verified_by uuid references public.profiles(id) on delete set null;

create or replace function public.set_publication_submission_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists publication_submissions_set_updated_at on public.publication_submissions;
create trigger publication_submissions_set_updated_at
before update on public.publication_submissions
for each row execute function public.set_publication_submission_updated_at();

alter table public.guest_portal_sessions enable row level security;
alter table public.content_versions enable row level security;
alter table public.publication_submissions enable row level security;

-- Guest sessions are intentionally service-role only. No anon/authenticated policies.
revoke all on public.guest_portal_sessions from anon, authenticated;

grant select on public.content_versions to authenticated;
grant select on public.publication_submissions to authenticated;

create or replace function private.can_view_campaign_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role::text in ('admin', 'coordinator', 'reviewer', 'finance', 'viewer')
      from public.profiles p
      where p.id = auth.uid() and p.is_active = true
    ),
    false
  );
$$;

create or replace function private.can_review_campaign_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role::text in ('admin', 'coordinator', 'reviewer')
      from public.profiles p
      where p.id = auth.uid() and p.is_active = true
    ),
    false
  );
$$;

revoke all on function private.can_view_campaign_content() from public;
revoke all on function private.can_review_campaign_content() from public;
grant execute on function private.can_view_campaign_content() to authenticated;
grant execute on function private.can_review_campaign_content() to authenticated;

-- Add read access for dedicated reviewer/viewer roles without broadening existing staff write policies.
drop policy if exists influencers_campaign_content_roles_select on public.influencers;
create policy influencers_campaign_content_roles_select
on public.influencers for select to authenticated
using ((select private.can_view_campaign_content()));

drop policy if exists social_campaign_content_roles_select on public.social_accounts;
create policy social_campaign_content_roles_select
on public.social_accounts for select to authenticated
using ((select private.can_view_campaign_content()));

drop policy if exists assignments_campaign_content_roles_select on public.campaign_assignments;
create policy assignments_campaign_content_roles_select
on public.campaign_assignments for select to authenticated
using ((select private.can_view_campaign_content()));

drop policy if exists assignment_platforms_campaign_content_roles_select on public.assignment_platforms;
create policy assignment_platforms_campaign_content_roles_select
on public.assignment_platforms for select to authenticated
using ((select private.can_view_campaign_content()));

drop policy if exists content_items_campaign_content_roles_select on public.content_items;
create policy content_items_campaign_content_roles_select
on public.content_items for select to authenticated
using ((select private.can_view_campaign_content()));

drop policy if exists content_reviews_campaign_content_roles_select on public.content_reviews;
create policy content_reviews_campaign_content_roles_select
on public.content_reviews for select to authenticated
using ((select private.can_view_campaign_content()));

drop policy if exists content_versions_staff_select on public.content_versions;
create policy content_versions_staff_select
on public.content_versions
for select
to authenticated
using ((select private.can_view_campaign_content()));

drop policy if exists publication_submissions_staff_select on public.publication_submissions;
create policy publication_submissions_staff_select
on public.publication_submissions
for select
to authenticated
using ((select private.can_view_campaign_content()));

-- Tighten the after-publish payment rule: every required content item must be published and verified.
create or replace function public.submit_payment_for_approval(
  p_payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_payment public.payments%rowtype;
  v_assignment public.campaign_assignments%rowtype;
  v_all_publish_links boolean := false;
begin
  v_role := private.current_payment_role();
  if v_role is null or v_role not in ('admin', 'coordinator', 'finance') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.status not in ('draft', 'awaiting_approval') then
    raise exception 'PAYMENT_NOT_SUBMITTABLE';
  end if;

  select * into v_assignment
  from public.campaign_assignments
  where id = v_payment.assignment_id;

  if v_assignment.payment_timing = 'before_publish' and not v_assignment.has_contract then
    raise exception 'CONTRACT_REQUIRED';
  end if;

  if coalesce(v_assignment.requires_content, true)
     and coalesce(v_assignment.payment_timing, 'after_publish') = 'after_publish' then
    select
      count(*) > 0
      and bool_and(
        ci.status = 'published'
        and nullif(trim(coalesce(ci.post_url, '')), '') is not null
        and ci.publication_verified_at is not null
      )
    into v_all_publish_links
    from public.content_items ci
    join public.assignment_platforms ap on ap.id = ci.assignment_platform_id
    where ap.assignment_id = v_assignment.id;

    if not coalesce(v_all_publish_links, false) then
      raise exception 'PUBLISH_LINK_REQUIRED';
    end if;
  end if;

  update public.payments
  set status = 'awaiting_approval',
      submitted_by = auth.uid(),
      submitted_at = now(),
      returned_by = null,
      returned_at = null,
      return_reason = null,
      rejected_by = null,
      rejected_at = null,
      rejection_reason = null,
      updated_at = now()
  where id = p_payment_id;

  insert into public.activity_logs (actor_id, entity_type, entity_id, action, metadata)
  values (auth.uid(), 'payment', p_payment_id, 'payment_submitted_for_approval', '{}'::jsonb);
end;
$$;

revoke all on function public.submit_payment_for_approval(uuid) from public;
grant execute on function public.submit_payment_for_approval(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'campaign-content',
    'campaign-content',
    false,
    52428800,
    array[
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'video/mp4', 'video/quicktime', 'video/webm',
      'application/pdf'
    ]
  ),
  (
    'publication-proofs',
    'publication-proofs',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;

notify pgrst, 'reload schema';
