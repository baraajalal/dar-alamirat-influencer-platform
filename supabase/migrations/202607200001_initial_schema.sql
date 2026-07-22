-- Dar Al Ameerat Influencer Campaign Portal
-- Initial Supabase/PostgreSQL schema for the 10-day MVP.
-- Run in a NEW Supabase project. Review policies before production use.

create extension if not exists pgcrypto;

create type public.user_role as enum ('admin', 'coordinator', 'finance', 'influencer');
create type public.platform_type as enum ('instagram', 'tiktok', 'snapchat', 'youtube', 'x', 'facebook', 'other');
create type public.campaign_status as enum ('draft', 'active', 'paused', 'completed', 'archived');
create type public.assignment_status as enum (
  'invited', 'accepted', 'product_pending', 'brief_pending', 'content_pending',
  'under_review', 'needs_changes', 'approved', 'payment_pending', 'paid',
  'closed', 'rejected', 'cancelled'
);
create type public.execution_type as enum ('home', 'in_branch', 'remote');
create type public.payment_type as enum ('bank_transfer', 'voucher', 'product', 'commission', 'other');
create type public.content_status as enum ('draft', 'submitted', 'under_review', 'needs_changes', 'approved', 'rejected', 'published');
create type public.review_decision as enum ('approve', 'needs_changes', 'reject');
create type public.payment_status as enum ('draft', 'awaiting_approval', 'ready_for_finance', 'partially_paid', 'paid', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'influencer',
  full_name text not null,
  mobile_e164 text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mobile_e164)
);

create table public.influencers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  full_name text not null,
  mobile_e164 text not null unique,
  email text,
  city text,
  country text not null default 'Saudi Arabia',
  mawthooq_status boolean,
  preferred_ad_categories text[] not null default '{}',
  content_style_preferences text[] not null default '{}',
  consent_review_at timestamptz,
  consent_marketing_at timestamptz,
  consent_terms_at timestamptz,
  source text not null default 'form',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep sensitive identity and banking data separate from the general profile.
create table public.influencer_financial_profiles (
  influencer_id uuid primary key references public.influencers(id) on delete cascade,
  national_id text,
  bank_name text,
  iban text,
  account_holder_name text,
  mawthooq_number text,
  mawthooq_expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  platform public.platform_type not null,
  username text not null,
  profile_url text,
  followers_count bigint check (followers_count is null or followers_count >= 0),
  average_likes numeric(14,2),
  average_views numeric(14,2),
  average_comments numeric(14,2),
  engagement_rate numeric(8,4),
  female_audience numeric(5,2),
  male_audience numeric(5,2),
  audience_main_city text,
  audience_main_country text,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (influencer_id, platform, username)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text,
  product text,
  campaign_type text,
  brief text,
  start_date date,
  end_date date,
  status public.campaign_status not null default 'draft',
  manager_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, start_date)
);

create table public.campaign_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  coordinator_id uuid references public.profiles(id) on delete set null,
  status public.assignment_status not null default 'invited',
  execution_type public.execution_type,
  content_due_at timestamptz,
  publishing_date date,
  branch text,
  order_number text,
  order_code text,
  order_invoice_amount numeric(12,2),
  promo_code text,
  coordinator_notes text,
  influencer_feedback text,
  coordinator_service_rating smallint check (coordinator_service_rating between 1 and 5),
  source text not null default 'portal',
  legacy_source_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A repeat collaboration is allowed. Only prevent the same active campaign/influencer duplicate.
create unique index campaign_assignments_active_unique
  on public.campaign_assignments (campaign_id, influencer_id)
  where status not in ('closed', 'rejected', 'cancelled');

create table public.assignment_platforms (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete restrict,
  required_deliverables jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (assignment_id, social_account_id)
);

create table public.assignment_compensations (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  type public.payment_type not null,
  amount numeric(12,2),
  voucher_source text,
  voucher_branch text,
  notes text,
  created_at timestamptz not null default now(),
  unique (assignment_id, type)
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  assignment_platform_id uuid not null references public.assignment_platforms(id) on delete cascade,
  sequence_no integer not null default 1 check (sequence_no > 0),
  content_type text not null,
  post_url text,
  content_file_path text,
  performance_file_path text,
  promo_code text,
  can_reuse_in_ads boolean,
  usage_rights_note text,
  status public.content_status not null default 'draft',
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_platform_id, sequence_no)
);

