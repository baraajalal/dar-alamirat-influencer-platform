-- Staff users and invitation tracking for the employee portal.

alter table public.profiles
  add column if not exists email text null,
  add column if not exists invited_at timestamptz null,
  add column if not exists invited_by uuid null references public.profiles(id) on delete set null,
  add column if not exists last_invitation_at timestamptz null,
  add column if not exists invitation_status text not null default 'active';

alter table public.profiles drop constraint if exists profiles_invitation_status_check;
alter table public.profiles add constraint profiles_invitation_status_check
  check (invitation_status in ('pending','active','disabled','cancelled'));

create unique index if not exists profiles_email_unique_lower
  on public.profiles (lower(email))
  where email is not null;

create index if not exists profiles_staff_role_status_idx
  on public.profiles (role, is_active, created_at desc)
  where role <> 'influencer';

update public.profiles p
set email = coalesce(p.email, lower(u.email)),
    invitation_status = case
      when not p.is_active then 'disabled'
      when u.email_confirmed_at is null then 'pending'
      else 'active'
    end,
    invited_at = coalesce(p.invited_at, u.invited_at),
    last_invitation_at = coalesce(p.last_invitation_at, u.invited_at)
from auth.users u
where u.id = p.id;

notify pgrst, 'reload schema';
