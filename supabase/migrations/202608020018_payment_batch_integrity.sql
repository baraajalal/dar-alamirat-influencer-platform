-- Dar Al Amirat Influencer Platform
-- Payment transfer integrity patch.
-- Keeps the current workflow intact while preventing zero-value drafts and
-- completing batches atomically without overwriting earlier partial payments.

begin;

-- Keep one canonical transfer view for the finance screens and batch creation.
create or replace view public.finance_transfer_candidates
with (security_invoker = true)
as
select
  p.id,
  p.assignment_id,
  p.compensation_id,
  p.type,
  p.status,
  p.finance_review_status,
  p.contract_review_status,
  p.expected_amount,
  p.amount,
  p.paid_amount,
  p.transfer_method,
  p.manual_transfer_reason,
  p.ready_for_batch_at,
  p.due_at,
  p.created_at,
  p.updated_at,
  ac.id as resolved_compensation_id,
  coalesce(
    nullif(p.expected_amount, 0),
    nullif(p.amount, 0),
    nullif(ac.amount, 0),
    nullif(a.agreed_amount, 0),
    0
  )::numeric(12,2) as effective_amount,
  greatest(
    coalesce(
      nullif(p.expected_amount, 0),
      nullif(p.amount, 0),
      nullif(ac.amount, 0),
      nullif(a.agreed_amount, 0),
      0
    ) - coalesce(p.paid_amount, 0),
    0
  )::numeric(12,2) as remaining_amount
from public.payments p
join public.campaign_assignments a on a.id = p.assignment_id
left join lateral (
  select ac1.id, ac1.amount
  from public.assignment_compensations ac1
  where ac1.id = p.compensation_id
     or (ac1.assignment_id = p.assignment_id and ac1.type = p.type)
  order by case when ac1.id = p.compensation_id then 0 else 1 end, ac1.id
  limit 1
) ac on true;

grant select on public.finance_transfer_candidates to authenticated;

-- Repair legacy payments whose amount fields are still empty or zero.
update public.payments p
set
  compensation_id = coalesce(p.compensation_id, v.resolved_compensation_id),
  amount = case
    when coalesce(p.amount, 0) = 0 and v.effective_amount > 0 then v.effective_amount
    else p.amount
  end,
  expected_amount = case
    when coalesce(p.expected_amount, 0) = 0 and v.effective_amount > 0 then v.effective_amount
    else p.expected_amount
  end,
  updated_at = now()
from public.finance_transfer_candidates v
where v.id = p.id
  and v.effective_amount > 0
  and (
    p.compensation_id is null
    or coalesce(p.amount, 0) = 0
    or coalesce(p.expected_amount, 0) = 0
  );

-- Repair old draft items. New items are already protected by amount > 0.
update public.payment_batch_items i
set amount = v.remaining_amount
from public.finance_transfer_candidates v
where v.id = i.payment_id
  and coalesce(i.amount, 0) = 0
  and v.remaining_amount > 0;

-- Complete the whole transfer batch in one database transaction.
-- paid_amount is cumulative, so a previous partial payment is never lost.
create or replace function public.complete_payment_batch(
  p_batch_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.payment_batches%rowtype;
  v_item record;
  v_effective numeric(12,2);
  v_current_paid numeric(12,2);
  v_new_paid numeric(12,2);
  v_paid_count integer := 0;
  v_now timestamptz := now();
begin
  select *
  into v_batch
  from public.payment_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'PAYMENT_BATCH_NOT_FOUND';
  end if;

  if v_batch.status not in ('approved', 'exported', 'submitted_to_bank', 'processing') then
    raise exception 'PAYMENT_BATCH_NOT_COMPLETABLE';
  end if;

  for v_item in
    select i.id, i.payment_id, i.amount, p.paid_amount,
           coalesce(
             nullif(p.expected_amount, 0),
             nullif(p.amount, 0),
             nullif(ac.amount, 0),
             nullif(a.agreed_amount, 0),
             0
           )::numeric(12,2) as effective_amount
    from public.payment_batch_items i
    join public.payments p on p.id = i.payment_id
    join public.campaign_assignments a on a.id = p.assignment_id
    left join lateral (
      select ac1.amount
      from public.assignment_compensations ac1
      where ac1.id = p.compensation_id
         or (ac1.assignment_id = p.assignment_id and ac1.type = p.type)
      order by case when ac1.id = p.compensation_id then 0 else 1 end, ac1.id
      limit 1
    ) ac on true
    where i.batch_id = p_batch_id
      and i.item_status <> 'cancelled'
    for update of i, p
  loop
    if coalesce(v_item.amount, 0) <= 0 then
      raise exception 'PAYMENT_BATCH_ITEM_AMOUNT_INVALID';
    end if;

    v_effective := coalesce(v_item.effective_amount, 0);
    if v_effective <= 0 then
      raise exception 'PAYMENT_EFFECTIVE_AMOUNT_INVALID';
    end if;

    v_current_paid := coalesce(v_item.paid_amount, 0);
    v_new_paid := least(v_effective, v_current_paid + v_item.amount);

    update public.payments
    set
      paid_amount = v_new_paid,
      status = case when v_new_paid >= v_effective then 'paid'::public.payment_status else 'partially_paid'::public.payment_status end,
      paid_at = case when v_new_paid >= v_effective then v_now else paid_at end,
      finance_batch_number = v_batch.batch_code,
      updated_at = v_now
    where id = v_item.payment_id;

    update public.payment_batch_items
    set item_status = 'paid', transferred_at = v_now
    where id = v_item.id;

    v_paid_count := v_paid_count + 1;
  end loop;

  if v_paid_count = 0 then
    raise exception 'PAYMENT_BATCH_HAS_NO_ACTIVE_ITEMS';
  end if;

  update public.payment_batches
  set status = 'completed', completed_at = v_now, updated_at = v_now
  where id = p_batch_id;

  insert into public.activity_logs(actor_id, entity_type, entity_id, action, metadata)
  values (
    p_actor_id,
    'payment_batch',
    p_batch_id,
    'payment_batch_complete',
    jsonb_build_object('item_count', v_paid_count, 'batch_code', v_batch.batch_code)
  );

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'batch_code', v_batch.batch_code,
    'item_count', v_paid_count,
    'completed_at', v_now
  );
end;
$$;

revoke all on function public.complete_payment_batch(uuid, uuid) from public;
grant execute on function public.complete_payment_batch(uuid, uuid) to authenticated, service_role;

commit;

notify pgrst, 'reload schema';
