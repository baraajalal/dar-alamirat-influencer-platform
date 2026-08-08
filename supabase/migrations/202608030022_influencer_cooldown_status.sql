-- Ensure financially settled assignments move the influencer into the 45-day cooldown,
-- and expose a reliable remaining-days value for all interfaces.

create or replace function public.refresh_assignment_financial_settlement(
  p_assignment_id uuid,
  p_actor_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_summary public.assignment_financial_settlements%rowtype;
  v_now timestamptz := now();
  v_settled_at timestamptz;
  v_blocked_until timestamptz;
begin
  select *
  into v_summary
  from public.assignment_financial_settlements
  where assignment_id = p_assignment_id;

  if not found then
    return false;
  end if;

  if coalesce(v_summary.fully_settled, false)
     and v_summary.expected_total > 0
     and v_summary.remaining_total = 0 then

    v_settled_at := coalesce(v_summary.settled_at, v_now);
    v_blocked_until := v_settled_at + interval '45 days';

    update public.campaign_assignments
    set status = 'paid',
        settled_at = v_settled_at,
        availability_blocked_until = greatest(
          coalesce(availability_blocked_until, v_blocked_until),
          v_blocked_until
        ),
        updated_at = v_now
    where id = p_assignment_id
      and status not in ('closed', 'cancelled', 'rejected');

    insert into public.activity_logs(
      actor_id,
      entity_type,
      entity_id,
      action,
      metadata
    )
    values (
      p_actor_id,
      'campaign_assignment',
      p_assignment_id,
      'financial_settlement_completed',
      jsonb_build_object(
        'expected_total', v_summary.expected_total,
        'executed_total', v_summary.executed_total,
        'settled_at', v_settled_at,
        'availability_blocked_until', v_blocked_until,
        'cooldown_days', 45
      )
    );

    return true;
  end if;

  return false;
end;
$$;

grant execute on function public.refresh_assignment_financial_settlement(uuid, uuid) to authenticated;

-- Backfill assignments that were already fully settled before this correction.
do $$
declare
  r record;
begin
  for r in
    select assignment_id
    from public.assignment_financial_settlements
    where coalesce(fully_settled, false)
      and expected_total > 0
      and remaining_total = 0
  loop
    perform public.refresh_assignment_financial_settlement(r.assignment_id, null);
  end loop;
end;
$$;

create or replace view public.influencer_availability_status as
select
  i.id as influencer_id,
  case
    when exists (
      select 1
      from public.campaign_assignments a
      where a.influencer_id = i.id
        and a.status not in ('paid', 'closed', 'rejected', 'cancelled')
    ) then 'active'
    when exists (
      select 1
      from public.campaign_assignments a
      where a.influencer_id = i.id
        and a.availability_blocked_until > now()
    ) then 'cooldown'
    else 'available'
  end as availability_status,
  (
    select max(a.availability_blocked_until)
    from public.campaign_assignments a
    where a.influencer_id = i.id
      and a.availability_blocked_until > now()
  ) as blocked_until,
  greatest(
    0,
    ceil(
      extract(epoch from (
        coalesce((
          select max(a.availability_blocked_until)
          from public.campaign_assignments a
          where a.influencer_id = i.id
            and a.availability_blocked_until > now()
        ), now()) - now()
      )) / 86400.0
    )::int
  ) as cooldown_days_remaining
from public.influencers i;

grant select on public.influencer_availability_status to authenticated;

notify pgrst, 'reload schema';
