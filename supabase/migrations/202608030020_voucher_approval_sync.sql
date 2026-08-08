-- Dar Al Amirat Influencer Platform
-- Keep voucher approval independent from bank-transfer approval.
-- Every voucher payment gets a voucher_issues row; website vouchers remain
-- in approval until finance explicitly transfers them to code preparation.

begin;

create or replace function private.sync_voucher_issue_from_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.campaign_assignments%rowtype;
  v_compensation public.assignment_compensations%rowtype;
  v_source_type text;
  v_amount numeric(12,2);
begin
  if new.type <> 'voucher' then
    return new;
  end if;

  select * into v_assignment
  from public.campaign_assignments
  where id = new.assignment_id;

  select * into v_compensation
  from public.assignment_compensations
  where id = new.compensation_id;

  if v_compensation.id is null then
    select * into v_compensation
    from public.assignment_compensations
    where assignment_id = new.assignment_id
      and type = 'voucher'
    order by created_at asc
    limit 1;
  end if;

  v_source_type := case
    when v_compensation.voucher_source = 'website'
      or v_compensation.voucher_redemption_method = 'website' then 'website'
    when v_compensation.voucher_source = 'branch' then 'branch'
    else 'coordinator_order'
  end;

  v_amount := coalesce(
    nullif(new.expected_amount, 0),
    nullif(new.amount, 0),
    nullif(v_compensation.amount, 0),
    0
  );

  insert into public.voucher_issues (
    payment_id,
    influencer_id,
    source_type,
    branch_id,
    coordinator_id,
    order_number,
    amount,
    status,
    notes
  ) values (
    new.id,
    v_assignment.influencer_id,
    v_source_type,
    v_compensation.voucher_branch_id,
    v_assignment.coordinator_id,
    v_assignment.order_number,
    v_amount,
    'pending',
    v_compensation.notes
  )
  on conflict (payment_id) do update
  set influencer_id = excluded.influencer_id,
      source_type = excluded.source_type,
      branch_id = excluded.branch_id,
      coordinator_id = excluded.coordinator_id,
      order_number = excluded.order_number,
      amount = excluded.amount,
      notes = coalesce(public.voucher_issues.notes, excluded.notes);

  return new;
end;
$$;

drop trigger if exists payments_sync_voucher_issue on public.payments;
create trigger payments_sync_voucher_issue
after insert or update of assignment_id, compensation_id, type, amount, expected_amount
on public.payments
for each row
when (new.type = 'voucher')
execute function private.sync_voucher_issue_from_payment();

-- Backfill missing voucher rows without borrowing approval state from payments.
insert into public.voucher_issues (
  payment_id,
  influencer_id,
  source_type,
  branch_id,
  coordinator_id,
  order_number,
  amount,
  status,
  notes
)
select
  p.id,
  a.influencer_id,
  case
    when ac.voucher_source = 'website' or ac.voucher_redemption_method = 'website' then 'website'
    when ac.voucher_source = 'branch' then 'branch'
    else 'coordinator_order'
  end,
  ac.voucher_branch_id,
  a.coordinator_id,
  a.order_number,
  coalesce(nullif(p.expected_amount, 0), nullif(p.amount, 0), nullif(ac.amount, 0), 0),
  'pending',
  ac.notes
from public.payments p
join public.campaign_assignments a on a.id = p.assignment_id
left join lateral (
  select ac1.*
  from public.assignment_compensations ac1
  where ac1.id = p.compensation_id
     or (ac1.assignment_id = p.assignment_id and ac1.type = 'voucher')
  order by case when ac1.id = p.compensation_id then 0 else 1 end, ac1.created_at asc
  limit 1
) ac on true
where p.type = 'voucher'
on conflict (payment_id) do update
set influencer_id = excluded.influencer_id,
    source_type = excluded.source_type,
    branch_id = excluded.branch_id,
    coordinator_id = excluded.coordinator_id,
    order_number = excluded.order_number,
    amount = excluded.amount;

-- Legacy website vouchers that were marked ready by the old payment status,
-- but were never explicitly transferred from the voucher approval screen,
-- return to the independent voucher approval queue.
with legacy as (
  select vi.id, vi.payment_id
  from public.voucher_issues vi
  where vi.source_type = 'website'
    and vi.status in ('preparing', 'ready')
    and vi.sent_at is null
    and vi.redeemed_at is null
    and not exists (
      select 1
      from public.activity_logs al
      where al.entity_type = 'voucher_issue'
        and al.entity_id = vi.id
        and al.action = 'voucher_transferred_to_preparation'
    )
), reset_issues as (
  update public.voucher_issues vi
  set status = 'pending',
      voucher_code = null,
      transferred_to_preparation_at = null,
      code_prepared_at = null,
      expires_at = null,
      sent_at = null,
      delivered_at = null
  from legacy l
  where vi.id = l.id
  returning vi.payment_id
)
update public.payments p
set voucher_status = 'pending',
    voucher_code = null,
    voucher_delivered_at = null,
    updated_at = now()
where p.id in (select payment_id from reset_issues);

notify pgrst, 'reload schema';

commit;
