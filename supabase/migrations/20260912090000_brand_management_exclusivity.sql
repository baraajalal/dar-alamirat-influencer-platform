-- Phase 06: Brand management, brand teams, campaign ownership, and scoped exclusivity.
-- Requires Phase 04/04.1 campaign opportunity migrations to already be applied.

begin;

-- -----------------------------------------------------------------------------
-- Brand registry
-- -----------------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_en text not null,
  slug text not null unique,
  logo_url text,
  primary_color text,
  secondary_color text,
  whatsapp_number text,
  contact_email text,
  primary_contact_id uuid references public.profiles(id) on delete set null,
  default_exclusivity_scope text not null default 'none',
  default_exclusivity_days integer not null default 45,
  default_exclusivity_start_basis text not null default 'publishing_date',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brands_scope_check check (default_exclusivity_scope in ('none','brands','all')),
  constraint brands_days_check check (default_exclusivity_days between 0 and 365),
  constraint brands_start_basis_check check (default_exclusivity_start_basis in ('publishing_date','accepted_at')),
  constraint brands_primary_color_check check (primary_color is null or primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint brands_secondary_color_check check (secondary_color is null or secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);

create table if not exists public.brand_aliases (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  alias text not null,
  normalized_alias text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_team_members (
  brand_id uuid not null references public.brands(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_title_ar text,
  role_title_en text,
  created_at timestamptz not null default now(),
  primary key (brand_id, profile_id)
);

create table if not exists public.brand_exclusivity_targets (
  brand_id uuid not null references public.brands(id) on delete cascade,
  blocked_brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_id, blocked_brand_id),
  constraint brand_exclusivity_no_self check (brand_id <> blocked_brand_id)
);

create index if not exists brands_active_name_idx on public.brands(is_active, name_en, name_ar);
create index if not exists brand_team_members_profile_idx on public.brand_team_members(profile_id, brand_id);
create index if not exists brand_exclusivity_targets_blocked_idx on public.brand_exclusivity_targets(blocked_brand_id, brand_id);

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

-- Keep brand records staff-visible while only administrators can mutate them.
alter table public.brands enable row level security;
alter table public.brand_aliases enable row level security;
alter table public.brand_team_members enable row level security;
alter table public.brand_exclusivity_targets enable row level security;

drop policy if exists brands_staff_select on public.brands;
create policy brands_staff_select on public.brands
for select to authenticated using (private.is_staff() or private.current_user_role() in ('reviewer','viewer'));

drop policy if exists brands_admin_insert on public.brands;
create policy brands_admin_insert on public.brands
for insert to authenticated with check (private.current_user_role() = 'admin');
drop policy if exists brands_admin_update on public.brands;
create policy brands_admin_update on public.brands
for update to authenticated using (private.current_user_role() = 'admin') with check (private.current_user_role() = 'admin');
drop policy if exists brands_admin_delete on public.brands;
create policy brands_admin_delete on public.brands
for delete to authenticated using (private.current_user_role() = 'admin');

-- Child tables follow the same visibility and admin-only mutation policy.
do $$
declare v_table text;
begin
  foreach v_table in array array['brand_aliases','brand_team_members','brand_exclusivity_targets']
  loop
    execute format('drop policy if exists %I on public.%I', v_table || '_staff_select', v_table);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_staff() or private.current_user_role() in (''reviewer'',''viewer''))', v_table || '_staff_select', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_admin_insert', v_table);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.current_user_role() = ''admin'')', v_table || '_admin_insert', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_admin_update', v_table);
    execute format('create policy %I on public.%I for update to authenticated using (private.current_user_role() = ''admin'') with check (private.current_user_role() = ''admin'')', v_table || '_admin_update', v_table);
    execute format('drop policy if exists %I on public.%I', v_table || '_admin_delete', v_table);
    execute format('create policy %I on public.%I for delete to authenticated using (private.current_user_role() = ''admin'')', v_table || '_admin_delete', v_table);
  end loop;
end;
$$;

grant select,insert,update,delete on public.brands to authenticated;
grant select,insert,update,delete on public.brand_aliases to authenticated;
grant select,insert,update,delete on public.brand_team_members to authenticated;
grant select,insert,update,delete on public.brand_exclusivity_targets to authenticated;

-- -----------------------------------------------------------------------------
-- Seed the commonly used Dar Al Amirat brands. All defaults are non-blocking.
-- Administrators can activate exclusivity per brand after reviewing the policy.
-- -----------------------------------------------------------------------------
insert into public.brands(name_ar,name_en,slug,primary_color,default_exclusivity_scope,default_exclusivity_days)
values
  ('دار الأميرات','Dar Al Amirat','dar-al-amirat','#C7A9D0','none',45),
  ('باستيل','Pastel','pastel',null,'none',45),
  ('روماند','Rom&nd','romand',null,'none',45),
  ('أرماف بيوتي','Armaf Beauté','armaf-beaute',null,'none',45),
  ('شو باي باستيل','Show by Pastel','show-by-pastel',null,'none',45),
  ('كرييشن','CREATION','creation',null,'none',45),
  ('سيلتك','Siltek','siltek',null,'none',45),
  ('كوزمو من','Cosmo Men','cosmo-men',null,'none',45),
  ('كلارا لاين','Clara Line','clara-line',null,'none',45)
on conflict (slug) do nothing;

insert into public.brand_aliases(brand_id,alias,normalized_alias)
select b.id, x.alias, x.normalized_alias
from public.brands b
join (values
  ('dar-al-amirat','Dar Al Amirat','daralamirat'),
  ('dar-al-amirat','دار الأميرات','دارالاميرات'),
  ('pastel','Pastel','pastel'),
  ('pastel','باستيل','باستيل'),
  ('romand','Rom&nd','romand'),
  ('romand','Romand','romandtext'),
  ('romand','روماند','روماند'),
  ('armaf-beaute','Armaf Beauté','armafbeaute'),
  ('armaf-beaute','Armaf Beaute','armafbeautetext'),
  ('armaf-beaute','أرماف بيوتي','ارمافبيوتي'),
  ('show-by-pastel','Show by Pastel','showbypastel'),
  ('creation','CREATION','creation'),
  ('siltek','Siltek','siltek'),
  ('cosmo-men','Cosmo Men','cosmomen'),
  ('clara-line','Clara Line','claraline')
) as x(slug,alias,normalized_alias) on x.slug=b.slug
on conflict (normalized_alias) do nothing;

