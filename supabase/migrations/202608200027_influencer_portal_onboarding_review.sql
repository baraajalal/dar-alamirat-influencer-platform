-- Influencer onboarding + employee-controlled portal activation without email delivery.
begin;

alter table public.influencers
  add column if not exists birth_year integer,
  add column if not exists shooting_style_preferences text[] not null default '{}';

alter table public.influencers
  drop constraint if exists influencers_gender_check;
alter table public.influencers
  add constraint influencers_gender_check
  check (gender is null or gender in ('female', 'male', 'other'));

alter table public.influencers
  drop constraint if exists influencers_birth_year_check;
alter table public.influencers
  add constraint influencers_birth_year_check
  check (birth_year is null or birth_year between 1940 and extract(year from current_date)::integer - 13);

alter table public.social_accounts
  add column if not exists platform_label text;

alter table public.portal_access_requests
  add column if not exists submitted_at timestamptz,
  add column if not exists resubmitted_at timestamptz;

update public.portal_access_requests
set submitted_at = coalesce(submitted_at, created_at)
where submitted_at is null;

alter table public.portal_access_requests
  drop constraint if exists portal_access_requests_status_check;
alter table public.portal_access_requests
  add constraint portal_access_requests_status_check
  check (status in ('pending', 'needs_changes', 'approved', 'rejected', 'completed', 'cancelled'));

drop index if exists portal_access_requests_one_open_idx;
create unique index portal_access_requests_one_open_idx
  on public.portal_access_requests (influencer_id)
  where status in ('pending', 'needs_changes', 'approved');

create table if not exists public.portal_access_tokens (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.portal_access_requests(id) on delete cascade,
  purpose text not null check (purpose in ('activation', 'edit')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists portal_access_tokens_request_idx
  on public.portal_access_tokens (request_id, purpose, created_at desc);
create index if not exists portal_access_tokens_expiry_idx
  on public.portal_access_tokens (expires_at)
  where used_at is null and revoked_at is null;

alter table public.portal_access_tokens enable row level security;

drop policy if exists portal_access_tokens_staff_select on public.portal_access_tokens;
create policy portal_access_tokens_staff_select
on public.portal_access_tokens
for select
to authenticated
using ((select private.is_staff()));

revoke insert, update, delete on public.portal_access_tokens from anon, authenticated;
grant select on public.portal_access_tokens to authenticated;

-- Existing completion calculation treated only male/female as complete.
-- Other is a valid gender in the new onboarding flow.
create or replace function public.calculate_influencer_profile_completion(
  p_full_name text,
  p_mobile text,
  p_city text,
  p_country text,
  p_gender text,
  p_has_mawthooq text,
  p_mawthooq_number text,
  p_preferred_ad_categories text[],
  p_content_style_preferences text[],
  p_social_accounts jsonb
)
returns smallint
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_score integer := 0;
  v_has_basic_social boolean := false;
begin
  if nullif(trim(coalesce(p_full_name, '')), '') is not null then v_score := v_score + 10; end if;
  if public.normalize_mobile(coalesce(p_mobile, '')) ~ '^9665[0-9]{8}$' then v_score := v_score + 10; end if;
  if nullif(trim(coalesce(p_city, '')), '') is not null then v_score := v_score + 5; end if;
  if nullif(trim(coalesce(p_country, '')), '') is not null then v_score := v_score + 5; end if;
  if p_gender in ('female', 'male', 'other') then v_score := v_score + 5; end if;

  select exists (
    select 1 from jsonb_array_elements(coalesce(p_social_accounts, '[]'::jsonb)) item
    where nullif(trim(item->>'platform'), '') is not null
      and (
        nullif(trim(item->>'username'), '') is not null
        or nullif(trim(item->>'profileUrl'), '') is not null
      )
  ) into v_has_basic_social;
  if v_has_basic_social then v_score := v_score + 25; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_social_accounts, '[]'::jsonb)) item where nullif(trim(item->>'profileUrl'), '') is not null) then v_score := v_score + 5; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_social_accounts, '[]'::jsonb)) item where nullif(trim(item->>'averageViews'), '') is not null or nullif(trim(item->>'engagementRate'), '') is not null) then v_score := v_score + 5; end if;

  if coalesce(array_length(p_preferred_ad_categories, 1), 0) > 0 then v_score := v_score + 10; end if;
  if coalesce(array_length(p_content_style_preferences, 1), 0) > 0 then v_score := v_score + 10; end if;

  if p_has_mawthooq = 'no' then
    v_score := v_score + 10;
  elsif p_has_mawthooq = 'yes' then
    v_score := v_score + 5;
    if nullif(trim(coalesce(p_mawthooq_number, '')), '') is not null then v_score := v_score + 5; end if;
  end if;

  return least(v_score, 100)::smallint;
end;
$$;

revoke all on function public.calculate_influencer_profile_completion(text,text,text,text,text,text,text,text[],text[],jsonb) from public, anon, authenticated;
grant execute on function public.calculate_influencer_profile_completion(text,text,text,text,text,text,text,text[],text[],jsonb) to service_role;

commit;
notify pgrst, 'reload schema';
