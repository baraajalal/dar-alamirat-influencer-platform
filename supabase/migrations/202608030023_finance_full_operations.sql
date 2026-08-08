-- Complete finance operations: failed transfers, retries, proofs, alerts,
-- product fulfilment, and staff performance reporting.

alter table public.payment_batch_items
  add column if not exists failure_category text,
  add column if not exists failure_reason text,
  add column if not exists failed_at timestamptz,
  add column if not exists failed_by uuid references public.profiles(id) on delete set null,
  add column if not exists bank_response_reference text,
  add column if not exists retry_of_item_id uuid references public.payment_batch_items(id) on delete set null,
  add column if not exists retry_payment_batch_id uuid references public.payment_batches(id) on delete set null,
  add column if not exists proof_path text,
  add column if not exists proof_uploaded_at timestamptz,
  add column if not exists proof_uploaded_by uuid references public.profiles(id) on delete set null;

create index if not exists payment_batch_items_failed_idx
  on public.payment_batch_items(item_status, failed_at desc);

create table if not exists public.product_fulfilments (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments(id) on delete cascade,
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  order_number text,
  carrier_name text,
  tracking_number text,
  status text not null default 'pending',
  prepared_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  received_at timestamptz,
  proof_path text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_fulfilments_status_check check (status in ('pending','preparing','shipped','delivered','received','returned','cancelled'))
);

create index if not exists product_fulfilments_status_idx on public.product_fulfilments(status, updated_at desc);

alter table public.product_fulfilments enable row level security;
drop policy if exists product_fulfilments_finance_all on public.product_fulfilments;
create policy product_fulfilments_finance_all on public.product_fulfilments
for all to authenticated using (private.is_admin_or_finance()) with check (private.is_admin_or_finance());
grant select, insert, update on public.product_fulfilments to authenticated;

insert into public.product_fulfilments(payment_id, assignment_id, influencer_id, status)
select p.id, p.assignment_id, a.influencer_id,
  case
    when p.product_delivered_at is not null then 'delivered'
    when p.product_shipped_at is not null then 'shipped'
    when p.product_status in ('received','delivered','shipped','preparing','pending','returned','cancelled') then p.product_status
    else 'pending'
  end
from public.payments p
join public.campaign_assignments a on a.id = p.assignment_id
where p.type = 'product'
on conflict (payment_id) do nothing;

create or replace function public.sync_product_fulfilment_to_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payments
  set product_status = new.status,
      product_shipped_at = case when new.status in ('shipped','delivered','received') then coalesce(product_shipped_at, new.shipped_at, now()) else product_shipped_at end,
      product_delivered_at = case when new.status in ('delivered','received') then coalesce(product_delivered_at, new.delivered_at, new.received_at, now()) else product_delivered_at end,
      updated_at = now()
  where id = new.payment_id;
  perform public.refresh_assignment_financial_settlement(new.assignment_id, new.updated_by);
  return new;
end;
$$;

drop trigger if exists trg_product_fulfilment_sync on public.product_fulfilments;
create trigger trg_product_fulfilment_sync
after insert or update on public.product_fulfilments
for each row execute function public.sync_product_fulfilment_to_payment();

create or replace view public.failed_transfer_items as
select
  pbi.id as batch_item_id,
  pbi.payment_id,
  pbi.assignment_id,
  pbi.influencer_id,
  pbi.influencer_name,
  pbi.mobile,
  pbi.campaign_name,
  pbi.brand_name,
  pbi.amount,
  pbi.item_status,
  pbi.failure_category,
  pbi.failure_reason,
  pbi.failed_at,
  pbi.bank_response_reference,
  pbi.retry_of_item_id,
  pbi.retry_payment_batch_id,
  pb.id as batch_id,
  pb.name as batch_name,
  pb.batch_code,
  fp.bank_profile_status,
  fp.bank_name,
  fp.account_holder_name,
  fp.iban,
  bur.status as bank_update_status,
  bur.submitted_at as bank_update_submitted_at,
  not exists (
    select 1 from public.payment_batch_items newer
    where newer.retry_of_item_id = pbi.id
      and newer.item_status not in ('cancelled','failed')
  ) as can_retry
from public.payment_batch_items pbi
join public.payment_batches pb on pb.id = pbi.batch_id
left join public.influencer_financial_profiles fp on fp.influencer_id = pbi.influencer_id
left join lateral (
  select r.status, r.submitted_at
  from public.influencer_bank_update_requests r
  where r.influencer_id = pbi.influencer_id
  order by r.created_at desc
  limit 1
) bur on true
where pbi.item_status = 'failed';