-- -----------------------------------------------------------------------------
-- Campaign -> brand relation and campaign-level exclusivity overrides
-- -----------------------------------------------------------------------------
alter table public.campaigns
  add column if not exists brand_id uuid references public.brands(id) on delete set null,
  add column if not exists exclusivity_scope text,
  add column if not exists exclusivity_days integer,
  add column if not exists exclusivity_start_basis text;

alter table public.campaigns drop constraint if exists campaigns_exclusivity_scope_check;
alter table public.campaigns add constraint campaigns_exclusivity_scope_check
  check (exclusivity_scope is null or exclusivity_scope in ('none','brands','all'));
alter table public.campaigns drop constraint if exists campaigns_exclusivity_days_check;
alter table public.campaigns add constraint campaigns_exclusivity_days_check
  check (exclusivity_days is null or exclusivity_days between 0 and 365);
alter table public.campaigns drop constraint if exists campaigns_exclusivity_start_basis_check;
alter table public.campaigns add constraint campaigns_exclusivity_start_basis_check
  check (exclusivity_start_basis is null or exclusivity_start_basis in ('publishing_date','accepted_at'));

create index if not exists campaigns_brand_id_idx on public.campaigns(brand_id, status, start_date);

create table if not exists public.campaign_exclusivity_brands (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campaign_id, brand_id)
);

alter table public.campaign_exclusivity_brands enable row level security;
drop policy if exists campaign_exclusivity_brands_staff_select on public.campaign_exclusivity_brands;
create policy campaign_exclusivity_brands_staff_select on public.campaign_exclusivity_brands
for select to authenticated using (private.is_staff() or private.current_user_role() in ('reviewer','viewer'));
drop policy if exists campaign_exclusivity_brands_staff_write on public.campaign_exclusivity_brands;
create policy campaign_exclusivity_brands_staff_write on public.campaign_exclusivity_brands
for all to authenticated using (private.current_user_role() in ('admin','coordinator')) with check (private.current_user_role() in ('admin','coordinator'));
grant select,insert,update,delete on public.campaign_exclusivity_brands to authenticated;

-- Explicit legacy backfill for known brand aliases. Unmatched legacy values remain
-- untouched and can be linked manually without losing the original brand text.
update public.campaigns c
set brand_id = b.id
from public.brands b
where c.brand_id is null
  and (
    (b.slug='dar-al-amirat' and lower(regexp_replace(coalesce(c.brand,''),'[^[:alnum:]ء-ي]+','','g')) in ('daralamirat','دارالاميرات'))
    or (b.slug='pastel' and lower(regexp_replace(coalesce(c.brand,''),'[^[:alnum:]ء-ي]+','','g')) in ('pastel','باستيل'))
    or (b.slug='romand' and lower(regexp_replace(coalesce(c.brand,''),'[^[:alnum:]ء-ي]+','','g')) in ('romnd','romand','روماند'))
    or (b.slug='armaf-beaute' and lower(regexp_replace(coalesce(c.brand,''),'[^[:alnum:]ء-ي]+','','g')) in ('armafbeauté','armafbeaute','ارمافبيوتي'))
    or (b.slug='show-by-pastel' and lower(regexp_replace(coalesce(c.brand,''),'[^[:alnum:]ء-ي]+','','g'))='showbypastel')
    or (b.slug='creation' and lower(regexp_replace(coalesce(c.brand,''),'[^[:alnum:]ء-ي]+','','g'))='creation')
    or (b.slug='siltek' and lower(regexp_replace(coalesce(c.brand,''),'[^[:alnum:]ء-ي]+','','g'))='siltek')
    or (b.slug='cosmo-men' and lower(regexp_replace(coalesce(c.brand,''),'[^[:alnum:]ء-ي]+','','g'))='cosmomen')
    or (b.slug='clara-line' and lower(regexp_replace(coalesce(c.brand,''),'[^[:alnum:]ء-ي]+','','g'))='claraline')
  );

create or replace function public.sync_campaign_brand_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_name text;
begin
  if new.brand_id is not null then
    select coalesce(nullif(trim(b.name_en),''), b.name_ar) into v_name
    from public.brands b where b.id=new.brand_id;
    if v_name is not null then new.brand := v_name; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists campaigns_sync_brand_name on public.campaigns;
create trigger campaigns_sync_brand_name
before insert or update of brand_id on public.campaigns
for each row execute function public.sync_campaign_brand_name();

-- -----------------------------------------------------------------------------
-- Assignment-level exclusivity snapshot
-- -----------------------------------------------------------------------------
alter table public.campaign_assignments
  add column if not exists exclusivity_scope text,
  add column if not exists exclusivity_days integer,
  add column if not exists exclusivity_start_basis text,
  add column if not exists exclusivity_start_at timestamptz,
  add column if not exists exclusivity_end_at timestamptz,
  add column if not exists exclusivity_policy_source text,
  add column if not exists exclusivity_lifted_at timestamptz,
  add column if not exists exclusivity_lifted_by uuid references public.profiles(id) on delete set null,
  add column if not exists exclusivity_lift_reason text;

-- Preserve any currently-active legacy cooldown as a global block instead of
-- silently removing it during the migration.
update public.campaign_assignments
set
  exclusivity_scope = case when availability_blocked_until > now() then 'all' else 'none' end,
  exclusivity_days = case
    when availability_blocked_until > now() and settled_at is not null
      then greatest(1, ceil(extract(epoch from (availability_blocked_until-settled_at))/86400.0)::integer)
    else 0
  end,
  exclusivity_start_basis = 'accepted_at',
  exclusivity_start_at = case when availability_blocked_until > now() then coalesce(settled_at, accepted_at, created_at) else null end,
  exclusivity_end_at = case when availability_blocked_until > now() then availability_blocked_until else null end,
  exclusivity_policy_source = case when availability_blocked_until > now() then 'legacy_cooldown' else 'legacy_none' end
where exclusivity_scope is null;

alter table public.campaign_assignments
  alter column exclusivity_scope set default 'none',
  alter column exclusivity_scope set not null,
  alter column exclusivity_days set default 0,
  alter column exclusivity_days set not null,
  alter column exclusivity_start_basis set default 'publishing_date',
  alter column exclusivity_start_basis set not null,
  alter column exclusivity_policy_source set default 'campaign',
  alter column exclusivity_policy_source set not null;

alter table public.campaign_assignments drop constraint if exists campaign_assignments_exclusivity_scope_check;
alter table public.campaign_assignments add constraint campaign_assignments_exclusivity_scope_check
  check (exclusivity_scope in ('none','brands','all'));
