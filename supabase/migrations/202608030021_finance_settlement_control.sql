-- Unified financial settlement, append-only ledger, and proactive exception detection.

create table if not exists public.payment_ledger (
  id bigint generated always as identity primary key,
  payment_id uuid references public.payments(id) on delete set null,
  assignment_id uuid references public.campaign_assignments(id) on delete set null,
  influencer_id uuid references public.influencers(id) on delete set null,
  entry_type text not null,
  amount numeric not null default 0,
  balance_effect numeric not null default 0,
  reference_type text,
  reference_id uuid,
  status_before text,
  status_after text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists payment_ledger_payment_idx on public.payment_ledger(payment_id, created_at desc);
create index if not exists payment_ledger_assignment_idx on public.payment_ledger(assignment_id, created_at desc);

alter table public.payment_ledger enable row level security;
drop policy if exists payment_ledger_finance_select on public.payment_ledger;
create policy payment_ledger_finance_select on public.payment_ledger
for select to authenticated using (private.is_admin_or_finance());

-- Ledger entries are written by security-definer triggers/RPCs only.
revoke insert, update, delete on public.payment_ledger from authenticated;

grant select on public.payment_ledger to authenticated;

create or replace function public.payment_expected_amount(p public.payments)
returns numeric
language sql
stable
as $$
  select greatest(
    coalesce(nullif(p.expected_amount, 0), nullif(p.amount, 0), ac.amount, ca.agreed_amount, 0),
    0
  )
  from public.campaign_assignments ca
  left join public.assignment_compensations ac
    on ac.id = p.compensation_id
    or (p.compensation_id is null and ac.assignment_id = p.assignment_id and ac.type = p.type)
  where ca.id = p.assignment_id
  order by case when ac.id = p.compensation_id then 0 else 1 end
  limit 1;
$$;

create or replace view public.payment_execution_summary as
select
  p.id as payment_id,
  p.assignment_id,
  p.compensation_id,
  p.type,
  p.status,
  p.finance_review_status,
  public.payment_expected_amount(p) as expected_amount,
  case
    when p.type = 'bank_transfer' then greatest(coalesce((select sum(t.amount) from public.payment_transactions t where t.payment_id = p.id), p.paid_amount, 0), 0)
    when p.type = 'voucher' then case when vi.status in ('sent','redeemed','used') then public.payment_expected_amount(p) else 0 end
    when p.type = 'product' then case when p.product_status in ('delivered','received') or p.product_delivered_at is not null then public.payment_expected_amount(p) else 0 end
    else greatest(coalesce(p.paid_amount, 0), 0)
  end as executed_amount,
  case
    when p.type = 'bank_transfer' then coalesce((select sum(t.amount) from public.payment_transactions t where t.payment_id = p.id), p.paid_amount, 0)
    else coalesce(p.paid_amount, 0)
  end as cash_paid_amount,
  vi.status as voucher_execution_status,
  p.product_status,
  p.created_at,
  p.updated_at
from public.payments p
left join public.voucher_issues vi on vi.payment_id = p.id;

grant select on public.payment_execution_summary to authenticated;

create or replace view public.assignment_financial_settlements as
select
  a.id as assignment_id,
  a.influencer_id,
  a.campaign_id,
  i.full_name as influencer_name,
  i.mobile_e164 as mobile,
  c.name as campaign_name,
  c.brand as brand_name,
  a.status as assignment_status,
  a.settled_at,
  a.availability_blocked_until,
  count(pes.payment_id)::int as payment_count,
  coalesce(sum(pes.expected_amount), 0) as expected_total,
  coalesce(sum(least(pes.executed_amount, pes.expected_amount)), 0) as executed_total,
  greatest(coalesce(sum(pes.expected_amount), 0) - coalesce(sum(least(pes.executed_amount, pes.expected_amount)), 0), 0) as remaining_total,
  count(*) filter (where pes.expected_amount <= 0)::int as zero_amount_count,
  count(*) filter (where pes.expected_amount > 0 and pes.executed_amount < pes.expected_amount and pes.finance_review_status = 'approved')::int as pending_execution_count,
  count(*) filter (where pes.finance_review_status in ('pending','returned'))::int as pending_approval_count,
  bool_and(pes.expected_amount > 0 and pes.executed_amount >= pes.expected_amount) filter (where pes.payment_id is not null) as fully_settled,
  max(pes.updated_at) as last_financial_activity_at
from public.campaign_assignments a
join public.influencers i on i.id = a.influencer_id
join public.campaigns c on c.id = a.campaign_id
left join public.payment_execution_summary pes on pes.assignment_id = a.id
where exists (select 1 from public.payments p0 where p0.assignment_id = a.id)
group by a.id, i.full_name, i.mobile_e164, c.name, c.brand;

grant select on public.assignment_financial_settlements to authenticated;

create or replace view public.finance_exceptions as
with payment_base as (
  select
    pes.*,
    a.influencer_id,
    i.full_name as influencer_name,
    i.mobile_e164 as mobile,
    c.name as campaign_name,
    fp.bank_profile_status,
    fp.iban,
    fp.account_holder_name,
    vi.status as voucher_status,
    vi.voucher_code,
    vi.expires_at,
    vi.delivered_at
  from public.payment_execution_summary pes
  join public.campaign_assignments a on a.id = pes.assignment_id
  join public.influencers i on i.id = a.influencer_id
  join public.campaigns c on c.id = a.campaign_id
  left join public.influencer_financial_profiles fp on fp.influencer_id = a.influencer_id
  left join public.voucher_issues vi on vi.payment_id = pes.payment_id
)
select gen_random_uuid() as exception_id, payment_id, assignment_id, influencer_id, influencer_name, mobile, campaign_name,
  'zero_amount'::text as exception_type, 'high'::text as severity,
  'المستحق لا يحتوي على مبلغ صالح'::text as title,
  'راجع مبلغ الاتفاق أو المقابل قبل الاعتماد.'::text as details,
  created_at as detected_from
from payment_base where expected_amount <= 0 and status <> 'cancelled'
union all
select gen_random_uuid(), payment_id, assignment_id, influencer_id, influencer_name, mobile, campaign_name,
  'bank_profile_not_ready', 'high', 'تحويل معتمد بلا بيانات بنكية مكتملة',
  'بيانات البنك غير معتمدة أو الآيبان/اسم المستفيد ناقص.', created_at
from payment_base
where type = 'bank_transfer' and finance_review_status = 'approved' and status <> 'paid'
  and (bank_profile_status <> 'approved' or iban is null or account_holder_name is null)
union all
select gen_random_uuid(), payment_id, assignment_id, influencer_id, influencer_name, mobile, campaign_name,
  'overpaid', 'critical', 'المبلغ المنفذ أكبر من المستحق',
  'يجب مراجعة حركات التحويل والتأكد من عدم التكرار.', updated_at
from payment_base where executed_amount > expected_amount and expected_amount > 0
union all
select gen_random_uuid(), payment_id, assignment_id, influencer_id, influencer_name, mobile, campaign_name,
  'voucher_ready_without_code', 'medium', 'قسيمة جاهزة بلا كود',
  'أدخل كود القسيمة قبل تحويلها إلى جاهزة للتوزيع.', updated_at
from payment_base where type = 'voucher' and voucher_status in ('ready','sent') and coalesce(voucher_code,'') = ''
union all
select gen_random_uuid(), payment_id, assignment_id, influencer_id, influencer_name, mobile, campaign_name,
  'voucher_expired_unsent', 'high', 'قسيمة انتهت قبل الإرسال',
  'أنشئ كودًا جديدًا أو ألغِ القسيمة مع تسجيل السبب.', expires_at
from payment_base where type = 'voucher' and voucher_status not in ('sent','redeemed','used','cancelled') and expires_at < now()
union all
select gen_random_uuid(), payment_id, assignment_id, influencer_id, influencer_name, mobile, campaign_name,
  'approved_stale', 'medium', 'مستحق معتمد ولم يتحرك',
  'مر أكثر من 3 أيام على الاعتماد دون تنفيذ أو ترحيل.', updated_at
from payment_base
where finance_review_status = 'approved' and executed_amount < expected_amount and updated_at < now() - interval '3 days'
union all
select gen_random_uuid(), payment_id, assignment_id, influencer_id, influencer_name, mobile, campaign_name,
  'paid_state_mismatch', 'high', 'المستحق منفذ لكن حالته غير مكتملة',
  'المبلغ منفذ بالكامل وتحتاج الحالة إلى مزامنة.', updated_at
from payment_base
where expected_amount > 0 and executed_amount >= expected_amount and status not in ('paid','cancelled');

grant select on public.finance_exceptions to authenticated;

create or replace function public.append_payment_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.campaign_assignments%rowtype;
  v_expected numeric;
begin
  select * into v_assignment from public.campaign_assignments where id = new.assignment_id;
  v_expected := public.payment_expected_amount(new);

  if tg_op = 'INSERT' then
    insert into public.payment_ledger(payment_id, assignment_id, influencer_id, entry_type, amount, balance_effect, status_after, metadata)
    values (new.id, new.assignment_id, v_assignment.influencer_id, 'payment_created', v_expected, v_expected, new.status::text,
      jsonb_build_object('type', new.type, 'finance_review_status', new.finance_review_status));
  elsif old.status is distinct from new.status
     or old.finance_review_status is distinct from new.finance_review_status
     or old.expected_amount is distinct from new.expected_amount
     or old.amount is distinct from new.amount then
    insert into public.payment_ledger(payment_id, assignment_id, influencer_id, entry_type, amount, balance_effect, status_before, status_after, metadata)
    values (new.id, new.assignment_id, v_assignment.influencer_id, 'payment_changed', v_expected, 0, old.status::text, new.status::text,
      jsonb_build_object('type', new.type, 'old_review', old.finance_review_status, 'new_review', new.finance_review_status));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_ledger on public.payments;
create trigger trg_payment_ledger
after insert or update on public.payments
for each row execute function public.append_payment_ledger_entry();

create or replace function public.append_transaction_ledger_entry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_assignment public.campaign_assignments%rowtype;
begin
  select * into v_payment from public.payments where id = new.payment_id;
  select * into v_assignment from public.campaign_assignments where id = v_payment.assignment_id;
  insert into public.payment_ledger(payment_id, assignment_id, influencer_id, entry_type, amount, balance_effect, reference_type, reference_id, actor_id, metadata)
  values (new.payment_id, v_payment.assignment_id, v_assignment.influencer_id, 'bank_transfer_recorded', new.amount, -new.amount,
    'payment_transaction', new.id, new.created_by, jsonb_build_object('transfer_reference', new.transfer_reference, 'batch', new.finance_batch_number));
  return new;
end;
$$;

drop trigger if exists trg_transaction_ledger on public.payment_transactions;
create trigger trg_transaction_ledger
after insert on public.payment_transactions
for each row execute function public.append_transaction_ledger_entry();

create or replace function public.refresh_assignment_financial_settlement(p_assignment_id uuid, p_actor_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary public.assignment_financial_settlements%rowtype;
  v_now timestamptz := now();
begin
  select * into v_summary from public.assignment_financial_settlements where assignment_id = p_assignment_id;
  if not found then return false; end if;

  if coalesce(v_summary.fully_settled, false) and v_summary.expected_total > 0 and v_summary.remaining_total = 0 then
    update public.campaign_assignments
    set status = 'paid',
        settled_at = coalesce(settled_at, v_now),
        availability_blocked_until = greatest(coalesce(availability_blocked_until, v_now), coalesce(settled_at, v_now) + interval '45 days'),
        updated_at = v_now
    where id = p_assignment_id and status not in ('closed','cancelled','rejected');

    insert into public.activity_logs(actor_id, entity_type, entity_id, action, metadata)
    values (p_actor_id, 'campaign_assignment', p_assignment_id, 'financial_settlement_completed',
      jsonb_build_object('expected_total', v_summary.expected_total, 'executed_total', v_summary.executed_total));
    return true;
  end if;
  return false;
end;
$$;

grant execute on function public.refresh_assignment_financial_settlement(uuid, uuid) to authenticated;

create or replace function public.auto_refresh_assignment_settlement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_id uuid;
begin
  if tg_table_name = 'payments' then
    v_assignment_id := new.assignment_id;
  elsif tg_table_name = 'payment_transactions' then
    select assignment_id into v_assignment_id from public.payments where id = new.payment_id;
  elsif tg_table_name = 'voucher_issues' then
    select assignment_id into v_assignment_id from public.payments where id = new.payment_id;
  end if;
  if v_assignment_id is not null then
    perform public.refresh_assignment_financial_settlement(v_assignment_id, null);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_settlement_refresh on public.payments;
create trigger trg_payment_settlement_refresh after insert or update on public.payments
for each row execute function public.auto_refresh_assignment_settlement();

drop trigger if exists trg_transaction_settlement_refresh on public.payment_transactions;
create trigger trg_transaction_settlement_refresh after insert on public.payment_transactions
for each row execute function public.auto_refresh_assignment_settlement();

drop trigger if exists trg_voucher_settlement_refresh on public.voucher_issues;
create trigger trg_voucher_settlement_refresh after insert or update on public.voucher_issues
for each row execute function public.auto_refresh_assignment_settlement();

notify pgrst, 'reload schema';
