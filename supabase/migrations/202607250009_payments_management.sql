-- Dar Al Amirat Influencer Platform
-- Payment approvals, partial transfers, voucher/product fulfillment and settlement.

begin;

alter table public.payments
  add column if not exists expected_amount numeric(12,2),
  add column if not exists paid_amount numeric(12,2) not null default 0,
  add column if not exists due_at timestamptz,
  add column if not exists submitted_by uuid references public.profiles(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists returned_by uuid references public.profiles(id) on delete set null,
  add column if not exists returned_at timestamptz,
  add column if not exists return_reason text,
  add column if not exists rejected_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists voucher_status text,
  add column if not exists voucher_code text,
  add column if not exists voucher_delivered_at timestamptz,
  add column if not exists product_status text,
  add column if not exists product_shipped_at timestamptz,
  add column if not exists product_delivered_at timestamptz;

update public.payments p
set due_at = coalesce(p.due_at, ac.expected_payment_at)
from public.assignment_compensations ac
where ac.id = p.compensation_id
  and ac.expected_payment_at is not null;

update public.payments
set expected_amount = coalesce(expected_amount, amount, 0),
    paid_amount = case
      when status = 'paid' then coalesce(expected_amount, amount, 0)
      else coalesce(paid_amount, 0)
    end,
    voucher_status = case
      when type = 'voucher' and status = 'paid' then 'delivered'
      when type = 'voucher' then coalesce(voucher_status, 'pending')
      else voucher_status
    end,
    product_status = case
      when type = 'product' and status = 'paid' then 'delivered'
      when type = 'product' then coalesce(product_status, 'pending')
      else product_status
    end;

alter table public.payments
  alter column expected_amount set default 0;

alter table public.payments
  drop constraint if exists payments_expected_amount_check;
alter table public.payments
  add constraint payments_expected_amount_check
  check (expected_amount is null or expected_amount >= 0);

alter table public.payments
  drop constraint if exists payments_paid_amount_check;
alter table public.payments
  add constraint payments_paid_amount_check
  check (paid_amount >= 0);

alter table public.payments
  drop constraint if exists payments_voucher_status_check;
alter table public.payments
  add constraint payments_voucher_status_check
  check (
    voucher_status is null
    or voucher_status in ('pending', 'preparing', 'ready', 'delivered', 'redeemed')
  );

alter table public.payments
  drop constraint if exists payments_product_status_check;
alter table public.payments
  add constraint payments_product_status_check
  check (
    product_status is null
    or product_status in ('pending', 'preparing', 'shipped', 'delivered')
  );

create index if not exists payments_workflow_idx
  on public.payments (status, due_at, created_at desc);
create index if not exists payments_assignment_status_idx
  on public.payments (assignment_id, status);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  transferred_at timestamptz not null,
  transfer_reference text not null,
  finance_batch_number text,
  source_bank text,
  proof_path text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payment_transactions_payment_idx
  on public.payment_transactions (payment_id, transferred_at desc);
create unique index if not exists payment_transactions_reference_unique
  on public.payment_transactions (payment_id, transfer_reference);

alter table public.payment_transactions enable row level security;

drop policy if exists payment_transactions_finance_select on public.payment_transactions;
create policy payment_transactions_finance_select
on public.payment_transactions
for select
to authenticated
using ((select private.is_admin_or_finance()));

drop policy if exists payment_transactions_finance_write on public.payment_transactions;
create policy payment_transactions_finance_write
on public.payment_transactions
for all
to authenticated
using ((select private.is_admin_or_finance()))
with check ((select private.is_admin_or_finance()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.current_payment_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active = true;
$$;

revoke all on function private.current_payment_role() from public;

create or replace function private.refresh_payment_transfer_totals(
  p_payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric := 0;
  v_expected numeric := 0;
  v_type public.payment_type;
  v_latest timestamptz;
begin
  select coalesce(sum(t.amount), 0), max(t.transferred_at)
  into v_total, v_latest
  from public.payment_transactions t
  where t.payment_id = p_payment_id;

  select coalesce(p.expected_amount, p.amount, 0), p.type
  into v_expected, v_type
  from public.payments p
  where p.id = p_payment_id
  for update;

  if not found then
    return;
  end if;

  if v_type <> 'bank_transfer' then
    return;
  end if;

  update public.payments
  set paid_amount = v_total,
      status = case
        when v_expected > 0 and v_total >= v_expected then 'paid'::public.payment_status
        when v_total > 0 then 'partially_paid'::public.payment_status
        when status in ('paid', 'partially_paid') then 'ready_for_finance'::public.payment_status
        else status
      end,
      paid_at = case
        when v_expected > 0 and v_total >= v_expected then coalesce(v_latest, now())
        else null
      end,
      updated_at = now()
  where id = p_payment_id;
end;
$$;

revoke all on function private.refresh_payment_transfer_totals(uuid) from public;

create or replace function private.payment_transactions_refresh_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.refresh_payment_transfer_totals(
    case when tg_op = 'DELETE' then old.payment_id else new.payment_id end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists payment_transactions_refresh_parent on public.payment_transactions;
create trigger payment_transactions_refresh_parent
after insert or update or delete
on public.payment_transactions
for each row execute function private.payment_transactions_refresh_parent();

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
  v_has_publish_link boolean := false;
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
    select exists (
      select 1
      from public.content_items ci
      join public.assignment_platforms ap on ap.id = ci.assignment_platform_id
      where ap.assignment_id = v_assignment.id
        and ci.status in ('approved', 'published')
        and nullif(trim(coalesce(ci.post_url, '')), '') is not null
    ) into v_has_publish_link;

    if not v_has_publish_link then
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

create or replace function public.review_payment_request(
  p_payment_id uuid,
  p_decision text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_status public.payment_status;
begin
  v_role := private.current_payment_role();
  if v_role is null or v_role not in ('admin', 'finance') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select status into v_status
  from public.payments
  where id = p_payment_id
  for update;

  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_status <> 'awaiting_approval' then raise exception 'PAYMENT_NOT_AWAITING_APPROVAL'; end if;

  if p_decision = 'approve' then
    update public.payments
    set status = 'ready_for_finance',
        approved_by = auth.uid(),
        approved_at = now(),
        returned_by = null,
        returned_at = null,
        return_reason = null,
        updated_at = now()
    where id = p_payment_id;
  elsif p_decision = 'return' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'REASON_REQUIRED'; end if;
    update public.payments
    set status = 'draft',
        returned_by = auth.uid(),
        returned_at = now(),
        return_reason = trim(p_reason),
        updated_at = now()
    where id = p_payment_id;
  elsif p_decision = 'reject' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'REASON_REQUIRED'; end if;
    update public.payments
    set status = 'cancelled',
        rejected_by = auth.uid(),
        rejected_at = now(),
        rejection_reason = trim(p_reason),
        updated_at = now()
    where id = p_payment_id;
  else
    raise exception 'INVALID_DECISION';
  end if;

  insert into public.activity_logs (actor_id, entity_type, entity_id, action, metadata)
  values (
    auth.uid(),
    'payment',
    p_payment_id,
    'payment_reviewed',
    jsonb_build_object('decision', p_decision, 'reason', p_reason)
  );
end;
$$;

revoke all on function public.review_payment_request(uuid, text, text) from public;
grant execute on function public.review_payment_request(uuid, text, text) to authenticated;

create or replace function public.record_bank_payment(
  p_payment_id uuid,
  p_amount numeric,
  p_transferred_at timestamptz,
  p_transfer_reference text,
  p_batch_number text default null,
  p_source_bank text default null,
  p_proof_path text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_payment public.payments%rowtype;
  v_current numeric;
  v_transaction_id uuid;
begin
  v_role := private.current_payment_role();
  if v_role is null or v_role not in ('admin', 'finance') then raise exception 'NOT_AUTHORIZED'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT'; end if;
  if nullif(trim(coalesce(p_transfer_reference, '')), '') is null then raise exception 'TRANSFER_REFERENCE_REQUIRED'; end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.type <> 'bank_transfer' then raise exception 'NOT_BANK_TRANSFER'; end if;
  if v_payment.status not in ('ready_for_finance', 'partially_paid') then raise exception 'PAYMENT_NOT_READY'; end if;

  select coalesce(sum(t.amount), 0) into v_current
  from public.payment_transactions t
  where t.payment_id = p_payment_id;

  if v_current + p_amount > coalesce(v_payment.expected_amount, v_payment.amount, 0) then
    raise exception 'AMOUNT_EXCEEDS_REMAINING';
  end if;

  insert into public.payment_transactions (
    payment_id, amount, transferred_at, transfer_reference,
    finance_batch_number, source_bank, proof_path, notes, created_by
  ) values (
    p_payment_id, p_amount, coalesce(p_transferred_at, now()), trim(p_transfer_reference),
    nullif(trim(p_batch_number), ''), nullif(trim(p_source_bank), ''),
    nullif(trim(p_proof_path), ''), nullif(trim(p_notes), ''), auth.uid()
  ) returning id into v_transaction_id;

  update public.payments
  set finance_batch_number = coalesce(nullif(trim(p_batch_number), ''), finance_batch_number),
      finance_notes = coalesce(nullif(trim(p_notes), ''), finance_notes),
      updated_at = now()
  where id = p_payment_id;

  insert into public.activity_logs (actor_id, entity_type, entity_id, action, metadata)
  values (
    auth.uid(), 'payment', p_payment_id, 'bank_payment_recorded',
    jsonb_build_object('transactionId', v_transaction_id, 'amount', p_amount)
  );

  return v_transaction_id;
end;
$$;

revoke all on function public.record_bank_payment(uuid, numeric, timestamptz, text, text, text, text, text) from public;
grant execute on function public.record_bank_payment(uuid, numeric, timestamptz, text, text, text, text, text) to authenticated;

create or replace function public.update_payment_fulfillment(
  p_payment_id uuid,
  p_status text,
  p_code text default null,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_payment public.payments%rowtype;
  v_paid boolean := false;
begin
  v_role := private.current_payment_role();
  if v_role is null or v_role not in ('admin', 'finance') then raise exception 'NOT_AUTHORIZED'; end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if v_payment.status not in ('ready_for_finance', 'partially_paid', 'paid') then raise exception 'PAYMENT_NOT_READY'; end if;

  if v_payment.type = 'voucher' then
    if p_status not in ('pending', 'preparing', 'ready', 'delivered', 'redeemed') then raise exception 'INVALID_VOUCHER_STATUS'; end if;
    v_paid := p_status in ('delivered', 'redeemed');
    update public.payments
    set voucher_status = p_status,
        voucher_code = coalesce(nullif(trim(p_code), ''), voucher_code),
        voucher_delivered_at = case when v_paid then coalesce(voucher_delivered_at, now()) else null end,
        paid_amount = case when v_paid then coalesce(expected_amount, amount, 0) else 0 end,
        status = case when v_paid then 'paid'::public.payment_status else 'ready_for_finance'::public.payment_status end,
        paid_at = case when v_paid then coalesce(paid_at, now()) else null end,
        finance_notes = coalesce(nullif(trim(p_notes), ''), finance_notes),
        updated_at = now()
    where id = p_payment_id;
  elsif v_payment.type = 'product' then
    if p_status not in ('pending', 'preparing', 'shipped', 'delivered') then raise exception 'INVALID_PRODUCT_STATUS'; end if;
    v_paid := p_status = 'delivered';
    update public.payments
    set product_status = p_status,
        product_shipped_at = case when p_status in ('shipped', 'delivered') then coalesce(product_shipped_at, now()) else null end,
        product_delivered_at = case when p_status = 'delivered' then coalesce(product_delivered_at, now()) else null end,
        paid_amount = 0,
        status = case when v_paid then 'paid'::public.payment_status else 'ready_for_finance'::public.payment_status end,
        paid_at = case when v_paid then coalesce(paid_at, now()) else null end,
        finance_notes = coalesce(nullif(trim(p_notes), ''), finance_notes),
        updated_at = now()
    where id = p_payment_id;
  else
    raise exception 'FULFILLMENT_NOT_SUPPORTED';
  end if;

  insert into public.activity_logs (actor_id, entity_type, entity_id, action, metadata)
  values (
    auth.uid(), 'payment', p_payment_id, 'payment_fulfillment_updated',
    jsonb_build_object('status', p_status, 'type', v_payment.type)
  );
end;
$$;

revoke all on function public.update_payment_fulfillment(uuid, text, text, text) from public;
grant execute on function public.update_payment_fulfillment(uuid, text, text, text) to authenticated;

-- Use actual paid totals in campaign budget summaries, including partial bank transfers.
create or replace function public.campaign_budget_summary(
  p_campaign_id uuid
)
returns table (
  estimated_budget numeric,
  committed_amount numeric,
  remaining_amount numeric,
  paid_amount numeric,
  awaiting_payment numeric,
  over_budget_amount numeric,
  usage_percentage numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true;

  if v_role is null or v_role not in ('admin', 'coordinator', 'finance') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  with assignment_costs as (
    select
      a.id,
      case
        when exists (
          select 1 from public.assignment_compensations ac0
          where ac0.assignment_id = a.id
            and ac0.type in ('bank_transfer', 'voucher')
        ) then coalesce((
          select sum(coalesce(ac.amount, 0))
          from public.assignment_compensations ac
          where ac.assignment_id = a.id
            and ac.type in ('bank_transfer', 'voucher')
        ), 0)
        else coalesce(a.agreed_amount, 0)
      end::numeric as committed
    from public.campaign_assignments a
    where a.campaign_id = p_campaign_id
      and a.status not in ('rejected', 'cancelled')
  ), totals as (
    select
      coalesce(c.budget, 0)::numeric as budget,
      coalesce(sum(ac.committed), 0)::numeric as committed
    from public.campaigns c
    left join assignment_costs ac on true
    where c.id = p_campaign_id
    group by c.id, c.budget
  ), paid as (
    select coalesce(sum(
      case
        when p.type in ('bank_transfer', 'voucher')
          then coalesce(p.paid_amount, case when p.status = 'paid' then p.amount else 0 end, 0)
        else 0
      end
    ), 0)::numeric as amount
    from public.payments p
    join public.campaign_assignments a on a.id = p.assignment_id
    where a.campaign_id = p_campaign_id
      and a.status not in ('rejected', 'cancelled')
  )
  select
    t.budget,
    t.committed,
    t.budget - t.committed,
    p.amount,
    greatest(t.committed - p.amount, 0),
    greatest(t.committed - t.budget, 0),
    case when t.budget > 0 then round((t.committed / t.budget) * 100, 2) else null end
  from totals t cross join paid p;
end;
$$;

revoke all on function public.campaign_budget_summary(uuid) from public;
grant execute on function public.campaign_budget_summary(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
