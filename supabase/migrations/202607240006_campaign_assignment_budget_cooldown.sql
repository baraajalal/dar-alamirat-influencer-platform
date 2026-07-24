-- Dar Al Amirat Influencer Platform
-- Campaign assignment, budget visibility, and global influencer cooldown.

begin;

alter table public.campaign_assignments
  add column if not exists agreed_amount numeric(12,2),
  add column if not exists currency text not null default 'SAR',
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists decline_reason text,
  add column if not exists settled_at timestamptz,
  add column if not exists availability_blocked_until timestamptz;

alter table public.campaign_assignments
  alter column invited_at set default now();

alter table public.campaign_assignments
  drop constraint if exists campaign_assignments_agreed_amount_check;

alter table public.campaign_assignments
  add constraint campaign_assignments_agreed_amount_check
  check (agreed_amount is null or agreed_amount >= 0);

update public.campaign_assignments
set invited_at = coalesce(invited_at, created_at)
where invited_at is null;

create index if not exists assignments_global_availability_idx
  on public.campaign_assignments (influencer_id, status, availability_blocked_until);

create index if not exists assignments_campaign_budget_idx
  on public.campaign_assignments (campaign_id, status, agreed_amount);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.system_settings (key, value)
values ('campaign_cooldown_days', '45'::jsonb)
on conflict (key) do nothing;

alter table public.system_settings enable row level security;

drop policy if exists system_settings_staff_select on public.system_settings;
create policy system_settings_staff_select
on public.system_settings
for select
to authenticated
using ((select private.is_staff()));

drop policy if exists system_settings_admin_insert on public.system_settings;
create policy system_settings_admin_insert
on public.system_settings
for insert
to authenticated
with check ((select private.current_user_role()) = 'admin');

drop policy if exists system_settings_admin_update on public.system_settings;
create policy system_settings_admin_update
on public.system_settings
for update
to authenticated
using ((select private.current_user_role()) = 'admin')
with check ((select private.current_user_role()) = 'admin');

create or replace function public.get_campaign_cooldown_days()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    1,
    least(
      365,
      coalesce(
        (
          select (s.value #>> '{}')::integer
          from public.system_settings s
          where s.key = 'campaign_cooldown_days'
        ),
        45
      )
    )
  );
$$;

revoke all on function public.get_campaign_cooldown_days() from public;
grant execute on function public.get_campaign_cooldown_days() to authenticated, service_role;

