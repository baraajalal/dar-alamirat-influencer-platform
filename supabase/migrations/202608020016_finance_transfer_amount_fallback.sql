-- Dar Al Amirat Influencer Platform
-- Repair zero payment amounts and keep finance transfer grouping aligned with
-- assignment_compensations. Database objects and completed transfers are preserved.

begin;

with resolved as (
  select
    p.id as payment_id,
    ac.id as compensation_id,
    ac.amount as compensation_amount,
    ac.expected_payment_at
  from public.payments p
  join lateral (
    select ac.id, ac.amount, ac.expected_payment_at
    from public.assignment_compensations ac
    where ac.assignment_id = p.assignment_id
      and ac.type = p.type
    order by
      case when ac.id = p.compensation_id then 0 else 1 end,
      ac.id
    limit 1
  ) ac on true
  where coalesce(p.expected_amount, 0) = 0
     or coalesce(p.amount, 0) = 0
     or p.compensation_id is null
     or (p.due_at is null and ac.expected_payment_at is not null)
)
update public.payments p
set
  compensation_id = coalesce(p.compensation_id, r.compensation_id),
  amount = case
    when coalesce(p.amount, 0) = 0 and coalesce(r.compensation_amount, 0) > 0
      then r.compensation_amount
    else p.amount
  end,
  expected_amount = case
    when coalesce(p.expected_amount, 0) = 0
         and coalesce(nullif(p.amount, 0), nullif(r.compensation_amount, 0), 0) > 0
      then coalesce(nullif(p.amount, 0), r.compensation_amount, 0)
    else p.expected_amount
  end,
  due_at = coalesce(p.due_at, r.expected_payment_at),
  updated_at = now()
from resolved r
where p.id = r.payment_id;

-- Repair any legacy batch item that was created before the positive amount
-- constraint existed. New rows are always snapshotted by the application.
with resolved_items as (
  select
    i.id as item_id,
    greatest(
      coalesce(nullif(p.expected_amount, 0), nullif(p.amount, 0), nullif(ac.amount, 0), 0)
      - coalesce(p.paid_amount, 0),
      0
    ) as due_amount
  from public.payment_batch_items i
  join public.payments p on p.id = i.payment_id
  left join public.assignment_compensations ac
    on ac.id = p.compensation_id
    or (
      p.compensation_id is null
      and ac.assignment_id = p.assignment_id
      and ac.type = p.type
    )
  where coalesce(i.amount, 0) = 0
)
update public.payment_batch_items i
set amount = r.due_amount
from resolved_items r
where i.id = r.item_id
  and r.due_amount > 0;

commit;

notify pgrst, 'reload schema';
