begin;

create table if not exists public.creator_location_options (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('city', 'country')),
  value text not null,
  normalized_value text not null,
  source text not null default 'system',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, normalized_value)
);

alter table public.creator_location_options enable row level security;

revoke all on table public.creator_location_options from anon, authenticated;

grant select, insert, update on table public.creator_location_options to service_role;

insert into public.creator_location_options (kind, value, normalized_value, source, sort_order)
values
  ('country','Saudi Arabia','saudi arabia','system',10),
  ('country','United Arab Emirates','united arab emirates','system',20),
  ('country','Kuwait','kuwait','system',30),
  ('country','Bahrain','bahrain','system',40),
  ('country','Qatar','qatar','system',50),
  ('country','Oman','oman','system',60),
  ('city','Riyadh','riyadh','system',10),
  ('city','Jeddah','jeddah','system',20),
  ('city','Makkah','makkah','system',30),
  ('city','Madinah','madinah','system',40),
  ('city','Dammam','dammam','system',50),
  ('city','Khobar','khobar','system',60),
  ('city','Dhahran','dhahran','system',70),
  ('city','Taif','taif','system',80),
  ('city','Tabuk','tabuk','system',90),
  ('city','Abha','abha','system',100),
  ('city','Khamis Mushait','khamis mushait','system',110),
  ('city','Buraidah','buraidah','system',120),
  ('city','Hail','hail','system',130),
  ('city','Jubail','jubail','system',140),
  ('city','Al Ahsa','al ahsa','system',150)
on conflict (kind, normalized_value) do nothing;

commit;
