-- Dar Al Amirat Influencer Platform
-- Finance operations V1: approvals, transfer batches, vouchers, notifications and reports.

begin;

-- ---------------------------------------------------------------------------
-- 1) Influencer payment identity and payment review state
-- ---------------------------------------------------------------------------

alter table public.influencer_financial_profiles
  add column if not exists identity_type text,
  add column if not exists identity_number text,
  add column if not exists identity_number_normalized text;

update public.influencer_financial_profiles
set identity_number = coalesce(identity_number, national_id)
where identity_number is null and national_id is not null;

alter table public.influencer_financial_profiles
  drop constraint if exists influencer_financial_profiles_identity_type_check;
alter table public.influencer_financial_profiles
  add constraint influencer_financial_profiles_identity_type_check
  check (
    identity_type is null
    or identity_type in ('national_id', 'residency', 'commercial_registration')
  );

alter table public.influencer_bank_update_requests
  add column if not exists identity_type text,
  add column if not exists identity_number text;

alter table public.influencer_bank_update_requests
  drop constraint if exists influencer_bank_update_requests_identity_type_check;
alter table public.influencer_bank_update_requests
  add constraint influencer_bank_update_requests_identity_type_check
  check (
    identity_type is null
    or identity_type in ('national_id', 'residency', 'commercial_registration')
  );

update public.influencer_bank_update_requests
set identity_number = coalesce(identity_number, national_id)
where identity_number is null and national_id is not null;

alter table public.payments
  add column if not exists finance_review_status text not null default 'pending',
  add column if not exists finance_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists finance_reviewed_at timestamptz,
  add column if not exists finance_review_notes text,
  add column if not exists contract_review_status text not null default 'not_required',
  add column if not exists transfer_method text,
  add column if not exists manual_transfer_reason text,
  add column if not exists ready_for_batch_at timestamptz;

alter table public.payments
  drop constraint if exists payments_finance_review_status_check;
alter table public.payments
  add constraint payments_finance_review_status_check
  check (finance_review_status in ('pending', 'approved', 'returned', 'rejected'));

alter table public.payments
  drop constraint if exists payments_contract_review_status_check;
alter table public.payments
  add constraint payments_contract_review_status_check
  check (contract_review_status in ('not_required', 'pending', 'approved', 'rejected'));

alter table public.payments
  drop constraint if exists payments_transfer_method_check;
alter table public.payments
  add constraint payments_transfer_method_check
  check (transfer_method is null or transfer_method in ('bank_file', 'manual'));

create index if not exists payments_finance_review_idx
  on public.payments (finance_review_status, ready_for_batch_at, created_at desc);

-- ---------------------------------------------------------------------------
-- 2) Influencer notifications
-- ---------------------------------------------------------------------------