alter table public.campaign_assignments drop constraint if exists campaign_assignments_exclusivity_days_check;
alter table public.campaign_assignments add constraint campaign_assignments_exclusivity_days_check
  check (exclusivity_days between 0 and 365);
alter table public.campaign_assignments drop constraint if exists campaign_assignments_exclusivity_start_basis_check;
alter table public.campaign_assignments add constraint campaign_assignments_exclusivity_start_basis_check
  check (exclusivity_start_basis in ('publishing_date','accepted_at'));

create table if not exists public.assignment_exclusivity_brands (
  assignment_id uuid not null references public.campaign_assignments(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (assignment_id, brand_id)
);
create index if not exists assignment_exclusivity_brands_brand_idx on public.assignment_exclusivity_brands(brand_id, assignment_id);

alter table public.assignment_exclusivity_brands enable row level security;
drop policy if exists assignment_exclusivity_brands_staff_select on public.assignment_exclusivity_brands;
create policy assignment_exclusivity_brands_staff_select on public.assignment_exclusivity_brands
for select to authenticated using (private.is_staff() or private.current_user_role() in ('reviewer','viewer'));
grant select on public.assignment_exclusivity_brands to authenticated;

create or replace function private.resolve_campaign_exclusivity(p_campaign_id uuid)
returns table(scope text, days integer, start_basis text)
language sql
stable
security definer
set search_path=''
as $$
  select
    case
      when coalesce(c.exclusivity_scope,b.default_exclusivity_scope,'none')='none' then 'none'
      else coalesce(c.exclusivity_scope,b.default_exclusivity_scope,'none')
    end as scope,
    case
      when coalesce(c.exclusivity_scope,b.default_exclusivity_scope,'none')='none' then 0
      else greatest(0,least(365,coalesce(c.exclusivity_days,b.default_exclusivity_days,45)))
    end as days,
    coalesce(c.exclusivity_start_basis,b.default_exclusivity_start_basis,'publishing_date') as start_basis
  from public.campaigns c
  left join public.brands b on b.id=c.brand_id
  where c.id=p_campaign_id;
$$;

revoke all on function private.resolve_campaign_exclusivity(uuid) from public;

create or replace function public.set_assignment_exclusivity_policy()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_policy record;
begin
  if tg_op='INSERT' and coalesce(new.exclusivity_policy_source,'campaign')='campaign' then
    select * into v_policy from private.resolve_campaign_exclusivity(new.campaign_id);
    if found then
      new.exclusivity_scope := coalesce(v_policy.scope,'none');
      new.exclusivity_days := coalesce(v_policy.days,0);
      new.exclusivity_start_basis := coalesce(v_policy.start_basis,'publishing_date');
    end if;
  end if;

  if new.exclusivity_lifted_at is not null then
    -- Keep the original start/end timestamps for audit/history, but remove the
    -- active availability block after an administrator lifts the restriction.
    new.availability_blocked_until := null;
    return new;
  end if;

  if new.exclusivity_scope='none' or new.exclusivity_days=0 then
    new.exclusivity_start_at := null;
    new.exclusivity_end_at := null;
    new.availability_blocked_until := null;
    return new;
  end if;

  if new.exclusivity_start_basis='accepted_at' then
    new.exclusivity_start_at := new.accepted_at;
  elsif new.exclusivity_start_basis='publishing_date' and new.publishing_date is not null then
    new.exclusivity_start_at := (new.publishing_date::timestamp at time zone 'Asia/Riyadh');
  else
    new.exclusivity_start_at := null;
  end if;

  if new.exclusivity_start_at is not null then
    new.exclusivity_end_at := new.exclusivity_start_at + (new.exclusivity_days * interval '1 day');
    new.availability_blocked_until := new.exclusivity_end_at;
  else
    new.exclusivity_end_at := null;
    new.availability_blocked_until := null;
  end if;

  return new;
end;
$$;

-- Replace the old settlement-based 45-day cooldown trigger. Exclusivity is now
-- contract/campaign-based and starts from publishing or acceptance.
drop trigger if exists campaign_assignments_set_cooldown on public.campaign_assignments;

drop trigger if exists zz_campaign_assignments_exclusivity_policy on public.campaign_assignments;
create trigger zz_campaign_assignments_exclusivity_policy
before insert or update of campaign_id,status,accepted_at,publishing_date,exclusivity_scope,exclusivity_days,exclusivity_start_basis,exclusivity_lifted_at
on public.campaign_assignments
for each row execute function public.set_assignment_exclusivity_policy();

create or replace function public.snapshot_assignment_exclusivity_brands()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_campaign_brand uuid;
begin
  delete from public.assignment_exclusivity_brands where assignment_id=new.id;
  if new.exclusivity_scope <> 'brands' then return new; end if;

  -- Campaign-specific targets take precedence over the brand defaults.
  if exists(select 1 from public.campaign_exclusivity_brands x where x.campaign_id=new.campaign_id) then
    insert into public.assignment_exclusivity_brands(assignment_id,brand_id)
    select new.id,x.brand_id from public.campaign_exclusivity_brands x where x.campaign_id=new.campaign_id
    on conflict do nothing;
  else
    select c.brand_id into v_campaign_brand from public.campaigns c where c.id=new.campaign_id;
    if v_campaign_brand is not null then
      insert into public.assignment_exclusivity_brands(assignment_id,brand_id)
      select new.id,x.blocked_brand_id from public.brand_exclusivity_targets x where x.brand_id=v_campaign_brand
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists campaign_assignments_snapshot_exclusivity_brands on public.campaign_assignments;
create trigger campaign_assignments_snapshot_exclusivity_brands
after insert or update of campaign_id,exclusivity_scope
on public.campaign_assignments
for each row execute function public.snapshot_assignment_exclusivity_brands();

-- -----------------------------------------------------------------------------
-- Target-aware exclusivity checks
-- -----------------------------------------------------------------------------
create or replace function private.influencer_exclusivity_block(
  p_influencer_id uuid,
  p_target_campaign_id uuid,
  p_exclude_assignment_id uuid default null
)
returns table(
  blocked boolean,
  reason text,
  blocking_assignment_id uuid,
  blocking_campaign_id uuid,
  blocking_campaign_name text,
  blocking_brand_id uuid,
  blocking_brand_name text,
  blocked_until timestamptz,
  days_remaining integer
)
language sql
stable
security definer
set search_path=''
as $$
  with target as (
    select c.brand_id from public.campaigns c where c.id=p_target_campaign_id
  ), candidate_blocks as (
    select
      a.id,
      a.campaign_id,
      c.name campaign_name,
      c.brand_id,
      coalesce(b.name_en,b.name_ar,c.brand) brand_name,
      a.exclusivity_scope,
      a.exclusivity_end_at,
      case when a.exclusivity_scope='all' then 'all_campaigns_exclusivity' else 'brand_exclusivity' end as reason
    from public.campaign_assignments a
    join public.campaigns c on c.id=a.campaign_id
    left join public.brands b on b.id=c.brand_id
    cross join target t
    where a.influencer_id=p_influencer_id
      and (p_exclude_assignment_id is null or a.id<>p_exclude_assignment_id)
      and a.exclusivity_lifted_at is null
      and a.exclusivity_scope in ('all','brands')
      and a.exclusivity_start_at is not null
      and a.exclusivity_start_at <= now()
      and a.exclusivity_end_at > now()
      and (
        a.exclusivity_scope='all'
        or (
          a.exclusivity_scope='brands'
          and t.brand_id is not null
          and exists(
            select 1 from public.assignment_exclusivity_brands x
            where x.assignment_id=a.id and x.brand_id=t.brand_id
          )
        )
      )
  )
  select
    true,
    cb.reason,
    cb.id,
    cb.campaign_id,
    cb.campaign_name,
    cb.brand_id,
    cb.brand_name,
    cb.exclusivity_end_at,
    greatest(0,ceil(extract(epoch from (cb.exclusivity_end_at-now()))/86400.0)::integer)
  from candidate_blocks cb
  order by cb.exclusivity_end_at desc
  limit 1;
$$;

revoke all on function private.influencer_exclusivity_block(uuid,uuid,uuid) from public;

-- Compatibility function used by older code: only a global exclusivity can
-- make an influencer unavailable without knowing the target campaign.
create or replace function private.influencer_campaign_block(
  p_influencer_id uuid,
  p_exclude_assignment_id uuid default null
)
returns table(
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
set search_path=''
as $$
  select
    true,
    'all_campaigns_exclusivity',
    a.id,
    a.campaign_id,
    c.name,
    a.exclusivity_end_at,
    greatest(0,ceil(extract(epoch from (a.exclusivity_end_at-now()))/86400.0)::integer)
  from public.campaign_assignments a
  join public.campaigns c on c.id=a.campaign_id
  where a.influencer_id=p_influencer_id
    and (p_exclude_assignment_id is null or a.id<>p_exclude_assignment_id)
    and a.exclusivity_lifted_at is null
    and a.exclusivity_scope='all'
    and a.exclusivity_start_at is not null
    and a.exclusivity_start_at<=now()
    and a.exclusivity_end_at>now()
  order by a.exclusivity_end_at desc
  limit 1;
$$;

create or replace function public.influencer_campaign_availability(p_influencer_id uuid)
returns table(
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
set search_path=''
as $$
declare v_block record;
begin
  select * into v_block from private.influencer_campaign_block(p_influencer_id,null);
  if found then
    return query select false,v_block.reason,v_block.blocking_assignment_id,v_block.blocking_campaign_id,v_block.blocking_campaign_name,v_block.blocked_until,v_block.days_remaining;
  else
    return query select true,null::text,null::uuid,null::uuid,null::text,null::timestamptz,null::integer;
  end if;
end;
$$;

create or replace function public.influencer_campaign_availability(p_influencer_id uuid,p_campaign_id uuid)
returns table(
  available boolean,
  reason text,
  blocking_assignment_id uuid,
  blocking_campaign_id uuid,
  blocking_campaign_name text,
  blocking_brand_name text,
  blocked_until timestamptz,
  days_remaining integer
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare v_block record;
begin
  select * into v_block from private.influencer_exclusivity_block(p_influencer_id,p_campaign_id,null);
  if found then
    return query select false,v_block.reason,v_block.blocking_assignment_id,v_block.blocking_campaign_id,v_block.blocking_campaign_name,v_block.blocking_brand_name,v_block.blocked_until,v_block.days_remaining;
  else
    return query select true,null::text,null::uuid,null::uuid,null::text,null::text,null::timestamptz,null::integer;
  end if;
end;
$$;

revoke all on function public.influencer_campaign_availability(uuid) from public;
revoke all on function public.influencer_campaign_availability(uuid,uuid) from public;
grant execute on function public.influencer_campaign_availability(uuid) to authenticated, service_role;
grant execute on function public.influencer_campaign_availability(uuid,uuid) to authenticated, service_role;

-- Campaign-specific creator search must use the target campaign so brand-scoped
-- exclusivity is visible before the coordinator attempts to create an assignment.
drop function if exists public.search_campaign_influencers(uuid,text,integer);
create function public.search_campaign_influencers(
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
  blocking_brand_name text,
  blocked_until timestamptz,
  days_remaining integer
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_role public.user_role;
  v_query text:=trim(coalesce(p_query,''));
  v_digits text:=regexp_replace(coalesce(p_query,''),'[^0-9]','','g');
begin
  select p.role into v_role from public.profiles p where p.id=auth.uid() and p.is_active=true;
  if v_role is null or v_role not in ('admin','coordinator','finance') then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists(select 1 from public.campaigns c where c.id=p_campaign_id) then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  if char_length(v_query)<2 and char_length(v_digits)<4 then return; end if;

  return query
  with candidates as (
    select i.*
    from public.influencers i
    where i.full_name ilike '%'||v_query||'%'
      or (char_length(v_digits)>=4 and regexp_replace(i.mobile_e164,'[^0-9]','','g') like '%'||v_digits||'%')
      or exists(select 1 from public.social_accounts sa where sa.influencer_id=i.id and sa.username ilike '%'||v_query||'%')
    order by i.profile_completion desc,i.updated_at desc
    limit greatest(1,least(coalesce(p_limit,15),30))
  )
  select
    i.id,i.full_name,i.mobile_e164,i.city,i.country,i.profile_completion,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',sa.id,'platform',sa.platform,'username',sa.username,
        'profileUrl',sa.profile_url,'followersCount',sa.followers_count
      ) order by sa.followers_count desc nulls last,sa.created_at)
      from public.social_accounts sa where sa.influencer_id=i.id
    ),'[]'::jsonb),
    av.available,av.reason,av.blocking_campaign_id,av.blocking_campaign_name,av.blocking_brand_name,av.blocked_until,av.days_remaining
  from candidates i
  cross join lateral public.influencer_campaign_availability(i.id,p_campaign_id) av;
end;
$$;
revoke all on function public.search_campaign_influencers(uuid,text,integer) from public;
grant execute on function public.search_campaign_influencers(uuid,text,integer) to authenticated;

-- Definitive database guard for every assignment insert/update, regardless of UI.
create or replace function public.enforce_global_influencer_assignment()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_block record;
begin
  if new.status in ('rejected','cancelled') then return new; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.influencer_id::text,0));
  select * into v_block
  from private.influencer_exclusivity_block(new.influencer_id,new.campaign_id,new.id);

  if found then
    raise exception using
      message='INFLUENCER_UNAVAILABLE',
      detail=jsonb_build_object(
        'reason',v_block.reason,
        'campaignId',v_block.blocking_campaign_id,
        'campaignName',v_block.blocking_campaign_name,
        'brandName',v_block.blocking_brand_name,
        'blockedUntil',v_block.blocked_until,
        'daysRemaining',v_block.days_remaining
      )::text;
  end if;
  return new;
