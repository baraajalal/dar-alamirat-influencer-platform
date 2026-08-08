-- Dar Al Amirat Influencer Platform
-- Single source of truth for bank-transfer amounts.
-- Resolves the amount from payments, the linked compensation, or the assignment
-- agreed amount, then exposes the real remaining amount to the finance UI.

begin;

create or replace function private.sync_payment_compensation_values()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compensation_id uuid;
  v_compensation_amount numeric(12,2);
  v_expected_payment_at timestamptz;
  v_assignment_amount numeric(12,2);
  v_effective_amount numeric(12,2);
begin
  select ac.id, ac.amount, ac.expected_payment_at
    into v_compensation_id, v_compensation_amount, v_expected_payment_at
  from public.assignment_compensations ac
  where ac.id = new.compensation_id
     or (ac.assignment_id = new.assignment_id and ac.type = new.type)
  order by case when ac.id = new.compensation_id then 0 else 1 end, ac.id
  limit 1;

  select a.agreed_amount
    into v_assignment_amount
  from public.campaign_assignments a
  where a.id = new.assignment_id;

  if new.compensation_id is null and v_compensation_id is not null then
    new.compensation_id := v_compensation_id;
  end if;

  v_effective_amount := coalesce(
    nullif(new.expected_amount, 0),
    nullif(new.amount, 0),
    nullif(v_compensation_amount, 0),
    nullif(v_assignment_amount, 0),
    0
  );

  if coalesce(new.amount, 0) = 0 and v_effective_amount > 0 then
    new.amount := v_effective_amount;
  end if;

  if coalesce(new.expected_amount, 0) = 0 and v_effective_amount > 0 then
    new.expected_amount := v_effective_amount;
  end if;

  new.due_at := coalesce(new.due_at, v_expected_payment_at);
  return new;
end;
$$;

revoke all on function private.sync_payment_compensation_values() from public;

drop trigger if exists payments_sync_compensation_values on public.payments;
create trigger payments_sync_compensation_values
before insert or update of compensation_id, assignment_id, type, amount, expected_amount, due_at
on public.payments
for each row execute function private.sync_payment_compensation_values();

-- Repair existing zero-valued payment rows from every available source.
with resolved as (
  select
    p.id as payment_id,
    ac.id as compensation_id,
    ac.expected_payment_at,
    coalesce(
      nullif(p.expected_amount, 0),
      nullif(p.amount, 0),
      nullif(ac.amount, 0),
      nullif(a.agreed_amount, 0),
      0
    )::numeric(12,2) as effective_amount
  from public.payments p
  join public.campaign_assignments a on a.id = p.assignment_id
  left join lateral (
    select ac1.id, ac1.amount, ac1.expected_payment_at
    from public.assignment_compensations ac1
    where ac1.id = p.compensation_id
       or (ac1.assignment_id = p.assignment_id and ac1.type = p.type)
    order by case when ac1.id = p.compensation_id then 0 else 1 end, ac1.id
    limit 1
  ) ac on true
)
update public.payments p
set
  compensation_id = coalesce(p.compensation_id, r.compensation_id),
  amount = case when coalesce(p.amount, 0) = 0 and r.effective_amount > 0 then r.effective_amount else p.amount end,
  expected_amount = case when coalesce(p.expected_amount, 0) = 0 and r.effective_amount > 0 then r.effective_amount else p.expected_amount end,
  due_at = coalesce(p.due_at, r.expected_payment_at),
  updated_at = now()
from resolved r
where p.id = r.payment_id
  and r.effective_amount > 0
  and (
    p.compensation_id is null
    or coalesce(p.amount, 0) = 0
    or coalesce(p.expected_amount, 0) = 0
    or (p.due_at is null and r.expected_payment_at is not null)
  );

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

-- Repair any already-created draft item that still contains zero.
update public.payment_batch_items i
set amount = v.remaining_amount
from public.finance_transfer_candidates v
where v.id = i.payment_id
  and coalesce(i.amount, 0) = 0
  and v.remaining_amount > 0;

commit;

notify pgrst, 'reload schema';
