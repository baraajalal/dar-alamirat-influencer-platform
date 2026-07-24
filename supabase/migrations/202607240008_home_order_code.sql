begin;

alter table public.campaign_assignments
  add column if not exists order_code text;

comment on column public.campaign_assignments.order_code is
  'Order code used for home collaboration orders.';

-- Keep the legacy RPC argument name p_order_notes for compatibility,
-- but save its value in the correctly named order_code column.
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
    order_code,
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


notify pgrst, 'reload schema';

commit;