end;
$$;

drop trigger if exists campaign_assignments_global_availability on public.campaign_assignments;
create trigger campaign_assignments_global_availability
before insert or update of influencer_id,campaign_id,status
on public.campaign_assignments
for each row execute function public.enforce_global_influencer_assignment();

-- Admin-only early lift with mandatory reason and full audit trail.
create or replace function public.lift_assignment_exclusivity(p_assignment_id uuid,p_reason text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_reason text := nullif(trim(coalesce(p_reason,'')),''); v_assignment public.campaign_assignments%rowtype;
begin
  if private.current_user_role()<>'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if v_reason is null then raise exception 'LIFT_REASON_REQUIRED'; end if;
  select * into v_assignment from public.campaign_assignments where id=p_assignment_id for update;
  if not found then raise exception 'ASSIGNMENT_NOT_FOUND'; end if;
  if v_assignment.exclusivity_scope='none' or v_assignment.exclusivity_end_at is null or v_assignment.exclusivity_end_at<=now() then raise exception 'NO_ACTIVE_EXCLUSIVITY'; end if;
  if v_assignment.exclusivity_lifted_at is not null then raise exception 'EXCLUSIVITY_ALREADY_LIFTED'; end if;

  update public.campaign_assignments
  set exclusivity_lifted_at=now(),exclusivity_lifted_by=auth.uid(),exclusivity_lift_reason=v_reason,availability_blocked_until=null,updated_at=now()
  where id=p_assignment_id;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'campaign_assignment',p_assignment_id,'assignment_exclusivity_lifted',jsonb_build_object(
    'reason',v_reason,'scope',v_assignment.exclusivity_scope,'previous_end_at',v_assignment.exclusivity_end_at,'campaign_id',v_assignment.campaign_id,'influencer_id',v_assignment.influencer_id
  ));
