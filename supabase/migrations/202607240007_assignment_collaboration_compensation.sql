-- Dar Al Amirat Influencer Platform
-- Collaboration type, reusable branches, multiple compensations, contracts, and budget-safe assignment creation.

begin;

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists branches_active_name_idx
  on public.branches (is_active, name);

insert into public.branches (name, normalized_name)
values
  ('الصحافة', 'الصحافة'),
  ('أبو بكر', 'أبو بكر'),
  ('التخصصي', 'التخصصي')
on conflict (normalized_name) do nothing;

alter table public.branches enable row level security;

drop policy if exists branches_staff_select on public.branches;
create policy branches_staff_select
on public.branches
for select
to authenticated
using ((select private.is_staff()));

drop policy if exists branches_admin_coordinator_insert on public.branches;
create policy branches_admin_coordinator_insert
on public.branches
for insert
to authenticated
with check (
  (select private.current_user_role()) in ('admin', 'coordinator')
);

drop policy if exists branches_admin_coordinator_update on public.branches;
create policy branches_admin_coordinator_update
on public.branches
for update
to authenticated
using (
  (select private.current_user_role()) in ('admin', 'coordinator')
)
with check (
  (select private.current_user_role()) in ('admin', 'coordinator')
);

drop trigger if exists branches_set_updated_at on public.branches;
create trigger branches_set_updated_at
before update on public.branches
for each row execute function public.set_updated_at();

alter table public.campaign_assignments
  add column if not exists branch_id uuid references public.branches(id) on delete set null,
  add column if not exists attendance_at timestamptz,
  add column if not exists other_execution_details text,
  add column if not exists requires_content boolean not null default true,
  add column if not exists order_notes text,
  add column if not exists has_contract boolean not null default false,
  add column if not exists contract_reference text,
  add column if not exists agreement_date date,
  add column if not exists payment_timing text,
  add column if not exists contract_notes text;

alter table public.campaign_assignments
  drop constraint if exists campaign_assignments_order_invoice_amount_check;

alter table public.campaign_assignments
  add constraint campaign_assignments_order_invoice_amount_check
  check (order_invoice_amount is null or order_invoice_amount >= 0);

alter table public.campaign_assignments
  drop constraint if exists campaign_assignments_payment_timing_check;

alter table public.campaign_assignments
  add constraint campaign_assignments_payment_timing_check
  check (
    payment_timing is null
    or payment_timing in ('before_publish', 'after_publish', 'by_agreement')
  );

create index if not exists assignments_branch_idx
  on public.campaign_assignments (branch_id, attendance_at);

create index if not exists assignments_contract_idx
  on public.campaign_assignments (has_contract, payment_timing);

alter table public.assignment_compensations
  add column if not exists expected_payment_at timestamptz,
  add column if not exists voucher_redemption_method text,
  add column if not exists voucher_branch_id uuid references public.branches(id) on delete set null,
  add column if not exists product_description text,
  add column if not exists product_reference_value numeric(12,2),
  add column if not exists updated_at timestamptz not null default now();

alter table public.assignment_compensations
  drop constraint if exists assignment_compensations_amount_check;

alter table public.assignment_compensations
  add constraint assignment_compensations_amount_check
  check (amount is null or amount >= 0);

alter table public.assignment_compensations
  drop constraint if exists assignment_compensations_product_reference_value_check;

alter table public.assignment_compensations
  add constraint assignment_compensations_product_reference_value_check
  check (product_reference_value is null or product_reference_value >= 0);

alter table public.assignment_compensations
  drop constraint if exists assignment_compensations_voucher_method_check;

alter table public.assignment_compensations
  add constraint assignment_compensations_voucher_method_check
  check (
    voucher_redemption_method is null
    or voucher_redemption_method in ('website', 'branch')
  );

drop trigger if exists assignment_compensations_set_updated_at on public.assignment_compensations;
create trigger assignment_compensations_set_updated_at
before update on public.assignment_compensations
for each row execute function public.set_updated_at();

create or replace function private.get_or_create_branch(
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '[[:space:]]+', ' ', 'g');
  v_normalized text;
  v_branch_id uuid;
begin
  if v_name = '' then
    return null;
  end if;

  v_normalized := lower(v_name);

  select b.id into v_branch_id
  from public.branches b
  where b.normalized_name = v_normalized;

  if v_branch_id is not null then
    update public.branches
    set is_active = true,
        updated_at = now()
    where id = v_branch_id;
    return v_branch_id;
  end if;

  begin
    insert into public.branches (
      name,
      normalized_name,
      created_by
    )
    values (
      v_name,
      v_normalized,
      auth.uid()
    )
    returning id into v_branch_id;
  exception when unique_violation then
    select b.id into v_branch_id
    from public.branches b
    where b.normalized_name = v_normalized;
  end;

  return v_branch_id;
