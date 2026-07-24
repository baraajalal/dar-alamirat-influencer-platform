-- Dar Al Amirat Influencer Platform
-- Campaign management fields and indexes.
-- Run once after the initial schema migrations.

begin;

alter table public.campaigns
  add column if not exists budget numeric(14,2),
  add column if not exists content_due_at timestamptz,
  add column if not exists publishing_date date,
  add column if not exists hashtags text[] not null default '{}',
  add column if not exists reference_links text[] not null default '{}',
  add column if not exists internal_notes text,
  add column if not exists created_by uuid references public.profiles(id) on delete set null,
  add column if not exists archived_at timestamptz;

-- Backfill creator from the existing manager when possible.
update public.campaigns
set created_by = manager_id
where created_by is null
  and manager_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'campaigns_budget_nonnegative_check'
      and conrelid = 'public.campaigns'::regclass
  ) then
    alter table public.campaigns
      add constraint campaigns_budget_nonnegative_check
      check (budget is null or budget >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'campaigns_date_order_check'
      and conrelid = 'public.campaigns'::regclass
  ) then
    alter table public.campaigns
      add constraint campaigns_date_order_check
      check (start_date is null or end_date is null or end_date >= start_date);
  end if;
end
$$;

create index if not exists campaigns_manager_status_idx
  on public.campaigns(manager_id, status, start_date desc);

create index if not exists campaigns_created_by_idx
  on public.campaigns(created_by, created_at desc);

create index if not exists campaigns_brand_idx
  on public.campaigns(brand);

create index if not exists campaigns_publishing_date_idx
  on public.campaigns(publishing_date)
  where publishing_date is not null;

commit;