create table if not exists public.influencer_notifications (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  type text not null default 'general',
  title text not null,
  body text not null,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists influencer_notifications_influencer_idx
  on public.influencer_notifications (influencer_id, read_at, created_at desc);

alter table public.influencer_notifications enable row level security;

drop policy if exists influencer_notifications_owner_select on public.influencer_notifications;
create policy influencer_notifications_owner_select
on public.influencer_notifications
for select
to authenticated
using (
  exists (
    select 1
    from public.influencers i
    where i.id = influencer_notifications.influencer_id
      and i.user_id = auth.uid()
  )
  or (select private.is_admin_or_finance())
);

drop policy if exists influencer_notifications_owner_update on public.influencer_notifications;
create policy influencer_notifications_owner_update
on public.influencer_notifications
for update
to authenticated
using (
  exists (
    select 1
    from public.influencers i
    where i.id = influencer_notifications.influencer_id
      and i.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.influencers i
    where i.id = influencer_notifications.influencer_id
      and i.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- 3) Payment transfer batches
-- ---------------------------------------------------------------------------

create table if not exists public.payment_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  batch_code text not null unique,
  month_label text not null,
  scheduled_for date,
  status text not null default 'draft',
  total_amount numeric(14,2) not null default 0,
  item_count integer not null default 0,
  bank_file_count integer not null default 0,
  manual_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  exported_at timestamptz,
  submitted_to_bank_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payment_batches
  drop constraint if exists payment_batches_status_check;
alter table public.payment_batches
  add constraint payment_batches_status_check
  check (status in (
    'draft',
    'under_review',
    'approved',
    'ready_for_export',
    'exported',
    'submitted_to_bank',
    'processing',
    'completed',
    'partially_completed',
    'returned',
    'rejected',
    'cancelled'
  ));

create table if not exists public.payment_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.payment_batches(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete restrict,
  assignment_id uuid not null references public.campaign_assignments(id) on delete restrict,
  influencer_id uuid not null references public.influencers(id) on delete restrict,
  influencer_name text not null,
  mobile text not null,
  campaign_name text not null,
  brand_name text,
  bank_name text,
  account_holder_name text,
  iban text,
  identity_type text,
  identity_number text,
  amount numeric(12,2) not null check (amount > 0),
  contract_status text not null default 'not_required',
  publication_url text,
  transfer_method text not null,
  manual_reason text,
  item_status text not null default 'pending',
  transfer_reference text,
  transferred_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.payment_batch_items
  drop constraint if exists payment_batch_items_transfer_method_check;
alter table public.payment_batch_items
  add constraint payment_batch_items_transfer_method_check
  check (transfer_method in ('bank_file', 'manual'));

alter table public.payment_batch_items
  drop constraint if exists payment_batch_items_status_check;
alter table public.payment_batch_items
  add constraint payment_batch_items_status_check
  check (item_status in ('pending', 'exported', 'submitted', 'paid', 'failed', 'cancelled'));

create index if not exists payment_batches_status_idx
  on public.payment_batches (status, scheduled_for, created_at desc);
create index if not exists payment_batch_items_batch_idx
  on public.payment_batch_items (batch_id, transfer_method, item_status);
create unique index if not exists payment_batch_items_active_payment_unique
  on public.payment_batch_items (payment_id)
  where item_status <> 'cancelled';

alter table public.payment_batches enable row level security;
alter table public.payment_batch_items enable row level security;

drop policy if exists payment_batches_finance_all on public.payment_batches;
create policy payment_batches_finance_all
on public.payment_batches
for all
to authenticated
using ((select private.is_admin_or_finance()))
with check ((select private.is_admin_or_finance()));

drop policy if exists payment_batch_items_finance_all on public.payment_batch_items;
create policy payment_batch_items_finance_all
on public.payment_batch_items
for all
to authenticated
using ((select private.is_admin_or_finance()))
with check ((select private.is_admin_or_finance()));

create or replace function public.set_payment_batch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists payment_batches_set_updated_at on public.payment_batches;
create trigger payment_batches_set_updated_at
before update on public.payment_batches
for each row execute function public.set_payment_batch_updated_at();

create or replace function private.refresh_payment_batch_totals(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_batches b
  set total_amount = x.total_amount,
      item_count = x.item_count,
      bank_file_count = x.bank_file_count,
      manual_count = x.manual_count,
      updated_at = now()
  from (
    select
      coalesce(sum(i.amount), 0)::numeric(14,2) as total_amount,
      count(*)::integer as item_count,
      count(*) filter (where i.transfer_method = 'bank_file')::integer as bank_file_count,
      count(*) filter (where i.transfer_method = 'manual')::integer as manual_count
    from public.payment_batch_items i
    where i.batch_id = p_batch_id
      and i.item_status <> 'cancelled'
  ) x
  where b.id = p_batch_id;
end;
$$;

create or replace function private.payment_batch_item_refresh_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_payment_batch_totals(
    case when tg_op = 'DELETE' then old.batch_id else new.batch_id end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists payment_batch_items_refresh_parent on public.payment_batch_items;
create trigger payment_batch_items_refresh_parent
after insert or update or delete
on public.payment_batch_items
for each row execute function private.payment_batch_item_refresh_parent();

-- ---------------------------------------------------------------------------
-- 4) Voucher operations
-- ---------------------------------------------------------------------------

create table if not exists public.voucher_issues (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete restrict,
  source_type text not null,
  branch_id uuid references public.branches(id) on delete set null,
  coordinator_id uuid references public.profiles(id) on delete set null,
  order_number text,
  voucher_code text,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  expires_at timestamptz,
  delivered_at timestamptz,
  redeemed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.voucher_issues
  drop constraint if exists voucher_issues_source_type_check;
alter table public.voucher_issues
  add constraint voucher_issues_source_type_check
  check (source_type in ('branch', 'website', 'coordinator_order'));

alter table public.voucher_issues
  drop constraint if exists voucher_issues_status_check;
alter table public.voucher_issues
  add constraint voucher_issues_status_check
  check (status in ('pending', 'preparing', 'ready', 'sent', 'delivered', 'redeemed', 'cancelled'));

create index if not exists voucher_issues_status_idx
  on public.voucher_issues (source_type, status, created_at desc);

alter table public.voucher_issues enable row level security;

drop policy if exists voucher_issues_finance_all on public.voucher_issues;
create policy voucher_issues_finance_all
on public.voucher_issues
for all
to authenticated
using ((select private.is_admin_or_finance()))
with check ((select private.is_admin_or_finance()));

create or replace function public.set_voucher_issue_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists voucher_issues_set_updated_at on public.voucher_issues;
create trigger voucher_issues_set_updated_at
before update on public.voucher_issues
for each row execute function public.set_voucher_issue_updated_at();

-- Backfill voucher operations from existing voucher payments.
insert into public.voucher_issues (
  payment_id,
  influencer_id,
  source_type,
  branch_id,
  coordinator_id,
  order_number,
  voucher_code,
  amount,
  status,
  delivered_at,
  notes
)
select
  p.id,
  a.influencer_id,
  case
    when ac.voucher_source = 'website' then 'website'
    when ac.voucher_source = 'branch' then 'branch'
    else 'coordinator_order'
  end,
  ac.voucher_branch_id,
  a.coordinator_id,
  a.order_number,
  p.voucher_code,
  coalesce(nullif(p.expected_amount, 0), p.amount, ac.amount, 0),
  case
    when p.voucher_status = 'redeemed' then 'redeemed'
    when p.voucher_status = 'delivered' then 'delivered'
    when p.voucher_status = 'ready' then 'ready'
    when p.voucher_status = 'preparing' then 'preparing'
    else 'pending'
  end,
  p.voucher_delivered_at,
  ac.notes
from public.payments p
join public.campaign_assignments a on a.id = p.assignment_id
left join public.assignment_compensations ac on ac.id = p.compensation_id
where p.type = 'voucher'
on conflict (payment_id) do nothing;

-- ---------------------------------------------------------------------------
-- 5) Saudi digit normalization and identity validation helpers
-- ---------------------------------------------------------------------------

create or replace function private.normalize_sa_digits(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    translate(
      coalesce(p_value, ''),
      '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
      '01234567890123456789'
    ),
    '[^0-9]',
    '',
    'g'
  );
$$;

create or replace function private.valid_sa_identity(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.normalize_sa_digits(p_value) ~ '^[127][0-9]{9}$';
$$;

create or replace function private.classify_transfer_method(p_influencer_id uuid)
returns table(transfer_method text, manual_reason text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.influencer_financial_profiles%rowtype;
  v_identity text;
begin
  select * into v_profile
  from public.influencer_financial_profiles fp
  where fp.influencer_id = p_influencer_id;

  if not found
     or v_profile.bank_profile_status <> 'approved'
     or nullif(trim(coalesce(v_profile.bank_name, '')), '') is null
     or nullif(trim(coalesce(v_profile.account_holder_name, '')), '') is null
     or upper(regexp_replace(coalesce(v_profile.iban, ''), '[^A-Za-z0-9]', '', 'g')) !~ '^SA[0-9]{22}$' then
    return query select 'manual'::text, 'بيانات البنك غير مكتملة أو غير معتمدة'::text;
    return;
  end if;

  v_identity := private.normalize_sa_digits(coalesce(v_profile.identity_number, v_profile.national_id));
  if v_identity ~ '^[127][0-9]{9}$' then
    return query select 'bank_file'::text, null::text;
  else
    return query select 'manual'::text, 'رقم الهوية أو الإقامة أو السجل التجاري غير متوفر أو غير صالح'::text;
  end if;
end;
$$;

revoke all on function private.normalize_sa_digits(text) from public;
revoke all on function private.valid_sa_identity(text) from public;
revoke all on function private.classify_transfer_method(uuid) from public;

-- Normalize existing identity values.
update public.influencer_financial_profiles
set identity_number_normalized = private.normalize_sa_digits(coalesce(identity_number, national_id)),
    identity_type = case
      when private.normalize_sa_digits(coalesce(identity_number, national_id)) ~ '^7[0-9]{9}$' then 'commercial_registration'
      when private.normalize_sa_digits(coalesce(identity_number, national_id)) ~ '^2[0-9]{9}$' then 'residency'
      when private.normalize_sa_digits(coalesce(identity_number, national_id)) ~ '^1[0-9]{9}$' then 'national_id'
      else identity_type
    end;

-- ---------------------------------------------------------------------------
-- 6) Grants and schema refresh
-- ---------------------------------------------------------------------------

grant select on public.influencer_notifications to authenticated;
grant update (read_at) on public.influencer_notifications to authenticated;
grant select, insert, update, delete on public.payment_batches to authenticated;
grant select, insert, update, delete on public.payment_batch_items to authenticated;
grant select, insert, update, delete on public.voucher_issues to authenticated;

commit;

notify pgrst, 'reload schema';