end;
$$;
revoke all on function public.lift_assignment_exclusivity(uuid,text) from public;
grant execute on function public.lift_assignment_exclusivity(uuid,text) to authenticated;

-- Financial settlement should no longer create or extend a fixed 45-day block.
create or replace function public.refresh_assignment_financial_settlement(p_assignment_id uuid,p_actor_id uuid default null)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare v_summary public.assignment_financial_settlements%rowtype; v_now timestamptz:=now(); v_settled_at timestamptz;
begin
  select * into v_summary from public.assignment_financial_settlements where assignment_id=p_assignment_id;
  if not found then return false; end if;
  if coalesce(v_summary.fully_settled,false) and v_summary.expected_total>0 and v_summary.remaining_total=0 then
    v_settled_at:=coalesce(v_summary.settled_at,v_now);
    update public.campaign_assignments
    set status='paid',settled_at=v_settled_at,updated_at=v_now
    where id=p_assignment_id and status not in ('closed','cancelled','rejected');
    insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
    values(p_actor_id,'campaign_assignment',p_assignment_id,'financial_settlement_completed',jsonb_build_object(
      'expected_total',v_summary.expected_total,'executed_total',v_summary.executed_total,'settled_at',v_settled_at
    ));
    return true;
  end if;
  return false;