grant select on public.failed_transfer_items to authenticated;

create or replace view public.finance_alerts as
select
  'payment'::text as entity_type,
  p.id::text as entity_id,
  case
    when p.finance_review_status = 'approved' and p.status = 'ready_for_finance' and p.ready_for_batch_at < now() - interval '3 days' then 'approved_not_batched'
    when p.status = 'awaiting_approval' and p.submitted_at < now() - interval '2 days' then 'approval_delayed'
    else 'payment_delayed'
  end as alert_type,
  case when now() - coalesce(p.ready_for_batch_at,p.submitted_at,p.created_at) > interval '7 days' then 'high' else 'medium' end as severity,
  i.full_name as influencer_name,
  i.mobile_e164 as mobile,
  c.name as campaign_name,
  public.payment_expected_amount(p) as amount,
  coalesce(p.ready_for_batch_at,p.submitted_at,p.created_at) as started_at,
  extract(day from now() - coalesce(p.ready_for_batch_at,p.submitted_at,p.created_at))::int as age_days,
  '/dashboard/finance/transfers'::text as action_url
from public.payments p
join public.campaign_assignments a on a.id = p.assignment_id
join public.influencers i on i.id = a.influencer_id
join public.campaigns c on c.id = a.campaign_id
where (p.finance_review_status = 'approved' and p.status = 'ready_for_finance' and p.ready_for_batch_at < now() - interval '3 days')
   or (p.status = 'awaiting_approval' and p.submitted_at < now() - interval '2 days')
union all
select
  'voucher', vi.id::text,
  case
    when vi.status = 'ready' and vi.updated_at < now() - interval '2 days' then 'voucher_ready_unsent'
    when vi.expires_at between now() and now() + interval '5 days' and vi.status not in ('sent','redeemed','used','cancelled') then 'voucher_expiring'
    else 'voucher_delayed'
  end,
  case when vi.expires_at < now() + interval '2 days' then 'high' else 'medium' end,
  i.full_name, i.mobile_e164, c.name, vi.amount,
  coalesce(vi.delivered_at,vi.updated_at,vi.created_at),
  extract(day from now() - coalesce(vi.delivered_at,vi.updated_at,vi.created_at))::int,
  '/dashboard/finance/vouchers'
from public.voucher_issues vi
join public.payments p on p.id = vi.payment_id
join public.campaign_assignments a on a.id = p.assignment_id
join public.influencers i on i.id = a.influencer_id
join public.campaigns c on c.id = a.campaign_id
where (vi.status = 'ready' and vi.updated_at < now() - interval '2 days')
   or (vi.expires_at between now() and now() + interval '5 days' and vi.status not in ('sent','redeemed','used','cancelled'))
union all
select
  'batch', pb.id::text,
  case when pb.status = 'under_review' then 'batch_review_delayed' else 'batch_execution_delayed' end,
  case when now() - coalesce(pb.submitted_at,pb.updated_at,pb.created_at) > interval '5 days' then 'high' else 'medium' end,
  null, null, pb.name, pb.total_amount,
  coalesce(pb.submitted_at,pb.updated_at,pb.created_at),
  extract(day from now() - coalesce(pb.submitted_at,pb.updated_at,pb.created_at))::int,
  '/dashboard/finance/transfers/' || pb.id::text
from public.payment_batches pb
where (pb.status = 'under_review' and pb.submitted_at < now() - interval '2 days')
   or (pb.status in ('approved','exported','submitted_to_bank','processing') and pb.updated_at < now() - interval '3 days')
union all
select
  'product', pf.id::text,
  case when pf.status = 'shipped' then 'shipment_delayed' else 'product_preparation_delayed' end,
  case when now() - pf.updated_at > interval '7 days' then 'high' else 'medium' end,
  i.full_name, i.mobile_e164, c.name, public.payment_expected_amount(p),
  pf.updated_at,
  extract(day from now() - pf.updated_at)::int,
  '/dashboard/finance/products'
from public.product_fulfilments pf
join public.payments p on p.id = pf.payment_id
join public.campaign_assignments a on a.id = pf.assignment_id
join public.influencers i on i.id = pf.influencer_id
join public.campaigns c on c.id = a.campaign_id
where (pf.status in ('pending','preparing') and pf.updated_at < now() - interval '3 days')
   or (pf.status = 'shipped' and pf.updated_at < now() - interval '7 days');

grant select on public.finance_alerts to authenticated;

