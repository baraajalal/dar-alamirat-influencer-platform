-- Dar Al Amirat Influencer Platform
-- Keep payment values synchronized with assignment compensation values.
-- This fixes draft payments created after expected_amount received a default of 0.

begin;

-- Repair existing payment rows without changing completed transfer totals.
update public.payments p
set
  compensation_id = coalesce(p.compensation_id, ac.id),
  amount = case
    when coalesce(p.amount, 0) = 0 and coalesce(ac.amount, 0) > 0
      then ac.amount
    else p.amount
  end,
  expected_amount = case
    when coalesce(p.expected_amount, 0) = 0
         and coalesce(nullif(p.amount, 0), nullif(ac.amount, 0), 0) > 0
      then coalesce(nullif(p.amount, 0), ac.amount, 0)
    else p.expected_amount
  end,
  due_at = coalesce(p.due_at, ac.expected_payment_at),
  updated_at = now()
from public.assignment_compensations ac
where ac.assignment_id = p.assignment_id
  and ac.type = p.type
  and (p.compensation_id is null or p.compensation_id = ac.id)
  and (
    p.compensation_id is null
    or (coalesce(p.amount, 0) = 0 and coalesce(ac.amount, 0) > 0)
    or (
      coalesce(p.expected_amount, 0) = 0
      and coalesce(nullif(p.amount, 0), nullif(ac.amount, 0), 0) > 0
    )
    or (p.due_at is null and ac.expected_payment_at is not null)
  );

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
  v_effective_amount numeric(12,2);
begin
  if new.compensation_id is not null then
    select ac.amount, ac.expected_payment_at
      into v_compensation_amount, v_expected_payment_at
    from public.assignment_compensations ac
    where ac.id = new.compensation_id;
  else
    select ac.id, ac.amount, ac.expected_payment_at
      into v_compensation_id, v_compensation_amount, v_expected_payment_at
    from public.assignment_compensations ac
    where ac.assignment_id = new.assignment_id
      and ac.type = new.type
    limit 1;

    if v_compensation_id is not null then
      new.compensation_id := v_compensation_id;
    end if;
  end if;

  v_effective_amount := coalesce(
    nullif(new.amount, 0),
    nullif(v_compensation_amount, 0),
    0
  );

  if new.amount is null or (new.amount = 0 and v_effective_amount > 0) then
    new.amount := v_effective_amount;
  end if;

  if new.expected_amount is null
     or (new.expected_amount = 0 and v_effective_amount > 0) then
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

commit;

notify pgrst, 'reload schema';