create table public.content_reviews (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision public.review_decision not null,
  suitable_for_ads boolean,
  notes text,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  compensation_id uuid references public.assignment_compensations(id) on delete set null,
  type public.payment_type not null,
  amount numeric(12,2),
  status public.payment_status not null default 'draft',
  finance_batch_number text,
  paid_at timestamptz,
  finance_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, type)
);

create table public.assignment_messages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Optional quick links. Store only a SHA-256 hash, never the raw token.
create table public.submission_links (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index influencers_user_id_idx on public.influencers(user_id);
create index social_accounts_influencer_idx on public.social_accounts(influencer_id);
create index campaigns_status_dates_idx on public.campaigns(status, start_date, end_date);
create index assignments_influencer_status_idx on public.campaign_assignments(influencer_id, status);
create index assignments_coordinator_status_idx on public.campaign_assignments(coordinator_id, status);
create index assignment_platforms_assignment_idx on public.assignment_platforms(assignment_id);
create index content_items_status_idx on public.content_items(status, submitted_at);
create index payments_status_idx on public.payments(status, created_at);
create index messages_assignment_created_idx on public.assignment_messages(assignment_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger influencers_set_updated_at before update on public.influencers
for each row execute function public.set_updated_at();
create trigger financial_profiles_set_updated_at before update on public.influencer_financial_profiles
for each row execute function public.set_updated_at();
create trigger social_accounts_set_updated_at before update on public.social_accounts
for each row execute function public.set_updated_at();
create trigger campaigns_set_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();
create trigger assignments_set_updated_at before update on public.campaign_assignments
for each row execute function public.set_updated_at();
create trigger content_items_set_updated_at before update on public.content_items
for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();

create schema if not exists private;

create or replace function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid()) and is_active = true;
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(private.current_user_role() in ('admin', 'coordinator', 'finance'), false);
$$;

create or replace function private.is_admin_or_finance()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(private.current_user_role() in ('admin', 'finance'), false);
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin_or_finance() to authenticated;

alter table public.profiles enable row level security;
alter table public.influencers enable row level security;
alter table public.influencer_financial_profiles enable row level security;
alter table public.social_accounts enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_assignments enable row level security;
alter table public.assignment_platforms enable row level security;
alter table public.assignment_compensations enable row level security;
alter table public.content_items enable row level security;
alter table public.content_reviews enable row level security;
alter table public.payments enable row level security;
alter table public.assignment_messages enable row level security;
alter table public.submission_links enable row level security;
alter table public.activity_logs enable row level security;

-- Profiles
create policy profiles_select_own_or_staff on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select private.is_staff()));
create policy profiles_update_own_or_admin on public.profiles for update to authenticated
using (id = (select auth.uid()) or (select private.current_user_role()) = 'admin')
with check (id = (select auth.uid()) or (select private.current_user_role()) = 'admin');

-- Influencers
create policy influencers_select_own_or_staff on public.influencers for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_staff()));
create policy influencers_update_own_or_staff on public.influencers for update to authenticated
using (user_id = (select auth.uid()) or (select private.is_staff()))
with check (user_id = (select auth.uid()) or (select private.is_staff()));
create policy influencers_insert_staff on public.influencers for insert to authenticated
with check ((select private.is_staff()));

-- Sensitive financial data: influencer sees own; coordinators do not.
create policy financial_select_owner_or_finance on public.influencer_financial_profiles for select to authenticated
using (
  exists (select 1 from public.influencers i where i.id = influencer_id and i.user_id = (select auth.uid()))
  or (select private.is_admin_or_finance())
);
create policy financial_update_owner_or_finance on public.influencer_financial_profiles for update to authenticated
using (
  exists (select 1 from public.influencers i where i.id = influencer_id and i.user_id = (select auth.uid()))
  or (select private.is_admin_or_finance())
)
with check (
  exists (select 1 from public.influencers i where i.id = influencer_id and i.user_id = (select auth.uid()))
  or (select private.is_admin_or_finance())
);
create policy financial_insert_owner_or_finance on public.influencer_financial_profiles for insert to authenticated
with check (
  exists (select 1 from public.influencers i where i.id = influencer_id and i.user_id = (select auth.uid()))
  or (select private.is_admin_or_finance())
);

-- Social accounts
create policy social_select_owner_or_staff on public.social_accounts for select to authenticated
using (
  exists (select 1 from public.influencers i where i.id = influencer_id and i.user_id = (select auth.uid()))
  or (select private.is_staff())
);
create policy social_write_owner_or_staff on public.social_accounts for all to authenticated
using (
  exists (select 1 from public.influencers i where i.id = influencer_id and i.user_id = (select auth.uid()))
  or (select private.is_staff())
)
with check (
  exists (select 1 from public.influencers i where i.id = influencer_id and i.user_id = (select auth.uid()))
  or (select private.is_staff())
);