create or replace view public.finance_staff_performance as
with ledger_stats as (
  select
    actor_id,
    count(*) filter (where entry_type = 'bank_transfer_recorded')::int as transfers_recorded,
    coalesce(sum(amount) filter (where entry_type = 'bank_transfer_recorded'),0) as transferred_amount
  from public.payment_ledger
  where created_at >= date_trunc('month', now())
  group by actor_id
), batch_stats as (
  select
    created_by as actor_id,
    count(*)::int as batches_created,
    count(*) filter (where status = 'completed')::int as batches_completed,
    avg(extract(epoch from (completed_at - created_at))/3600) filter (where completed_at is not null) as avg_batch_hours
  from public.payment_batches
  where created_at >= date_trunc('month', now())
  group by created_by
), review_stats as (
  select reviewed_by as actor_id, count(*)::int as batches_reviewed
  from public.payment_batches
  where reviewed_at >= date_trunc('month', now())
  group by reviewed_by
), product_stats as (
  select updated_by as actor_id,
    count(*) filter (where status in ('delivered','received'))::int as products_completed
  from public.product_fulfilments
  where updated_at >= date_trunc('month', now())
  group by updated_by
)
select
  pr.id as profile_id,
  pr.full_name,
  pr.role,
  coalesce(ls.transfers_recorded,0) as transfers_recorded,
  coalesce(ls.transferred_amount,0) as transferred_amount,
  coalesce(bs.batches_created,0) as batches_created,
  coalesce(bs.batches_completed,0) as batches_completed,
  round(coalesce(bs.avg_batch_hours,0)::numeric,1) as avg_batch_hours,
  coalesce(rs.batches_reviewed,0) as batches_reviewed,
  coalesce(ps.products_completed,0) as products_completed
from public.profiles pr
left join ledger_stats ls on ls.actor_id = pr.id
left join batch_stats bs on bs.actor_id = pr.id
left join review_stats rs on rs.actor_id = pr.id
left join product_stats ps on ps.actor_id = pr.id
where pr.role in ('admin','finance') and pr.is_active = true;

grant select on public.finance_staff_performance to authenticated;

create or replace function public.mark_payment_batch_item_failed(
  p_item_id uuid,
  p_actor_id uuid,
  p_failure_category text,
  p_failure_reason text,
  p_bank_response_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.payment_batch_items%rowtype;
begin
  if not private.is_admin_or_finance() then raise exception 'FORBIDDEN'; end if;
  if coalesce(trim(p_failure_reason),'') = '' then raise exception 'FAILURE_REASON_REQUIRED'; end if;

  select * into v_item from public.payment_batch_items where id = p_item_id for update;
  if not found then raise exception 'BATCH_ITEM_NOT_FOUND'; end if;
  if v_item.item_status in ('transferred','completed') then raise exception 'TRANSFER_ALREADY_COMPLETED'; end if;

  update public.payment_batch_items
  set item_status = 'failed',
      failure_category = p_failure_category,
      failure_reason = p_failure_reason,
      failed_at = now(),
      failed_by = p_actor_id,
      bank_response_reference = nullif(trim(p_bank_response_reference),'')
  where id = p_item_id;

  update public.payments
  set status = 'ready_for_finance',
      finance_batch_number = null,
      ready_for_batch_at = now(),
      updated_at = now()
  where id = v_item.payment_id and status <> 'paid';

  insert into public.payment_ledger(payment_id, assignment_id, influencer_id, entry_type, amount, balance_effect, reference_type, reference_id, actor_id, metadata)
  values (v_item.payment_id, v_item.assignment_id, v_item.influencer_id, 'bank_transfer_failed', v_item.amount, 0,
    'payment_batch_item', v_item.id, p_actor_id,
    jsonb_build_object('category',p_failure_category,'reason',p_failure_reason,'bank_reference',p_bank_response_reference));
end;
$$;

grant execute on function public.mark_payment_batch_item_failed(uuid,uuid,text,text,text) to authenticated;

create or replace function public.register_payment_batch_item_retry(
  p_failed_item_id uuid,
  p_new_batch_item_id uuid,
  p_new_batch_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not private.is_admin_or_finance() then raise exception 'FORBIDDEN'; end if;
  update public.payment_batch_items
  set retry_payment_batch_id = p_new_batch_id
  where id = p_failed_item_id and item_status = 'failed';

  update public.payment_batch_items
  set retry_of_item_id = p_failed_item_id
  where id = p_new_batch_item_id;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values (p_actor_id,'payment_batch_item',p_new_batch_item_id,'failed_transfer_retried',jsonb_build_object('failed_item_id',p_failed_item_id,'new_batch_id',p_new_batch_id));
end;
$$;

grant execute on function public.register_payment_batch_item_retry(uuid,uuid,uuid,uuid) to authenticated;

notify pgrst, 'reload schema';
