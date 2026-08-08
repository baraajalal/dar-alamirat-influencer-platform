-- Dar Al Amirat Influencer Platform
-- Require an authenticated influencer account for bank-transfer completion,
-- provide masked bank confirmation/update workflow, and finance review.

begin;

alter table public.influencer_financial_profiles
  add column if not exists bank_profile_status text not null default 'incomplete',
  add column if not exists iban_last4 text,
  add column if not exists influencer_confirmed_at timestamptz,
  add column if not exists finance_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists finance_reviewed_at timestamptz,
  add column if not exists finance_review_notes text,
  add column if not exists iban_certificate_path text,
  add column if not exists bank_update_requested_at timestamptz;

alter table public.influencer_financial_profiles
  drop constraint if exists influencer_financial_profiles_bank_status_check;

alter table public.influencer_financial_profiles
  add constraint influencer_financial_profiles_bank_status_check
  check (
    bank_profile_status in (
      'incomplete',
      'needs_confirmation',
      'pending_review',
      'approved',
      'update_pending',
      'rejected'
    )
  );

update public.influencer_financial_profiles
set
  iban_last4 = case
    when nullif(regexp_replace(coalesce(iban, ''), '[^A-Za-z0-9]', '', 'g'), '') is null then null
    else right(upper(regexp_replace(iban, '[^A-Za-z0-9]', '', 'g')), 4)
  end,
  bank_profile_status = case
    when nullif(trim(coalesce(bank_name, '')), '') is not null
      and nullif(trim(coalesce(account_holder_name, '')), '') is not null
      and upper(regexp_replace(coalesce(iban, ''), '[^A-Za-z0-9]', '', 'g')) ~ '^SA[0-9]{22}$'
      then case
        when bank_profile_status = 'approved' then 'approved'
        else 'needs_confirmation'
      end
    else 'incomplete'
  end;

create table if not exists public.influencer_bank_update_requests (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  bank_name text not null,
  iban text not null,
  iban_last4 text not null,
  account_holder_name text not null,
  national_id text,
  certificate_path text,
  previous_profile_status text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists influencer_bank_update_one_pending_idx
  on public.influencer_bank_update_requests (influencer_id)
  where status = 'pending';

create index if not exists influencer_bank_update_status_idx
  on public.influencer_bank_update_requests (status, submitted_at desc);

create index if not exists influencer_financial_bank_status_idx
  on public.influencer_financial_profiles (bank_profile_status, updated_at desc);

drop trigger if exists influencer_bank_update_requests_set_updated_at
  on public.influencer_bank_update_requests;
create trigger influencer_bank_update_requests_set_updated_at
before update on public.influencer_bank_update_requests
for each row execute function public.set_updated_at();

alter table public.influencer_bank_update_requests enable row level security;

drop policy if exists bank_update_requests_finance_select
  on public.influencer_bank_update_requests;
create policy bank_update_requests_finance_select
on public.influencer_bank_update_requests
for select
to authenticated
using ((select private.is_admin_or_finance()));

drop policy if exists bank_update_requests_finance_write
  on public.influencer_bank_update_requests;
create policy bank_update_requests_finance_write
on public.influencer_bank_update_requests
for all
to authenticated
using ((select private.is_admin_or_finance()))
with check ((select private.is_admin_or_finance()));


-- Full bank values must never be returned directly to an influencer browser.
-- Influencers use the masked server API; only admin/finance can query the table.
drop policy if exists financial_select_owner_or_finance on public.influencer_financial_profiles;
drop policy if exists financial_update_owner_or_finance on public.influencer_financial_profiles;
drop policy if exists financial_insert_owner_or_finance on public.influencer_financial_profiles;

drop policy if exists financial_select_finance_only on public.influencer_financial_profiles;
create policy financial_select_finance_only
on public.influencer_financial_profiles
for select
to authenticated
using ((select private.is_admin_or_finance()));

drop policy if exists financial_update_finance_only on public.influencer_financial_profiles;
create policy financial_update_finance_only
on public.influencer_financial_profiles
for update
to authenticated
using ((select private.is_admin_or_finance()))
with check ((select private.is_admin_or_finance()));

drop policy if exists financial_insert_finance_only on public.influencer_financial_profiles;
create policy financial_insert_finance_only
on public.influencer_financial_profiles
for insert
to authenticated
with check ((select private.is_admin_or_finance()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bank-certificates',
  'bank-certificates',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.influencer_bank_profile_ready(
  p_influencer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.influencers i
    join public.influencer_financial_profiles f
      on f.influencer_id = i.id
    where i.id = p_influencer_id
      and i.user_id is not null
      and f.bank_profile_status = 'approved'
      and nullif(trim(coalesce(f.bank_name, '')), '') is not null
      and nullif(trim(coalesce(f.account_holder_name, '')), '') is not null
      and upper(regexp_replace(coalesce(f.iban, ''), '[^A-Za-z0-9]', '', 'g')) ~ '^SA[0-9]{22}$'
  );
$$;

revoke all on function private.influencer_bank_profile_ready(uuid) from public;

grant execute on function private.influencer_bank_profile_ready(uuid) to authenticated;

create or replace function private.enforce_bank_payment_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_influencer_id uuid;
  v_has_account boolean := false;
begin
  if new.type <> 'bank_transfer' then
    return new;
  end if;

  if new.status not in ('awaiting_approval', 'ready_for_finance', 'partially_paid', 'paid') then
    return new;
  end if;

  select a.influencer_id, (i.user_id is not null)
  into v_influencer_id, v_has_account
  from public.campaign_assignments a
  join public.influencers i on i.id = a.influencer_id
  where a.id = new.assignment_id;

  if v_influencer_id is null then
    raise exception 'INFLUENCER_NOT_FOUND';
  end if;

  if not v_has_account then
    raise exception 'INFLUENCER_ACCOUNT_REQUIRED';
  end if;

  if not private.influencer_bank_profile_ready(v_influencer_id) then
    raise exception 'BANK_PROFILE_REQUIRED';
  end if;

  return new;
end;
$$;

drop trigger if exists payments_enforce_bank_readiness on public.payments;
create trigger payments_enforce_bank_readiness
before update of status on public.payments
for each row
when (old.status is distinct from new.status)
execute function private.enforce_bank_payment_readiness();

commit;