-- Campaigns
create policy campaigns_select_authenticated on public.campaigns for select to authenticated
using (status <> 'archived' or (select private.is_staff()));
create policy campaigns_write_staff on public.campaigns for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

-- Assignments
create policy assignments_select_party_or_staff on public.campaign_assignments for select to authenticated
using (
  coordinator_id = (select auth.uid())
  or exists (select 1 from public.influencers i where i.id = influencer_id and i.user_id = (select auth.uid()))
  or (select private.is_staff())
);
create policy assignments_write_staff on public.campaign_assignments for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

-- Child records inherit assignment visibility.
create policy assignment_platforms_select_party on public.assignment_platforms for select to authenticated
using (
  exists (
    select 1 from public.campaign_assignments a
    left join public.influencers i on i.id = a.influencer_id
    where a.id = assignment_id
      and (a.coordinator_id = (select auth.uid()) or i.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);
create policy assignment_platforms_write_staff on public.assignment_platforms for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

create policy compensations_select_party on public.assignment_compensations for select to authenticated
using (
  exists (
    select 1 from public.campaign_assignments a
    left join public.influencers i on i.id = a.influencer_id
    where a.id = assignment_id
      and (a.coordinator_id = (select auth.uid()) or i.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);
create policy compensations_write_staff on public.assignment_compensations for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

create policy content_select_party on public.content_items for select to authenticated
using (
  exists (
    select 1
    from public.assignment_platforms ap
    join public.campaign_assignments a on a.id = ap.assignment_id
    join public.influencers i on i.id = a.influencer_id
    where ap.id = assignment_platform_id
      and (a.coordinator_id = (select auth.uid()) or i.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);
create policy content_insert_owner_or_staff on public.content_items for insert to authenticated
with check (
  exists (
    select 1
    from public.assignment_platforms ap
    join public.campaign_assignments a on a.id = ap.assignment_id
    join public.influencers i on i.id = a.influencer_id
    where ap.id = assignment_platform_id
      and (i.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);
create policy content_update_owner_or_staff on public.content_items for update to authenticated
using (
  exists (
    select 1
    from public.assignment_platforms ap
    join public.campaign_assignments a on a.id = ap.assignment_id
    join public.influencers i on i.id = a.influencer_id
    where ap.id = assignment_platform_id
      and (i.user_id = (select auth.uid()) or (select private.is_staff()))
  )
)
with check (
  exists (
    select 1
    from public.assignment_platforms ap
    join public.campaign_assignments a on a.id = ap.assignment_id
    join public.influencers i on i.id = a.influencer_id
    where ap.id = assignment_platform_id
      and (i.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);

create policy reviews_select_party on public.content_reviews for select to authenticated
using (
  exists (
    select 1
    from public.content_items ci
    join public.assignment_platforms ap on ap.id = ci.assignment_platform_id
    join public.campaign_assignments a on a.id = ap.assignment_id
    join public.influencers i on i.id = a.influencer_id
    where ci.id = content_item_id
      and (a.coordinator_id = (select auth.uid()) or i.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);
create policy reviews_write_staff on public.content_reviews for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

create policy payments_select_party on public.payments for select to authenticated
using (
  exists (
    select 1 from public.campaign_assignments a
    join public.influencers i on i.id = a.influencer_id
    where a.id = assignment_id
      and (a.coordinator_id = (select auth.uid()) or i.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);
create policy payments_write_finance on public.payments for all to authenticated
using ((select private.is_admin_or_finance())) with check ((select private.is_admin_or_finance()));

create policy messages_select_party on public.assignment_messages for select to authenticated
using (
  exists (
    select 1 from public.campaign_assignments a
    join public.influencers i on i.id = a.influencer_id
    where a.id = assignment_id
      and (a.coordinator_id = (select auth.uid()) or i.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);
create policy messages_insert_party on public.assignment_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.campaign_assignments a
    join public.influencers i on i.id = a.influencer_id
    where a.id = assignment_id
      and (a.coordinator_id = (select auth.uid()) or i.user_id = (select auth.uid()) or (select private.is_staff()))
  )
);

create policy submission_links_staff_only on public.submission_links for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));
create policy activity_logs_admin_select on public.activity_logs for select to authenticated
using ((select private.current_user_role()) = 'admin');

-- Storage recommendation:
-- Create private buckets: campaign-content, performance-screenshots, influencer-documents.
-- Add bucket policies that derive assignment ownership from the object path.
