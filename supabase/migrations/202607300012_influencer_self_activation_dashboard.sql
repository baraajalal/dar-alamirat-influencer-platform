-- Dar Al Amirat Influencer Platform
-- Self-service influencer activation through a verified guest assignment,
-- email OTP, forced password setup, and authenticated influencer portal.

begin;

alter table public.influencers
  add column if not exists activation_status text not null default 'guest',
  add column if not exists email_verified_at timestamptz,
  add column if not exists account_activated_at timestamptz,
  add column if not exists must_change_password boolean not null default false,
  add column if not exists last_login_at timestamptz;

alter table public.influencers
  drop constraint if exists influencers_activation_status_check;

alter table public.influencers
  add constraint influencers_activation_status_check
  check (
    activation_status in (
      'guest',
      'activation_pending',
      'email_otp_sent',
      'email_verified',
      'password_setup_required',
      'active',
      'suspended'
    )
  );

update public.influencers i
set
  activation_status = case
    when i.user_id is not null and coalesce(i.must_change_password, false) then 'password_setup_required'
    when i.user_id is not null then 'active'
    else 'guest'
  end,
  email_verified_at = case
    when i.user_id is not null then coalesce(i.email_verified_at, u.email_confirmed_at)
    else i.email_verified_at
  end,
  account_activated_at = case
    when i.user_id is not null then coalesce(i.account_activated_at, i.claimed_at, i.updated_at, now())
    else i.account_activated_at
  end
from auth.users u
where i.user_id = u.id;

update public.influencers
set activation_status = 'guest'
where user_id is null;

create index if not exists influencers_activation_status_idx
  on public.influencers (activation_status, updated_at desc);

create table if not exists public.influencer_account_activations (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  submission_link_id uuid references public.submission_links(id) on delete set null,
  email text not null,
  normalized_email text not null,
  status text not null default 'activation_pending'
    check (
      status in (
        'activation_pending',
        'otp_sent',
        'email_verified',
        'password_setup_required',
        'completed',
        'cancelled',
        'expired',
        'failed'
      )
    ),
  otp_requested_at timestamptz,
  otp_expires_at timestamptz,
  resend_count integer not null default 0 check (resend_count >= 0),
  verified_at timestamptz,
  password_completed_at timestamptz,
  auth_user_id uuid references auth.users(id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists influencer_activation_one_open_idx
  on public.influencer_account_activations (influencer_id)
  where status in (
    'activation_pending',
    'otp_sent',
    'email_verified',
    'password_setup_required'
  );

create index if not exists influencer_activation_email_idx
  on public.influencer_account_activations (normalized_email, created_at desc);

create index if not exists influencer_activation_assignment_idx
  on public.influencer_account_activations (assignment_id, created_at desc);

drop trigger if exists influencer_account_activations_set_updated_at
  on public.influencer_account_activations;
create trigger influencer_account_activations_set_updated_at
before update on public.influencer_account_activations
for each row execute function public.set_updated_at();

alter table public.influencer_account_activations enable row level security;

-- The activation API uses the service role. Staff can inspect status for support,
-- but the browser never reads or writes this table directly.
drop policy if exists influencer_account_activations_staff_select
  on public.influencer_account_activations;
create policy influencer_account_activations_staff_select
on public.influencer_account_activations
for select
to authenticated
using ((select private.is_staff()));

revoke insert, update, delete on public.influencer_account_activations
  from anon, authenticated;

grant select on public.influencer_account_activations to authenticated;

-- Existing manual portal-access requests are no longer required when activation
-- is started from a verified campaign guest link. Keep the table for history.
do $$
begin
  if to_regclass('public.portal_access_requests') is not null then
    update public.portal_access_requests
    set status = 'cancelled',
        review_notes = coalesce(review_notes, 'Replaced by self-service email OTP activation.'),
        updated_at = now()
    where status in ('pending', 'approved')
      and request_reason = 'payment_required';
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