create or replace function public.set_assignment_lifecycle_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.invited_at := coalesce(new.invited_at, new.created_at, now());

  if new.status = 'accepted' and new.accepted_at is null then
    new.accepted_at := now();
  end if;

  if new.status in ('rejected', 'cancelled') and new.declined_at is null then
    new.declined_at := now();
  end if;

  if new.status in ('paid', 'closed') and new.completed_at is null then
    new.completed_at := now();
  end if;

  if new.status in ('paid', 'closed')
     and new.settled_at is null
     and not exists (
       select 1 from public.assignment_compensations ac
       where ac.assignment_id = new.id
     ) then
    new.settled_at := coalesce(new.completed_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_assignments_lifecycle_dates on public.campaign_assignments;
create trigger campaign_assignments_lifecycle_dates
before insert or update of status
on public.campaign_assignments
for each row execute function public.set_assignment_lifecycle_dates();

create or replace function public.set_assignment_cooldown()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.settled_at is null then
    new.availability_blocked_until := null;
  elsif tg_op = 'INSERT' or new.availability_blocked_until is null then
    new.availability_blocked_until :=
      new.settled_at + (public.get_campaign_cooldown_days() * interval '1 day');
  elsif old.settled_at is distinct from new.settled_at then
    new.availability_blocked_until :=
      new.settled_at + (public.get_campaign_cooldown_days() * interval '1 day');
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_assignments_set_cooldown on public.campaign_assignments;
create trigger campaign_assignments_set_cooldown
before insert or update of settled_at
on public.campaign_assignments
for each row execute function public.set_assignment_cooldown();

-- Backfill completed settlements when historical paid records are available.
with paid_dates as (
  select
    p.assignment_id,
    max(p.paid_at) as paid_at
  from public.payments p
  where p.status = 'paid'
    and p.paid_at is not null
  group by p.assignment_id
)
update public.campaign_assignments a
set settled_at = pd.paid_at
from paid_dates pd
where a.id = pd.assignment_id
  and a.status in ('paid', 'closed')
  and a.settled_at is null;

update public.campaign_assignments
set availability_blocked_until =
  settled_at + (public.get_campaign_cooldown_days() * interval '1 day')
where settled_at is not null
  and availability_blocked_until is null;

create or replace function public.sync_assignment_settlement_from_payments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment_id uuid;
  v_all_paid boolean;
  v_has_compensation boolean;
  v_settled_at timestamptz;
begin
  if tg_op = 'DELETE' then
    v_assignment_id := old.assignment_id;
  else
    v_assignment_id := new.assignment_id;
  end if;

  select exists (
    select 1 from public.assignment_compensations ac
    where ac.assignment_id = v_assignment_id
  ) into v_has_compensation;

  select
    v_has_compensation
    and not exists (
      select 1
      from public.assignment_compensations ac
      left join public.payments p
        on p.assignment_id = ac.assignment_id
       and p.type = ac.type
      where ac.assignment_id = v_assignment_id
        and (p.id is null or p.status <> 'paid')
    )
  into v_all_paid;

  if v_all_paid then
    select max(coalesce(p.paid_at, p.updated_at, p.created_at))
    into v_settled_at
    from public.payments p
    where p.assignment_id = v_assignment_id
      and p.status = 'paid';

    update public.campaign_assignments
    set
      status = case
        when status in ('rejected', 'cancelled', 'closed') then status
        else 'paid'::public.assignment_status
      end,
      settled_at = coalesce(v_settled_at, now()),
      updated_at = now()
    where id = v_assignment_id;
  else
    update public.campaign_assignments
    set
      settled_at = null,
      availability_blocked_until = null,
      status = case
        when status = 'paid' then 'payment_pending'::public.assignment_status
        else status
      end,
      updated_at = now()
    where id = v_assignment_id
      and settled_at is not null;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists payments_sync_assignment_settlement on public.payments;
create trigger payments_sync_assignment_settlement
after insert or update or delete
on public.payments
for each row execute function public.sync_assignment_settlement_from_payments();

create or replace function private.influencer_campaign_block(
  p_influencer_id uuid,
  p_exclude_assignment_id uuid default null
)
returns table (
  blocked boolean,
  reason text,
  blocking_assignment_id uuid,
  blocking_campaign_id uuid,
  blocking_campaign_name text,
  blocked_until timestamptz,
  days_remaining integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with candidate_blocks as (
    select
      a.id as assignment_id,
      a.campaign_id,
      c.name as campaign_name,
      case
        when a.status not in ('paid', 'closed', 'rejected', 'cancelled')
          then 'active_assignment'
        when a.status in ('paid', 'closed') and a.settled_at is null
          then 'settlement_pending'
        when a.status in ('paid', 'closed')
          and coalesce(
            a.availability_blocked_until,
            a.settled_at + (public.get_campaign_cooldown_days() * interval '1 day')
          ) > now()
          then 'cooldown'
        else null
      end as block_reason,
      case
        when a.status in ('paid', 'closed') and a.settled_at is not null
          then coalesce(
            a.availability_blocked_until,
            a.settled_at + (public.get_campaign_cooldown_days() * interval '1 day')
          )
        else null
      end as block_until,
      case
        when a.status not in ('paid', 'closed', 'rejected', 'cancelled') then 1
        when a.status in ('paid', 'closed') and a.settled_at is null then 2
        else 3
      end as block_priority
    from public.campaign_assignments a
    join public.campaigns c on c.id = a.campaign_id
    where a.influencer_id = p_influencer_id
      and (p_exclude_assignment_id is null or a.id <> p_exclude_assignment_id)
      and a.status not in ('rejected', 'cancelled')
  )
  select
    true,
    cb.block_reason,
    cb.assignment_id,
    cb.campaign_id,
    cb.campaign_name,
    cb.block_until,
    case
      when cb.block_until is null then null
      else greatest(
        0,
        ceil(extract(epoch from (cb.block_until - now())) / 86400.0)::integer
      )
    end
  from candidate_blocks cb
  where cb.block_reason is not null
  order by cb.block_priority, cb.block_until desc nulls first
  limit 1;
$$;

revoke all on function private.influencer_campaign_block(uuid, uuid) from public;

create or replace function public.influencer_campaign_availability(
  p_influencer_id uuid
)
returns table (
  available boolean,
  reason text,
  blocking_assignment_id uuid,
  blocking_campaign_id uuid,
  blocking_campaign_name text,
  blocked_until timestamptz,
  days_remaining integer
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
  select
    false,
    b.reason,
    b.blocking_assignment_id,
    b.blocking_campaign_id,
    b.blocking_campaign_name,
    b.blocked_until,
    b.days_remaining
  from private.influencer_campaign_block(p_influencer_id, null) b
  where b.blocked = true;

  if not found then
    return query
    select true, null::text, null::uuid, null::uuid, null::text,
      null::timestamptz, null::integer;
  end if;
end;
$$;

revoke all on function public.influencer_campaign_availability(uuid) from public;
grant execute on function public.influencer_campaign_availability(uuid) to authenticated;

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
  with totals as (
    select
      coalesce(c.budget, 0)::numeric as budget,
      coalesce(sum(a.agreed_amount) filter (
        where a.status not in ('rejected', 'cancelled')
      ), 0)::numeric as committed
    from public.campaigns c
    left join public.campaign_assignments a on a.campaign_id = c.id
    where c.id = p_campaign_id
    group by c.id, c.budget
  ), paid as (
    select coalesce(sum(p.amount) filter (where p.status = 'paid'), 0)::numeric as amount
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

create or replace function public.search_campaign_influencers(
  p_campaign_id uuid,
  p_query text,
  p_limit integer default 15
)
returns table (
  influencer_id uuid,
  full_name text,
  mobile_e164 text,
  city text,
  country text,
  profile_completion smallint,
  social_accounts jsonb,
  available boolean,
  availability_reason text,
  blocking_campaign_id uuid,
  blocking_campaign_name text,
  blocked_until timestamptz,
  days_remaining integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_query text := trim(coalesce(p_query, ''));
  v_digits text := regexp_replace(coalesce(p_query, ''), '[^0-9]', '', 'g');
begin
  select p.role into v_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true;

  if v_role is null or v_role not in ('admin', 'coordinator', 'finance') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  if not exists (select 1 from public.campaigns c where c.id = p_campaign_id) then
    raise exception 'CAMPAIGN_NOT_FOUND';
  end if;

  if char_length(v_query) < 2 and char_length(v_digits) < 4 then
    return;
  end if;

  return query
  with candidates as (
    select i.*
    from public.influencers i
    where
      i.full_name ilike '%' || v_query || '%'
      or (char_length(v_digits) >= 4 and regexp_replace(i.mobile_e164, '[^0-9]', '', 'g') like '%' || v_digits || '%')
      or exists (
        select 1
        from public.social_accounts sa
        where sa.influencer_id = i.id
          and sa.username ilike '%' || v_query || '%'
      )
    order by i.profile_completion desc, i.updated_at desc
    limit greatest(1, least(coalesce(p_limit, 15), 30))
  )
  select
    i.id,
    i.full_name,
    i.mobile_e164,
    i.city,
    i.country,
    i.profile_completion,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sa.id,
            'platform', sa.platform,
            'username', sa.username,
            'profileUrl', sa.profile_url,
            'followersCount', sa.followers_count
          ) order by sa.followers_count desc nulls last, sa.created_at
        )
        from public.social_accounts sa
        where sa.influencer_id = i.id
      ),
      '[]'::jsonb
    ),
    av.available,
    av.reason,
    av.blocking_campaign_id,
    av.blocking_campaign_name,
    av.blocked_until,
    av.days_remaining
  from candidates i
  cross join lateral public.influencer_campaign_availability(i.id) av;
end;
$$;

revoke all on function public.search_campaign_influencers(uuid, text, integer) from public;
grant execute on function public.search_campaign_influencers(uuid, text, integer) to authenticated;

create or replace function public.enforce_global_influencer_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_block record;
begin
  if new.status in ('rejected', 'cancelled') then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.influencer_id::text, 0)
  );

  select * into v_block
  from private.influencer_campaign_block(new.influencer_id, new.id)
  where blocked = true;

  if found then
    raise exception using
      message = 'INFLUENCER_UNAVAILABLE',
      detail = jsonb_build_object(
        'reason', v_block.reason,
        'campaignId', v_block.blocking_campaign_id,
        'campaignName', v_block.blocking_campaign_name,
        'blockedUntil', v_block.blocked_until,
        'daysRemaining', v_block.days_remaining
      )::text;
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_assignments_global_availability on public.campaign_assignments;
create trigger campaign_assignments_global_availability
before insert or update of influencer_id, status
on public.campaign_assignments
for each row execute function public.enforce_global_influencer_assignment();