end;
$$;

revoke all on function private.get_or_create_branch(text) from public;

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
          select 1
          from public.assignment_compensations ac0
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
    select coalesce(sum(coalesce(p.amount, 0)) filter (
      where p.status = 'paid'
        and p.type in ('bank_transfer', 'voucher')
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
    case
      when t.budget > 0 then round((t.committed / t.budget) * 100, 2)
      else null
    end
  from totals t cross join paid p;
end;
$$;

revoke all on function public.campaign_budget_summary(uuid) from public;
grant execute on function public.campaign_budget_summary(uuid) to authenticated;

create or replace function public.create_campaign_assignment_bundle_v2(
  p_campaign_id uuid,
  p_influencer_id uuid,
  p_execution_type text,
  p_other_execution_details text,
  p_requires_content boolean,
  p_content_due_at timestamptz,
  p_publishing_date date,
  p_branch_name text,
  p_attendance_at timestamptz,
  p_order_number text,
  p_order_invoice_amount numeric,
  p_order_notes text,
  p_has_contract boolean,
  p_contract_reference text,
  p_agreement_date date,
  p_payment_timing text,
  p_contract_notes text,
  p_coordinator_notes text,
  p_currency text,
  p_compensations jsonb,
  p_platforms jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_assignment_id uuid;
  v_platform jsonb;
  v_deliverable jsonb;
  v_compensation jsonb;
  v_platform_id uuid;
  v_social_account_id uuid;
  v_content_type text;
  v_quantity integer;
  v_sequence integer;
  v_counter integer;
  v_available record;
  v_branch_id uuid;
  v_branch_name text;
  v_voucher_branch_id uuid;
  v_voucher_branch_name text;
  v_compensation_id uuid;
  v_type public.payment_type;
  v_amount numeric;
  v_budget_amount numeric := 0;
  v_product_value numeric;
  v_currency text := coalesce(nullif(upper(trim(p_currency)), ''), 'SAR');
  v_seen_types text[] := '{}'::text[];
  v_requires_content boolean;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true;

  if v_role is null or v_role not in ('admin', 'coordinator') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not exists (select 1 from public.campaigns c where c.id = p_campaign_id) then
    raise exception 'CAMPAIGN_NOT_FOUND';
  end if;

  if not exists (select 1 from public.influencers i where i.id = p_influencer_id) then
    raise exception 'INFLUENCER_NOT_FOUND';
  end if;

  if p_execution_type not in ('home', 'in_branch', 'remote') then
    raise exception 'INVALID_EXECUTION_TYPE';
  end if;

  v_requires_content := case
    when p_execution_type in ('home', 'in_branch') then true
    else coalesce(p_requires_content, true)
  end;

  if jsonb_typeof(coalesce(p_platforms, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_platforms, '[]'::jsonb)) = 0 then
    raise exception 'PLATFORM_REQUIRED';
  end if;

  if jsonb_typeof(coalesce(p_compensations, '[]'::jsonb)) <> 'array' then
    raise exception 'INVALID_COMPENSATIONS';
  end if;

  if p_execution_type = 'home' then
    if nullif(trim(coalesce(p_order_number, '')), '') is null then
      raise exception 'ORDER_NUMBER_REQUIRED';
    end if;
    if p_order_invoice_amount is null or p_order_invoice_amount < 0 then
      raise exception 'ORDER_AMOUNT_REQUIRED';
    end if;
  end if;

  if p_execution_type = 'in_branch' then
    if nullif(trim(coalesce(p_branch_name, '')), '') is null then
      raise exception 'BRANCH_REQUIRED';
    end if;
    v_branch_id := private.get_or_create_branch(p_branch_name);
    select b.name into v_branch_name from public.branches b where b.id = v_branch_id;
  end if;

  if p_execution_type = 'remote'
     and nullif(trim(coalesce(p_other_execution_details, '')), '') is null then
    raise exception 'OTHER_EXECUTION_DETAILS_REQUIRED';
  end if;

  if coalesce(p_has_contract, false)
     and coalesce(p_payment_timing, '') not in ('before_publish', 'after_publish', 'by_agreement') then
    raise exception 'PAYMENT_TIMING_REQUIRED';
  end if;

  for v_compensation in
    select value from jsonb_array_elements(coalesce(p_compensations, '[]'::jsonb))
  loop
    if coalesce(v_compensation->>'type', '') not in ('bank_transfer', 'voucher', 'product') then
      raise exception 'INVALID_COMPENSATION_TYPE';
    end if;

    if (v_compensation->>'type') = any(v_seen_types) then
      raise exception 'DUPLICATE_COMPENSATION_TYPE';
    end if;
    v_seen_types := array_append(v_seen_types, v_compensation->>'type');

    v_amount := coalesce(nullif(v_compensation->>'amount', '')::numeric, 0);
    if v_amount < 0 then
      raise exception 'INVALID_COMPENSATION_AMOUNT';
    end if;

    if (v_compensation->>'type') in ('bank_transfer', 'voucher') and v_amount <= 0 then
      raise exception 'COMPENSATION_AMOUNT_REQUIRED';
    end if;

    if (v_compensation->>'type') = 'voucher' then
      if coalesce(v_compensation->>'voucherSource', '') not in ('website', 'branch') then
        raise exception 'VOUCHER_SOURCE_REQUIRED';
      end if;
      if v_compensation->>'voucherSource' = 'branch' then
        if nullif(trim(coalesce(v_compensation->>'voucherBranch', '')), '') is null then
          raise exception 'VOUCHER_BRANCH_REQUIRED';
        end if;
      end if;
    end if;

    if (v_compensation->>'type') = 'product' then
      if v_amount <> 0 then
        raise exception 'PRODUCT_CASH_AMOUNT_MUST_BE_ZERO';
      end if;
      if nullif(trim(coalesce(v_compensation->>'productDescription', '')), '') is null then
        raise exception 'PRODUCT_DESCRIPTION_REQUIRED';
      end if;
      v_product_value := coalesce(
        nullif(v_compensation->>'productReferenceValue', '')::numeric,
        0
      );
      if v_product_value < 0 then
        raise exception 'INVALID_PRODUCT_REFERENCE_VALUE';
      end if;
    end if;

    if (v_compensation->>'type') in ('bank_transfer', 'voucher') then
      v_budget_amount := v_budget_amount + v_amount;
    end if;
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_influencer_id::text, 0)
  );

  select * into v_available
  from public.influencer_campaign_availability(p_influencer_id);

  if not v_available.available then
    raise exception using
      message = 'INFLUENCER_UNAVAILABLE',
      detail = jsonb_build_object(
        'reason', v_available.reason,
        'campaignId', v_available.blocking_campaign_id,
        'campaignName', v_available.blocking_campaign_name,
        'blockedUntil', v_available.blocked_until,
        'daysRemaining', v_available.days_remaining
      )::text;
  end if;

  insert into public.campaign_assignments (
    campaign_id,
    influencer_id,
    coordinator_id,
    status,
    execution_type,
    other_execution_details,
    requires_content,
    content_due_at,
    publishing_date,
    branch_id,
    branch,
    attendance_at,
    order_number,
    order_invoice_amount,
    order_notes,
    has_contract,
    contract_reference,
    agreement_date,
    payment_timing,
    contract_notes,
    coordinator_notes,
    agreed_amount,
    currency,
    invited_at,
    source
  )
  values (
    p_campaign_id,
    p_influencer_id,
    auth.uid(),
    'invited',
    p_execution_type::public.execution_type,
    nullif(trim(p_other_execution_details), ''),
    v_requires_content,
    case when v_requires_content then p_content_due_at else null end,
    case when v_requires_content then p_publishing_date else null end,
    v_branch_id,
    v_branch_name,
    p_attendance_at,
    nullif(trim(p_order_number), ''),
    p_order_invoice_amount,
    nullif(trim(p_order_notes), ''),
    coalesce(p_has_contract, false),
    nullif(trim(p_contract_reference), ''),
    p_agreement_date,
    case
      when coalesce(p_has_contract, false) then nullif(p_payment_timing, '')
      else null
    end,
    nullif(trim(p_contract_notes), ''),
    nullif(trim(p_coordinator_notes), ''),
    v_budget_amount,
    v_currency,
    now(),
    'portal'
  )
  returning id into v_assignment_id;

  for v_platform in
    select value from jsonb_array_elements(p_platforms)
  loop
    v_social_account_id := nullif(v_platform->>'socialAccountId', '')::uuid;

    if not exists (
      select 1 from public.social_accounts sa
      where sa.id = v_social_account_id
        and sa.influencer_id = p_influencer_id
    ) then
      raise exception 'INVALID_SOCIAL_ACCOUNT';
    end if;

    if jsonb_typeof(coalesce(v_platform->'deliverables', '[]'::jsonb)) <> 'array' then
      raise exception 'INVALID_DELIVERABLES';
    end if;

    if v_requires_content
       and jsonb_array_length(coalesce(v_platform->'deliverables', '[]'::jsonb)) = 0 then
      raise exception 'DELIVERABLE_REQUIRED';
    end if;

    insert into public.assignment_platforms (
      assignment_id,
      social_account_id,
      required_deliverables
    )
    values (
      v_assignment_id,
      v_social_account_id,
      coalesce(v_platform->'deliverables', '[]'::jsonb)
    )
    returning id into v_platform_id;

    v_sequence := 1;

    for v_deliverable in
      select value from jsonb_array_elements(coalesce(v_platform->'deliverables', '[]'::jsonb))
    loop
      v_content_type := nullif(trim(v_deliverable->>'contentType'), '');
      v_quantity := greatest(1, least(coalesce((v_deliverable->>'quantity')::integer, 1), 50));

      if v_content_type is null then
        raise exception 'CONTENT_TYPE_REQUIRED';
      end if;

      for v_counter in 1..v_quantity loop
        insert into public.content_items (
          assignment_platform_id,
          sequence_no,
          content_type,
          status
        )
        values (
          v_platform_id,
          v_sequence,
          v_content_type,
          'draft'
        );
        v_sequence := v_sequence + 1;
      end loop;
    end loop;
  end loop;

  for v_compensation in
    select value from jsonb_array_elements(coalesce(p_compensations, '[]'::jsonb))
  loop
    v_type := (v_compensation->>'type')::public.payment_type;
    v_amount := coalesce(nullif(v_compensation->>'amount', '')::numeric, 0);
    v_voucher_branch_id := null;
    v_voucher_branch_name := null;
    v_product_value := coalesce(
      nullif(v_compensation->>'productReferenceValue', '')::numeric,
      0
    );

    if v_type = 'voucher'
       and v_compensation->>'voucherSource' = 'branch' then
      v_voucher_branch_id := private.get_or_create_branch(v_compensation->>'voucherBranch');
      select b.name into v_voucher_branch_name
      from public.branches b
      where b.id = v_voucher_branch_id;
    end if;

    insert into public.assignment_compensations (
      assignment_id,
      type,
      amount,
      voucher_source,
      voucher_branch,
      voucher_redemption_method,
      voucher_branch_id,
      expected_payment_at,
      product_description,
      product_reference_value,
      notes
    )
    values (
      v_assignment_id,
      v_type,
      v_amount,
      case when v_type = 'voucher' then v_compensation->>'voucherSource' else null end,
      case when v_type = 'voucher' then v_voucher_branch_name else null end,
      case when v_type = 'voucher' then v_compensation->>'voucherSource' else null end,
      v_voucher_branch_id,
      nullif(v_compensation->>'expectedPaymentAt', '')::timestamptz,
      case when v_type = 'product' then nullif(trim(v_compensation->>'productDescription'), '') else null end,
      case when v_type = 'product' then v_product_value else null end,
      nullif(trim(v_compensation->>'notes'), '')
    )
    returning id into v_compensation_id;

    insert into public.payments (
      assignment_id,
      compensation_id,
      type,
      amount,
      status,
      finance_notes
    )
    values (
      v_assignment_id,
      v_compensation_id,
      v_type,
      v_amount,
      'draft',
      case
        when coalesce(p_has_contract, false) and p_payment_timing = 'before_publish'
          then 'التعاون مرتبط بعقد، وتوقيت الدفع قبل النشر.'
        when coalesce(p_has_contract, false) and p_payment_timing = 'after_publish'
          then 'التعاون مرتبط بعقد، وتوقيت الدفع بعد النشر.'
        when coalesce(p_has_contract, false)
          then 'التعاون مرتبط بعقد، والدفع حسب الاتفاق.'
        when v_type = 'product'
          then 'يُستخدم سجل الدفع لتأكيد تسليم مقابل المنتجات.'
        else null
      end
    );
  end loop;

  insert into public.activity_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    metadata
  )
  values (
    auth.uid(),
    'campaign_assignment',
    v_assignment_id,
    'influencer_added_to_campaign',
    jsonb_build_object(
      'campaignId', p_campaign_id,
      'influencerId', p_influencer_id,
      'executionType', p_execution_type,
      'budgetAmount', v_budget_amount,
      'currency', v_currency,
      'hasContract', coalesce(p_has_contract, false),
      'compensationTypes', v_seen_types
    )
  );

  return v_assignment_id;
end;
$$;

revoke all on function public.create_campaign_assignment_bundle_v2(
  uuid, uuid, text, text, boolean, timestamptz, date, text, timestamptz,
  text, numeric, text, boolean, text, date, text, text, text, text, jsonb, jsonb
) from public;

grant execute on function public.create_campaign_assignment_bundle_v2(
  uuid, uuid, text, text, boolean, timestamptz, date, text, timestamptz,
  text, numeric, text, boolean, text, date, text, text, text, text, jsonb, jsonb
) to authenticated;

commit;