end;
$$;
grant execute on function public.refresh_assignment_financial_settlement(uuid,uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Community opportunities: include brand identity and scoped eligibility.
-- -----------------------------------------------------------------------------
drop function if exists public.list_campaign_opportunities();
create function public.list_campaign_opportunities()
returns table(
  id uuid,
  name text,
  brand text,
  product text,
  campaign_type text,
  opportunity_type text,
  opportunity_summary text,
  opportunity_goal text,
  application_requirements text,
  brief text,
  hashtags text[],
  reference_links text[],
  brief_public_url text,
  opportunity_image_urls text[],
  public_compensation_mode text,
  public_compensation_amount numeric,
  public_compensation_max_amount numeric,
  public_compensation_currency text,
  public_compensation_notes text,
  require_campaign_terms_acceptance boolean,
  start_date date,
  end_date date,
  applications_close_at timestamptz,
  max_participants integer,
  application_status text,
  application_id uuid,
  application_rejection_reason text,
  applied_at timestamptz,
  can_apply boolean,
  brand_name_ar text,
  brand_name_en text,
  brand_logo_url text,
  brand_primary_color text,
  eligibility_reason text,
  eligibility_blocked_until timestamptz
)
language plpgsql stable security definer set search_path=''
as $$
declare v_influencer_id uuid;
begin
  select i.id into v_influencer_id from public.influencers i where i.user_id=auth.uid() and i.account_status='active';
  if v_influencer_id is null then raise exception 'INFLUENCER_ACCOUNT_REQUIRED'; end if;

  return query
  select
    c.id,c.name,c.brand,c.product,c.campaign_type,c.opportunity_type,c.opportunity_summary,c.opportunity_goal,c.application_requirements,c.brief,c.hashtags,c.reference_links,c.brief_public_url,c.opportunity_image_urls,c.public_compensation_mode,c.public_compensation_amount,c.public_compensation_max_amount,c.public_compensation_currency,c.public_compensation_notes,c.require_campaign_terms_acceptance,c.start_date,c.end_date,c.applications_close_at,c.max_participants,ca.status,ca.id,ca.rejection_reason,ca.created_at,
    (c.status='active' and c.portal_visibility='community'
      and (c.applications_open_at is null or c.applications_open_at<=now())
      and (c.applications_close_at is null or c.applications_close_at>=now())
      and (ca.status is null or ca.status='withdrawn')
      and eb.blocked is null) as can_apply,
    b.name_ar,b.name_en,b.logo_url,b.primary_color,eb.reason,eb.blocked_until
  from public.campaigns c
  left join public.brands b on b.id=c.brand_id
  left join public.campaign_applications ca on ca.campaign_id=c.id and ca.influencer_id=v_influencer_id
  left join lateral private.influencer_exclusivity_block(v_influencer_id,c.id,null) eb on true
  where (
      ca.id is not null
      or (c.status='active' and c.portal_visibility='community'
          and (c.applications_open_at is null or c.applications_open_at<=now())
          and (c.applications_close_at is null or c.applications_close_at>=now()))
    )
    and not exists(select 1 from public.campaign_assignments a where a.campaign_id=c.id and a.influencer_id=v_influencer_id and a.status not in ('closed','rejected','cancelled'))
  order by c.created_at desc;
end;
$$;

-- Recreate submit with target-aware exclusivity.
drop function if exists public.submit_campaign_application(uuid,text,boolean);
create function public.submit_campaign_application(p_campaign_id uuid,p_message text default null,p_accept_terms boolean default false)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_influencer_id uuid; v_id uuid; v_count integer; v_limit integer; v_campaign public.campaigns%rowtype; v_block record;
begin
  select i.id into v_influencer_id from public.influencers i where i.user_id=auth.uid() and i.account_status='active';
  if v_influencer_id is null then raise exception 'INFLUENCER_ACCOUNT_REQUIRED'; end if;
  select c.* into v_campaign from public.campaigns c where c.id=p_campaign_id and c.status='active' and c.portal_visibility='community'
    and (c.applications_open_at is null or c.applications_open_at<=now()) and (c.applications_close_at is null or c.applications_close_at>=now()) for update;
  if not found then raise exception 'OPPORTUNITY_NOT_AVAILABLE'; end if;
  if v_campaign.require_campaign_terms_acceptance and not coalesce(p_accept_terms,false) then raise exception 'CAMPAIGN_TERMS_REQUIRED'; end if;
  if exists(select 1 from public.campaign_assignments a where a.campaign_id=p_campaign_id and a.influencer_id=v_influencer_id and a.status not in ('closed','rejected','cancelled')) then raise exception 'ALREADY_ASSIGNED'; end if;
  select * into v_block from private.influencer_exclusivity_block(v_influencer_id,p_campaign_id,null);
  if found then raise exception using message='INFLUENCER_UNAVAILABLE',detail=jsonb_build_object('reason',v_block.reason,'campaignName',v_block.blocking_campaign_name,'brandName',v_block.blocking_brand_name,'blockedUntil',v_block.blocked_until,'daysRemaining',v_block.days_remaining)::text; end if;
  v_limit:=v_campaign.max_applications;
  if v_limit is not null then
    select count(*) into v_count from public.campaign_applications ca where ca.campaign_id=p_campaign_id and ca.status in ('pending','shortlisted','accepted');
    if v_count>=v_limit then raise exception 'APPLICATION_LIMIT_REACHED'; end if;
  end if;
  insert into public.campaign_applications as existing(campaign_id,influencer_id,status,message,terms_accepted_at,agreed_compensation_mode,agreed_compensation_amount,agreed_compensation_max_amount,agreed_compensation_currency,campaign_terms_snapshot)
  values(p_campaign_id,v_influencer_id,'pending',nullif(trim(coalesce(p_message,'')),''),case when coalesce(p_accept_terms,false) then now() end,v_campaign.public_compensation_mode,v_campaign.public_compensation_amount,v_campaign.public_compensation_max_amount,v_campaign.public_compensation_currency,
    jsonb_build_object('campaign_name',v_campaign.name,'brand',v_campaign.brand,'product',v_campaign.product,'campaign_type',v_campaign.campaign_type,'opportunity_type',v_campaign.opportunity_type,'opportunity_goal',v_campaign.opportunity_goal,'brief',v_campaign.brief,'hashtags',v_campaign.hashtags,'requirements',v_campaign.application_requirements,'compensation_mode',v_campaign.public_compensation_mode,'compensation_amount',v_campaign.public_compensation_amount,'compensation_max_amount',v_campaign.public_compensation_max_amount,'compensation_currency',v_campaign.public_compensation_currency,'compensation_notes',v_campaign.public_compensation_notes,'accepted_at',case when coalesce(p_accept_terms,false) then now() end))
  on conflict(campaign_id,influencer_id) do update set
    status=case when existing.status='withdrawn' then 'pending' else existing.status end,
    message=case when existing.status='withdrawn' then excluded.message else existing.message end,
    rejection_reason=case when existing.status='withdrawn' then null else existing.rejection_reason end,
    reviewed_by=case when existing.status='withdrawn' then null else existing.reviewed_by end,
    reviewed_at=case when existing.status='withdrawn' then null else existing.reviewed_at end,
    terms_accepted_at=case when existing.status='withdrawn' then excluded.terms_accepted_at else existing.terms_accepted_at end,
    agreed_compensation_mode=case when existing.status='withdrawn' then excluded.agreed_compensation_mode else existing.agreed_compensation_mode end,
    agreed_compensation_amount=case when existing.status='withdrawn' then excluded.agreed_compensation_amount else existing.agreed_compensation_amount end,
    agreed_compensation_max_amount=case when existing.status='withdrawn' then excluded.agreed_compensation_max_amount else existing.agreed_compensation_max_amount end,
    agreed_compensation_currency=case when existing.status='withdrawn' then excluded.agreed_compensation_currency else existing.agreed_compensation_currency end,
    campaign_terms_snapshot=case when existing.status='withdrawn' then excluded.campaign_terms_snapshot else existing.campaign_terms_snapshot end,
    updated_at=now()
  returning existing.id into v_id;
  if exists(select 1 from public.campaign_applications where id=v_id and status in ('accepted','rejected')) then raise exception 'APPLICATION_ALREADY_REVIEWED'; end if;
  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata) values(auth.uid(),'campaign_application',v_id,'campaign_application_submitted',jsonb_build_object('campaign_id',p_campaign_id,'terms_accepted',coalesce(p_accept_terms,false),'compensation_mode',v_campaign.public_compensation_mode,'compensation_amount',v_campaign.public_compensation_amount,'compensation_max_amount',v_campaign.public_compensation_max_amount,'compensation_currency',v_campaign.public_compensation_currency));
  return v_id;
end;
$$;