create or replace function public.create_campaign_assignment_bundle(
  p_campaign_id uuid,
  p_influencer_id uuid,
  p_execution_type text,
  p_content_due_at timestamptz,
  p_publishing_date date,
  p_branch text,
  p_coordinator_notes text,
  p_agreed_amount numeric,
  p_currency text,
  p_compensation_type text,
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
  v_platform_id uuid;
  v_social_account_id uuid;
  v_content_type text;
  v_quantity integer;
  v_sequence integer;
  v_counter integer;
  v_available record;
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

  if p_agreed_amount is null or p_agreed_amount < 0 then
    raise exception 'INVALID_AGREED_AMOUNT';
  end if;

  if jsonb_typeof(coalesce(p_platforms, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_platforms, '[]'::jsonb)) = 0 then
    raise exception 'PLATFORM_REQUIRED';
  end if;

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
    content_due_at,
    publishing_date,
    branch,
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
    nullif(p_execution_type, '')::public.execution_type,
    p_content_due_at,
    p_publishing_date,
    nullif(trim(p_branch), ''),
    nullif(trim(p_coordinator_notes), ''),
    p_agreed_amount,
    coalesce(nullif(upper(trim(p_currency)), ''), 'SAR'),
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

    if jsonb_typeof(coalesce(v_platform->'deliverables', '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(v_platform->'deliverables', '[]'::jsonb)) = 0 then
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
      v_platform->'deliverables'
    )
    returning id into v_platform_id;

    v_sequence := 1;

    for v_deliverable in
      select value from jsonb_array_elements(v_platform->'deliverables')
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

  if nullif(trim(coalesce(p_compensation_type, '')), '') is not null then
    insert into public.assignment_compensations (
      assignment_id,
      type,
      amount,
      notes
    )
    values (
      v_assignment_id,
      p_compensation_type::public.payment_type,
      p_agreed_amount,
      'تم تسجيل قيمة الإعلان عند ربط المؤثر بالحملة.'
    );
  end if;

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
      'agreedAmount', p_agreed_amount,
      'currency', coalesce(nullif(upper(trim(p_currency)), ''), 'SAR')
    )
  );

  return v_assignment_id;
end;
$$;

revoke all on function public.create_campaign_assignment_bundle(
  uuid, uuid, text, timestamptz, date, text, text, numeric, text, text, jsonb
) from public;

grant execute on function public.create_campaign_assignment_bundle(
  uuid, uuid, text, timestamptz, date, text, text, numeric, text, text, jsonb
) to authenticated;

commit;