-- Recreate review with target-aware exclusivity before assignment creation.
create or replace function public.review_campaign_application(p_application_id uuid,p_decision text,p_reason text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_app public.campaign_applications%rowtype; v_assignment uuid; v_count integer; v_limit integer; v_campaign_publishing_date date; v_block record;
begin
  if not private.is_staff() then raise exception 'NOT_AUTHORIZED'; end if;
  if p_decision not in ('shortlisted','accepted','rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_decision='rejected' and nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
  select * into v_app from public.campaign_applications where id=p_application_id for update;
  if not found then raise exception 'APPLICATION_NOT_FOUND'; end if;
  if v_app.status not in ('pending','shortlisted') then raise exception 'APPLICATION_ALREADY_REVIEWED'; end if;
  if p_decision='accepted' then
    select c.max_participants,c.publishing_date into v_limit,v_campaign_publishing_date from public.campaigns c where c.id=v_app.campaign_id for update;
    if v_limit is not null then
      select count(distinct a.influencer_id) into v_count from public.campaign_assignments a where a.campaign_id=v_app.campaign_id and a.influencer_id<>v_app.influencer_id and a.status not in ('rejected','cancelled');
      if v_count>=v_limit then raise exception 'PARTICIPANT_LIMIT_REACHED'; end if;
    end if;
    select a.id into v_assignment from public.campaign_assignments a where a.campaign_id=v_app.campaign_id and a.influencer_id=v_app.influencer_id and a.status not in ('closed','rejected','cancelled') limit 1;
    if v_assignment is null then
      select * into v_block from private.influencer_exclusivity_block(v_app.influencer_id,v_app.campaign_id,null);
      if found then raise exception using message='INFLUENCER_UNAVAILABLE',detail=jsonb_build_object('reason',v_block.reason,'campaignName',v_block.blocking_campaign_name,'brandName',v_block.blocking_brand_name,'blockedUntil',v_block.blocked_until,'daysRemaining',v_block.days_remaining)::text; end if;
      insert into public.campaign_assignments(campaign_id,influencer_id,coordinator_id,status,source,invited_at,publishing_date,agreed_amount,currency)
      values(v_app.campaign_id,v_app.influencer_id,auth.uid(),'invited','community_application',now(),v_campaign_publishing_date,case when v_app.agreed_compensation_mode='fixed' then v_app.agreed_compensation_amount end,coalesce(v_app.agreed_compensation_currency,'SAR'))
      returning id into v_assignment;
    end if;
  end if;
  update public.campaign_applications set status=p_decision,rejection_reason=case when p_decision='rejected' then nullif(trim(coalesce(p_reason,'')),'') else null end,reviewed_by=auth.uid(),reviewed_at=now(),assignment_id=case when p_decision='accepted' then v_assignment else assignment_id end,updated_at=now() where id=p_application_id;
  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata) values(auth.uid(),'campaign_application',p_application_id,'campaign_application_reviewed',jsonb_build_object('decision',p_decision,'reason',nullif(trim(coalesce(p_reason,'')),''),'campaign_id',v_app.campaign_id,'assignment_id',v_assignment));
  return v_assignment;
end;
$$;

revoke all on function public.list_campaign_opportunities() from public;
revoke all on function public.submit_campaign_application(uuid,text,boolean) from public;
revoke all on function public.review_campaign_application(uuid,text,text) from public;
grant execute on function public.list_campaign_opportunities() to authenticated;
grant execute on function public.submit_campaign_application(uuid,text,boolean) to authenticated;
grant execute on function public.review_campaign_application(uuid,text,text) to authenticated;

-- Staff-friendly current restriction view.
create or replace view public.influencer_availability_status as
select
  i.id influencer_id,
  case
    when exists(select 1 from public.campaign_assignments a where a.influencer_id=i.id and a.exclusivity_lifted_at is null and a.exclusivity_scope in ('all','brands') and a.exclusivity_start_at<=now() and a.exclusivity_end_at>now()) then 'restricted'
    else 'available'
  end availability_status,
  (select max(a.exclusivity_end_at) from public.campaign_assignments a where a.influencer_id=i.id and a.exclusivity_lifted_at is null and a.exclusivity_scope in ('all','brands') and a.exclusivity_start_at<=now() and a.exclusivity_end_at>now()) blocked_until,
  greatest(0,ceil(extract(epoch from (coalesce((select max(a.exclusivity_end_at) from public.campaign_assignments a where a.influencer_id=i.id and a.exclusivity_lifted_at is null and a.exclusivity_scope in ('all','brands') and a.exclusivity_start_at<=now() and a.exclusivity_end_at>now()),now())-now()))/86400.0)::integer) cooldown_days_remaining
from public.influencers i;
grant select on public.influencer_availability_status to authenticated;


-- Atomic admin save for the brand, team members, and competitor list.
create or replace function public.save_brand_configuration(
  p_brand_id uuid,
  p_name_ar text,
  p_name_en text,
  p_slug text,
  p_logo_url text,
  p_primary_color text,
  p_secondary_color text,
  p_whatsapp_number text,
  p_contact_email text,
  p_primary_contact_id uuid,
  p_default_exclusivity_scope text,
  p_default_exclusivity_days integer,
  p_default_exclusivity_start_basis text,
  p_is_active boolean,
  p_team_member_ids uuid[] default '{}'::uuid[],
  p_blocked_brand_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid:=p_brand_id; v_member uuid; v_blocked uuid;
begin
  if private.current_user_role()<>'admin' then raise exception 'ADMIN_REQUIRED'; end if;
  if nullif(trim(coalesce(p_name_ar,'')),'') is null or nullif(trim(coalesce(p_name_en,'')),'') is null then raise exception 'BRAND_NAME_REQUIRED'; end if;
  if nullif(trim(coalesce(p_slug,'')),'') is null then raise exception 'BRAND_SLUG_REQUIRED'; end if;
  if p_default_exclusivity_scope not in ('none','brands','all') then raise exception 'INVALID_EXCLUSIVITY_SCOPE'; end if;
  if coalesce(p_default_exclusivity_days,0) not between 0 and 365 then raise exception 'INVALID_EXCLUSIVITY_DAYS'; end if;
  if p_default_exclusivity_start_basis not in ('publishing_date','accepted_at') then raise exception 'INVALID_EXCLUSIVITY_START'; end if;
  if p_default_exclusivity_scope='brands' and coalesce(cardinality(p_blocked_brand_ids),0)=0 then raise exception 'BLOCKED_BRANDS_REQUIRED'; end if;

  if v_id is null then
    insert into public.brands(name_ar,name_en,slug,logo_url,primary_color,secondary_color,whatsapp_number,contact_email,primary_contact_id,default_exclusivity_scope,default_exclusivity_days,default_exclusivity_start_basis,is_active,created_by)
    values(trim(p_name_ar),trim(p_name_en),lower(trim(p_slug)),nullif(trim(coalesce(p_logo_url,'')),''),nullif(trim(coalesce(p_primary_color,'')),''),nullif(trim(coalesce(p_secondary_color,'')),''),nullif(trim(coalesce(p_whatsapp_number,'')),''),nullif(trim(coalesce(p_contact_email,'')),''),p_primary_contact_id,p_default_exclusivity_scope,p_default_exclusivity_days,p_default_exclusivity_start_basis,coalesce(p_is_active,true),auth.uid())
    returning id into v_id;
  else
    update public.brands set name_ar=trim(p_name_ar),name_en=trim(p_name_en),slug=lower(trim(p_slug)),logo_url=nullif(trim(coalesce(p_logo_url,'')),''),primary_color=nullif(trim(coalesce(p_primary_color,'')),''),secondary_color=nullif(trim(coalesce(p_secondary_color,'')),''),whatsapp_number=nullif(trim(coalesce(p_whatsapp_number,'')),''),contact_email=nullif(trim(coalesce(p_contact_email,'')),''),primary_contact_id=p_primary_contact_id,default_exclusivity_scope=p_default_exclusivity_scope,default_exclusivity_days=p_default_exclusivity_days,default_exclusivity_start_basis=p_default_exclusivity_start_basis,is_active=coalesce(p_is_active,true),updated_at=now()
    where id=v_id;
    if not found then raise exception 'BRAND_NOT_FOUND'; end if;
  end if;

  delete from public.brand_team_members where brand_id=v_id;
  foreach v_member in array coalesce(p_team_member_ids,'{}'::uuid[]) loop
    if exists(select 1 from public.profiles p where p.id=v_member and p.is_active=true and p.role<>'influencer') then
      insert into public.brand_team_members(brand_id,profile_id) values(v_id,v_member) on conflict do nothing;
    end if;
  end loop;
  if p_primary_contact_id is not null and exists(select 1 from public.profiles p where p.id=p_primary_contact_id and p.is_active=true and p.role<>'influencer') then
    insert into public.brand_team_members(brand_id,profile_id) values(v_id,p_primary_contact_id) on conflict do nothing;
  end if;

  delete from public.brand_exclusivity_targets where brand_id=v_id;
  if p_default_exclusivity_scope='brands' then
    foreach v_blocked in array coalesce(p_blocked_brand_ids,'{}'::uuid[]) loop
      if v_blocked<>v_id and exists(select 1 from public.brands b where b.id=v_blocked) then
        insert into public.brand_exclusivity_targets(brand_id,blocked_brand_id) values(v_id,v_blocked) on conflict do nothing;
      end if;
    end loop;
  end if;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'brand',v_id,case when p_brand_id is null then 'brand_created' else 'brand_updated' end,jsonb_build_object('name_ar',p_name_ar,'name_en',p_name_en,'scope',p_default_exclusivity_scope,'days',p_default_exclusivity_days,'team_count',coalesce(cardinality(p_team_member_ids),0),'blocked_brand_count',coalesce(cardinality(p_blocked_brand_ids),0)));
  return v_id;
end;
$$;
revoke all on function public.save_brand_configuration(uuid,text,text,text,text,text,text,text,text,uuid,text,integer,text,boolean,uuid[],uuid[]) from public;
grant execute on function public.save_brand_configuration(uuid,text,text,text,text,text,text,text,text,uuid,text,integer,text,boolean,uuid[],uuid[]) to authenticated;

-- Atomic campaign brand + policy update. NULL policy values mean inherit brand defaults.
create or replace function public.update_campaign_brand_policy(
  p_campaign_id uuid,
  p_brand_id uuid,
  p_scope text,
  p_days integer,
  p_start_basis text,
  p_blocked_brand_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare v_role public.user_role; v_blocked uuid;
begin
  v_role:=private.current_user_role();
  if v_role not in ('admin','coordinator') then raise exception 'NOT_AUTHORIZED'; end if;
  if not exists(select 1 from public.brands b where b.id=p_brand_id and b.is_active=true) then raise exception 'BRAND_NOT_FOUND'; end if;
  if p_scope is not null and p_scope not in ('none','brands','all') then raise exception 'INVALID_EXCLUSIVITY_SCOPE'; end if;
  if p_days is not null and p_days not between 0 and 365 then raise exception 'INVALID_EXCLUSIVITY_DAYS'; end if;
  if p_start_basis is not null and p_start_basis not in ('publishing_date','accepted_at') then raise exception 'INVALID_EXCLUSIVITY_START'; end if;
  if p_scope='brands' and coalesce(cardinality(p_blocked_brand_ids),0)=0 then raise exception 'BLOCKED_BRANDS_REQUIRED'; end if;

  update public.campaigns set brand_id=p_brand_id,exclusivity_scope=p_scope,exclusivity_days=p_days,exclusivity_start_basis=p_start_basis,updated_at=now() where id=p_campaign_id;
  if not found then raise exception 'CAMPAIGN_NOT_FOUND'; end if;
  delete from public.campaign_exclusivity_brands where campaign_id=p_campaign_id;
  if p_scope='brands' then
    foreach v_blocked in array coalesce(p_blocked_brand_ids,'{}'::uuid[]) loop
      if v_blocked<>p_brand_id and exists(select 1 from public.brands b where b.id=v_blocked and b.is_active=true) then
        insert into public.campaign_exclusivity_brands(campaign_id,brand_id) values(p_campaign_id,v_blocked) on conflict do nothing;
      end if;
    end loop;
  end if;
  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'campaign',p_campaign_id,'campaign_brand_policy_updated',jsonb_build_object('brand_id',p_brand_id,'scope',p_scope,'days',p_days,'start_basis',p_start_basis,'blocked_brand_count',coalesce(cardinality(p_blocked_brand_ids),0)));
end;
$$;
revoke all on function public.update_campaign_brand_policy(uuid,uuid,text,integer,text,uuid[]) from public;
grant execute on function public.update_campaign_brand_policy(uuid,uuid,text,integer,text,uuid[]) to authenticated;

notify pgrst,'reload schema';
commit;
