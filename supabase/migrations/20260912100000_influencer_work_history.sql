-- Phase 07: canonical staff-only influencer work history / legacy collaboration archive.
-- The influencer remains a single canonical record. Previous collaborations are
-- linked to influencer_id and never create duplicate influencer profiles.

begin;

create table if not exists public.influencer_work_history (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid not null references public.influencers(id) on delete cascade,
  brand_id uuid references public.brands(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  assignment_id uuid references public.campaign_assignments(id) on delete set null,
  brand_name text,
  campaign_name text not null,
  collaboration_type text not null default 'other',
  collaboration_status text not null default 'completed',
  collaboration_date date,
  platform text,
  content_type text,
  content_url text,
  compensation_amount numeric(14,2),
  compensation_currency text not null default 'SAR',
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  engagement_rate numeric(8,4),
  outcome text not null default 'unknown',
  performance_note text,
  internal_notes text,
  source text not null default 'manual',
  source_record_id text,
  source_meta jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint influencer_work_history_collaboration_type_check check (
    collaboration_type in ('paid','pr','product','voucher','commission','hybrid','other')
  ),
  constraint influencer_work_history_status_check check (
    collaboration_status in ('completed','published','cancelled','other')
  ),
  constraint influencer_work_history_outcome_check check (
    outcome in ('positive','neutral','needs_attention','unknown')
  ),
  constraint influencer_work_history_amount_check check (
    compensation_amount is null or compensation_amount >= 0
  ),
  constraint influencer_work_history_metric_check check (
    (views is null or views >= 0)
    and (likes is null or likes >= 0)
    and (comments is null or comments >= 0)
    and (shares is null or shares >= 0)
    and (engagement_rate is null or engagement_rate >= 0)
  )
);

create index if not exists influencer_work_history_influencer_date_idx
  on public.influencer_work_history(influencer_id, collaboration_date desc nulls last, created_at desc);
create index if not exists influencer_work_history_brand_idx
  on public.influencer_work_history(brand_id, collaboration_date desc nulls last);
create index if not exists influencer_work_history_campaign_idx
  on public.influencer_work_history(campaign_id);
create unique index if not exists influencer_work_history_assignment_unique
  on public.influencer_work_history(assignment_id)
  where assignment_id is not null;
create unique index if not exists influencer_work_history_dedupe_unique
  on public.influencer_work_history(dedupe_key);
create unique index if not exists influencer_work_history_source_unique
  on public.influencer_work_history(influencer_id, source, source_record_id)
  where source_record_id is not null;

drop trigger if exists influencer_work_history_set_updated_at on public.influencer_work_history;
create trigger influencer_work_history_set_updated_at
before update on public.influencer_work_history
for each row execute function public.set_updated_at();

-- Import batches preserve auditability and make unmatched legacy rows visible
-- without creating placeholder influencer records.
create table if not exists public.work_history_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  total_rows integer not null default 0,
  inserted_count integer not null default 0,
  merged_count integer not null default 0,
  unmatched_count integer not null default 0,
  invalid_count integer not null default 0,
  status text not null default 'processing',
  imported_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint work_history_import_batches_status_check check (status in ('processing','completed','failed'))
);

create table if not exists public.work_history_import_issues (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.work_history_import_batches(id) on delete cascade,
  row_number integer,
  mobile text,
  campaign_name text,
  issue_type text not null,
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists work_history_import_batches_created_idx
  on public.work_history_import_batches(created_at desc);
create index if not exists work_history_import_issues_batch_idx
  on public.work_history_import_issues(batch_id, row_number);

-- Staff can read the archive. Admins and coordinators can maintain it. Only
-- admins can delete history/import records.
alter table public.influencer_work_history enable row level security;
alter table public.work_history_import_batches enable row level security;
alter table public.work_history_import_issues enable row level security;

drop policy if exists influencer_work_history_staff_select on public.influencer_work_history;
create policy influencer_work_history_staff_select on public.influencer_work_history
for select to authenticated
using (private.current_user_role() in ('admin','coordinator','finance','reviewer','viewer'));

drop policy if exists influencer_work_history_manager_insert on public.influencer_work_history;
create policy influencer_work_history_manager_insert on public.influencer_work_history
for insert to authenticated
with check (private.current_user_role() in ('admin','coordinator'));

drop policy if exists influencer_work_history_manager_update on public.influencer_work_history;
create policy influencer_work_history_manager_update on public.influencer_work_history
for update to authenticated
using (private.current_user_role() in ('admin','coordinator'))
with check (private.current_user_role() in ('admin','coordinator'));

drop policy if exists influencer_work_history_admin_delete on public.influencer_work_history;
create policy influencer_work_history_admin_delete on public.influencer_work_history
for delete to authenticated
using (private.current_user_role() = 'admin');

-- Import tables are visible to staff, mutable only through the secured RPCs.
do $$
declare v_table text;
begin
  foreach v_table in array array['work_history_import_batches','work_history_import_issues'] loop
    execute format('drop policy if exists %I on public.%I', v_table || '_staff_select', v_table);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.current_user_role() in (''admin'',''coordinator'',''finance'',''reviewer'',''viewer''))',
      v_table || '_staff_select', v_table
    );
  end loop;
end;
$$;

grant select,insert,update,delete on public.influencer_work_history to authenticated;
grant select on public.work_history_import_batches to authenticated;
grant select on public.work_history_import_issues to authenticated;

-- Stable natural fingerprint used by manual, system and legacy sources. It is
-- intentionally independent of source/file ids so re-uploading the same work
-- does not create a duplicate collaboration.
create or replace function public.work_history_dedupe_key(
  p_influencer_id uuid,
  p_campaign_name text,
  p_brand_name text,
  p_collaboration_date date,
  p_platform text,
  p_content_url text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select md5(
    concat_ws('|',
      coalesce(p_influencer_id::text,''),
      lower(regexp_replace(trim(coalesce(p_campaign_name,'')), '[[:space:]]+', ' ', 'g')),
      lower(regexp_replace(trim(coalesce(p_brand_name,'')), '[[:space:]]+', ' ', 'g')),
      coalesce(p_collaboration_date::text,''),
      lower(trim(coalesce(p_platform,''))),
      lower(trim(coalesce(p_content_url,'')))
    )
  );
$$;

grant execute on function public.work_history_dedupe_key(uuid,text,text,date,text,text) to authenticated;

create or replace function public.set_influencer_work_history_dedupe_key()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.dedupe_key := public.work_history_dedupe_key(
    new.influencer_id,
    new.campaign_name,
    new.brand_name,
    new.collaboration_date,
    new.platform,
    new.content_url
  );
  return new;
end;
$$;

revoke all on function public.set_influencer_work_history_dedupe_key() from public, anon, authenticated;

drop trigger if exists influencer_work_history_set_dedupe_key on public.influencer_work_history;
create trigger influencer_work_history_set_dedupe_key
before insert or update of influencer_id,campaign_name,brand_name,collaboration_date,platform,content_url
on public.influencer_work_history
for each row execute function public.set_influencer_work_history_dedupe_key();

-- Manual maintenance. All values are stored as entered; user-generated names
-- and links are never translated or rewritten.
create or replace function public.save_influencer_work_history(
  p_history_id uuid,
  p_influencer_id uuid,
  p_brand_id uuid,
  p_brand_name text,
  p_campaign_name text,
  p_collaboration_type text,
  p_collaboration_status text,
  p_collaboration_date date,
  p_platform text,
  p_content_type text,
  p_content_url text,
  p_compensation_amount numeric,
  p_compensation_currency text,
  p_views bigint,
  p_likes bigint,
  p_comments bigint,
  p_shares bigint,
  p_engagement_rate numeric,
  p_outcome text,
  p_performance_note text,
  p_internal_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_brand_name text := nullif(trim(coalesce(p_brand_name,'')), '');
  v_dedupe text;
begin
  if private.current_user_role() not in ('admin','coordinator') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if not exists(select 1 from public.influencers where id=p_influencer_id) then
    raise exception 'INFLUENCER_NOT_FOUND';
  end if;
  if nullif(trim(coalesce(p_campaign_name,'')), '') is null then
    raise exception 'CAMPAIGN_NAME_REQUIRED';
  end if;
  if p_brand_id is not null then
    select coalesce(nullif(trim(name_en),''), nullif(trim(name_ar),''))
      into v_brand_name
    from public.brands where id=p_brand_id;
  end if;
  v_dedupe := public.work_history_dedupe_key(
    p_influencer_id, p_campaign_name, v_brand_name, p_collaboration_date,
    nullif(trim(coalesce(p_platform,'')), ''), nullif(trim(coalesce(p_content_url,'')), '')
  );

  if p_history_id is null then
    if exists(select 1 from public.influencer_work_history where dedupe_key=v_dedupe) then
      raise exception 'WORK_HISTORY_DUPLICATE';
    end if;
    insert into public.influencer_work_history(
      influencer_id,brand_id,brand_name,campaign_name,collaboration_type,collaboration_status,
      collaboration_date,platform,content_type,content_url,compensation_amount,compensation_currency,
      views,likes,comments,shares,engagement_rate,outcome,performance_note,internal_notes,
      source,created_by,updated_by,dedupe_key
    ) values (
      p_influencer_id,p_brand_id,v_brand_name,trim(p_campaign_name),coalesce(nullif(p_collaboration_type,''),'other'),
      coalesce(nullif(p_collaboration_status,''),'completed'),p_collaboration_date,nullif(trim(coalesce(p_platform,'')),''),
      nullif(trim(coalesce(p_content_type,'')),''),nullif(trim(coalesce(p_content_url,'')),''),p_compensation_amount,
      coalesce(nullif(upper(trim(coalesce(p_compensation_currency,''))),''),'SAR'),p_views,p_likes,p_comments,p_shares,
      p_engagement_rate,coalesce(nullif(p_outcome,''),'unknown'),nullif(trim(coalesce(p_performance_note,'')),''),
      nullif(trim(coalesce(p_internal_notes,'')),''),'manual',auth.uid(),auth.uid(),v_dedupe
    ) returning id into v_id;
  else
    if not exists(select 1 from public.influencer_work_history where id=p_history_id and influencer_id=p_influencer_id) then
      raise exception 'WORK_HISTORY_NOT_FOUND';
    end if;
    if exists(select 1 from public.influencer_work_history where dedupe_key=v_dedupe and id<>p_history_id) then
      raise exception 'WORK_HISTORY_DUPLICATE';
    end if;
    update public.influencer_work_history set
      brand_id=p_brand_id, brand_name=v_brand_name, campaign_name=trim(p_campaign_name),
      collaboration_type=coalesce(nullif(p_collaboration_type,''),'other'),
      collaboration_status=coalesce(nullif(p_collaboration_status,''),'completed'),
      collaboration_date=p_collaboration_date, platform=nullif(trim(coalesce(p_platform,'')),''),
      content_type=nullif(trim(coalesce(p_content_type,'')),''), content_url=nullif(trim(coalesce(p_content_url,'')),''),
      compensation_amount=p_compensation_amount,
      compensation_currency=coalesce(nullif(upper(trim(coalesce(p_compensation_currency,''))),''),'SAR'),
      views=p_views, likes=p_likes, comments=p_comments, shares=p_shares, engagement_rate=p_engagement_rate,
      outcome=coalesce(nullif(p_outcome,''),'unknown'), performance_note=nullif(trim(coalesce(p_performance_note,'')),''),
      internal_notes=nullif(trim(coalesce(p_internal_notes,'')),''), updated_by=auth.uid(), dedupe_key=v_dedupe
    where id=p_history_id
    returning id into v_id;
  end if;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'influencer_work_history',v_id,case when p_history_id is null then 'work_history_created' else 'work_history_updated' end,
    jsonb_build_object('influencer_id',p_influencer_id,'campaign_name',trim(p_campaign_name),'brand_id',p_brand_id));
  return v_id;
end;
$$;

revoke all on function public.save_influencer_work_history(uuid,uuid,uuid,text,text,text,text,date,text,text,text,numeric,text,bigint,bigint,bigint,bigint,numeric,text,text,text) from public, anon;
grant execute on function public.save_influencer_work_history(uuid,uuid,uuid,text,text,text,text,date,text,text,text,numeric,text,bigint,bigint,bigint,bigint,numeric,text,text,text) to authenticated;

create or replace function public.delete_influencer_work_history(p_history_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_row public.influencer_work_history%rowtype;
begin
  if private.current_user_role() <> 'admin' then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_row from public.influencer_work_history where id=p_history_id;
  if v_row.id is null then return; end if;
  delete from public.influencer_work_history where id=p_history_id;
  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'influencer',v_row.influencer_id,'work_history_deleted',jsonb_build_object('history_id',p_history_id,'campaign_name',v_row.campaign_name));
end;
$$;

revoke all on function public.delete_influencer_work_history(uuid) from public, anon;
grant execute on function public.delete_influencer_work_history(uuid) to authenticated;

-- Legacy Excel import. The caller supplies normalized row JSON. A row without a
-- matching canonical influencer is logged as unmatched and never creates an
-- influencer. Existing natural matches are merged instead of duplicated.
create or replace function public.import_influencer_work_history(
  p_file_name text,
  p_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch_id uuid;
  v_row jsonb;
  v_influencer_id uuid;
  v_brand_id uuid;
  v_brand_name text;
  v_campaign_name text;
  v_mobile text;
  v_date date;
  v_platform text;
  v_url text;
  v_key text;
  v_existing_id uuid;
  v_inserted integer := 0;
  v_merged integer := 0;
  v_unmatched integer := 0;
  v_invalid integer := 0;
  v_total integer := 0;
  v_row_number integer;
  v_amount numeric;
  v_views bigint;
  v_likes bigint;
  v_comments bigint;
  v_shares bigint;
  v_engagement numeric;
  v_brand_norm text;
begin
  if private.current_user_role() not in ('admin','coordinator') then raise exception 'NOT_AUTHORIZED'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'INVALID_ROWS'; end if;

  insert into public.work_history_import_batches(file_name,total_rows,status,imported_by)
  values(coalesce(nullif(trim(p_file_name),''),'archive.xlsx'),jsonb_array_length(p_rows),'processing',auth.uid())
  returning id into v_batch_id;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_total := v_total + 1;
    v_row_number := nullif(v_row->>'row_number','')::integer;
    v_mobile := public.normalize_mobile(coalesce(v_row->>'mobile',''));
    v_campaign_name := nullif(trim(coalesce(v_row->>'campaign_name','')), '');

    if v_mobile is null or v_mobile='' or v_campaign_name is null then
      v_invalid := v_invalid + 1;
      insert into public.work_history_import_issues(batch_id,row_number,mobile,campaign_name,issue_type,message,payload)
      values(v_batch_id,v_row_number,v_row->>'mobile',v_campaign_name,'invalid_row','Missing influencer mobile or campaign name.',v_row);
      continue;
    end if;

    select id into v_influencer_id from public.influencers where normalized_mobile=v_mobile limit 1;
    if v_influencer_id is null then
      v_unmatched := v_unmatched + 1;
      insert into public.work_history_import_issues(batch_id,row_number,mobile,campaign_name,issue_type,message,payload)
      values(v_batch_id,v_row_number,v_row->>'mobile',v_campaign_name,'unmatched_influencer','No canonical influencer matched this mobile number.',v_row);
      continue;
    end if;

    v_brand_name := nullif(trim(coalesce(v_row->>'brand_name','')), '');
    v_brand_id := null;
    if v_brand_name is not null then
      v_brand_norm := lower(regexp_replace(v_brand_name,'[^[:alnum:]ء-ي]+','','g'));
      select b.id into v_brand_id
      from public.brands b
      where lower(regexp_replace(coalesce(b.name_ar,''),'[^[:alnum:]ء-ي]+','','g'))=v_brand_norm
         or lower(regexp_replace(coalesce(b.name_en,''),'[^[:alnum:]ء-ي]+','','g'))=v_brand_norm
      limit 1;
      if v_brand_id is not null then
        select coalesce(nullif(trim(name_en),''),nullif(trim(name_ar),'')) into v_brand_name from public.brands where id=v_brand_id;
      end if;
    end if;

    begin v_date := nullif(v_row->>'collaboration_date','')::date; exception when others then v_date := null; end;
    v_platform := nullif(trim(coalesce(v_row->>'platform','')), '');
    v_url := nullif(trim(coalesce(v_row->>'content_url','')), '');
    begin v_amount := nullif(v_row->>'compensation_amount','')::numeric; exception when others then v_amount := null; end;
    begin v_views := nullif(v_row->>'views','')::bigint; exception when others then v_views := null; end;
    begin v_likes := nullif(v_row->>'likes','')::bigint; exception when others then v_likes := null; end;
    begin v_comments := nullif(v_row->>'comments','')::bigint; exception when others then v_comments := null; end;
    begin v_shares := nullif(v_row->>'shares','')::bigint; exception when others then v_shares := null; end;
    begin v_engagement := nullif(v_row->>'engagement_rate','')::numeric; exception when others then v_engagement := null; end;

    v_key := public.work_history_dedupe_key(v_influencer_id,v_campaign_name,v_brand_name,v_date,v_platform,v_url);
    select id into v_existing_id from public.influencer_work_history where dedupe_key=v_key limit 1;

    if v_existing_id is null then
      insert into public.influencer_work_history(
        influencer_id,brand_id,brand_name,campaign_name,collaboration_type,collaboration_status,collaboration_date,
        platform,content_type,content_url,compensation_amount,compensation_currency,views,likes,comments,shares,
        engagement_rate,outcome,performance_note,internal_notes,source,source_record_id,source_meta,created_by,updated_by,dedupe_key
      ) values (
        v_influencer_id,v_brand_id,v_brand_name,v_campaign_name,
        coalesce(nullif(v_row->>'collaboration_type',''),'other'),coalesce(nullif(v_row->>'collaboration_status',''),'completed'),v_date,
        v_platform,nullif(trim(coalesce(v_row->>'content_type','')),''),v_url,v_amount,
        coalesce(nullif(upper(trim(coalesce(v_row->>'compensation_currency',''))),''),'SAR'),v_views,v_likes,v_comments,v_shares,
        v_engagement,coalesce(nullif(v_row->>'outcome',''),'unknown'),nullif(trim(coalesce(v_row->>'performance_note','')),''),
        nullif(trim(coalesce(v_row->>'internal_notes','')),''),'legacy_import',nullif(v_row->>'source_record_id',''),
        jsonb_build_object('batch_id',v_batch_id,'file_name',p_file_name,'row_number',v_row_number),auth.uid(),auth.uid(),v_key
      );
      v_inserted := v_inserted + 1;
    else
      update public.influencer_work_history set
        brand_id=coalesce(brand_id,v_brand_id), brand_name=coalesce(brand_name,v_brand_name),
        compensation_amount=coalesce(compensation_amount,v_amount),
        views=coalesce(v_views,views), likes=coalesce(v_likes,likes), comments=coalesce(v_comments,comments), shares=coalesce(v_shares,shares),
        engagement_rate=coalesce(v_engagement,engagement_rate), content_type=coalesce(content_type,nullif(trim(coalesce(v_row->>'content_type','')),'')),
        performance_note=coalesce(nullif(trim(coalesce(v_row->>'performance_note','')),''),performance_note),
        internal_notes=coalesce(nullif(trim(coalesce(v_row->>'internal_notes','')),''),internal_notes), updated_by=auth.uid()
      where id=v_existing_id;
      v_merged := v_merged + 1;
    end if;
  end loop;

  update public.work_history_import_batches set
    total_rows=v_total, inserted_count=v_inserted, merged_count=v_merged,
    unmatched_count=v_unmatched, invalid_count=v_invalid, status='completed', completed_at=now()
  where id=v_batch_id;

  insert into public.activity_logs(actor_id,entity_type,entity_id,action,metadata)
  values(auth.uid(),'work_history_import',v_batch_id,'work_history_import_completed',
    jsonb_build_object('file_name',p_file_name,'rows',v_total,'inserted',v_inserted,'merged',v_merged,'unmatched',v_unmatched,'invalid',v_invalid));
  return v_batch_id;
exception when others then
  if v_batch_id is not null then
    update public.work_history_import_batches set status='failed', completed_at=now() where id=v_batch_id;
  end if;
  raise;
end;
$$;

revoke all on function public.import_influencer_work_history(text,jsonb) from public, anon;
grant execute on function public.import_influencer_work_history(text,jsonb) to authenticated;

-- Synchronize completed/paid assignments into the same canonical history. If a
-- legacy/manual row already matches the same natural collaboration, it is
-- linked to the live assignment rather than duplicated.
create or replace function public.sync_assignment_work_history(p_assignment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment record;
  v_content record;
  v_brand_name text;
  v_type text := 'other';
  v_date date;
  v_key text;
  v_id uuid;
  v_comp_count integer;
  v_comp_type text;
begin
  select a.*, c.name as campaign_name, c.brand as campaign_brand, c.brand_id, c.campaign_type,
         c.opportunity_type, c.status as campaign_status, c.end_date
    into v_assignment
  from public.campaign_assignments a
  join public.campaigns c on c.id=a.campaign_id
  where a.id=p_assignment_id;
  if v_assignment.id is null then return null; end if;
  if v_assignment.status in ('rejected','cancelled') then return null; end if;
  if v_assignment.status not in ('paid','closed') and v_assignment.campaign_status not in ('completed','archived') then return null; end if;

  if v_assignment.brand_id is not null then
    select coalesce(nullif(trim(name_en),''),nullif(trim(name_ar),'')) into v_brand_name from public.brands where id=v_assignment.brand_id;
  end if;
  v_brand_name := coalesce(v_brand_name,nullif(trim(coalesce(v_assignment.campaign_brand,'')),''));

  select sa.platform::text as platform, ci.content_type, ci.post_url
    into v_content
  from public.assignment_platforms ap
  join public.social_accounts sa on sa.id=ap.social_account_id
  left join public.content_items ci on ci.assignment_platform_id=ap.id and ci.post_url is not null
  where ap.assignment_id=p_assignment_id
  order by case when ci.status='published' then 0 else 1 end, ci.updated_at desc nulls last, ci.created_at desc nulls last
  limit 1;

  select count(*), min(type::text) into v_comp_count,v_comp_type
  from public.assignment_compensations where assignment_id=p_assignment_id;
  if coalesce(v_assignment.opportunity_type,'')='pr' then v_type := 'pr';
  elsif v_comp_count > 1 then v_type := 'hybrid';
  elsif v_comp_type='bank_transfer' then v_type := 'paid';
  elsif v_comp_type in ('product','voucher','commission') then v_type := v_comp_type;
  elsif coalesce(v_assignment.opportunity_type,'')='paid' then v_type := 'paid';
  end if;

  v_date := coalesce(v_assignment.publishing_date,v_assignment.end_date,v_assignment.agreement_date,v_assignment.created_at::date);
  v_key := public.work_history_dedupe_key(v_assignment.influencer_id,v_assignment.campaign_name,v_brand_name,v_date,v_content.platform,v_content.post_url);

  select id into v_id from public.influencer_work_history where assignment_id=p_assignment_id limit 1;
  if v_id is null then select id into v_id from public.influencer_work_history where dedupe_key=v_key limit 1; end if;

  if v_id is null then
    insert into public.influencer_work_history(
      influencer_id,brand_id,campaign_id,assignment_id,brand_name,campaign_name,collaboration_type,collaboration_status,
      collaboration_date,platform,content_type,content_url,compensation_amount,compensation_currency,outcome,source,source_record_id,
      source_meta,dedupe_key
    ) values (
      v_assignment.influencer_id,v_assignment.brand_id,v_assignment.campaign_id,p_assignment_id,v_brand_name,v_assignment.campaign_name,
      v_type,case when v_content.post_url is not null then 'published' else 'completed' end,v_date,v_content.platform,v_content.content_type,
      v_content.post_url,v_assignment.agreed_amount,coalesce(v_assignment.currency,'SAR'),'unknown','system',p_assignment_id::text,
      jsonb_build_object('assignment_status',v_assignment.status,'campaign_status',v_assignment.campaign_status),v_key
    ) returning id into v_id;
  else
    update public.influencer_work_history set
      brand_id=coalesce(v_assignment.brand_id,brand_id), campaign_id=v_assignment.campaign_id, assignment_id=p_assignment_id,
      brand_name=coalesce(v_brand_name,brand_name), campaign_name=v_assignment.campaign_name, collaboration_type=v_type,
      collaboration_status=case when v_content.post_url is not null then 'published' else 'completed' end,
      collaboration_date=coalesce(v_date,collaboration_date), platform=coalesce(v_content.platform,platform),
      content_type=coalesce(v_content.content_type,content_type), content_url=coalesce(v_content.post_url,content_url),
      compensation_amount=coalesce(v_assignment.agreed_amount,compensation_amount), compensation_currency=coalesce(v_assignment.currency,compensation_currency),
      source=case when source='legacy_import' then source else 'system' end,
      source_record_id=coalesce(source_record_id,p_assignment_id::text),
      source_meta=source_meta || jsonb_build_object('assignment_status',v_assignment.status,'campaign_status',v_assignment.campaign_status),
      dedupe_key=v_key
    where id=v_id;
  end if;
  return v_id;
exception when unique_violation then
  -- A concurrent sync/import already created the same natural collaboration.
  select id into v_id from public.influencer_work_history where dedupe_key=v_key limit 1;
  return v_id;
end;
$$;

-- Internal synchronization is trigger/migration-only. Do not expose this SECURITY DEFINER
-- function as a client RPC.
revoke all on function public.sync_assignment_work_history(uuid) from public, anon, authenticated;

create or replace function public.trigger_sync_assignment_work_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_assignment_work_history(new.id);
  return new;
end;
$$;

revoke all on function public.trigger_sync_assignment_work_history() from public, anon, authenticated;

drop trigger if exists campaign_assignments_sync_work_history on public.campaign_assignments;
create trigger campaign_assignments_sync_work_history
after insert or update of status,publishing_date,agreed_amount,currency
on public.campaign_assignments
for each row execute function public.trigger_sync_assignment_work_history();

create or replace function public.trigger_sync_content_work_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_assignment_id uuid;
begin
  select assignment_id into v_assignment_id from public.assignment_platforms where id=new.assignment_platform_id;
  if v_assignment_id is not null then perform public.sync_assignment_work_history(v_assignment_id); end if;
  return new;
end;
$$;

revoke all on function public.trigger_sync_content_work_history() from public, anon, authenticated;

drop trigger if exists content_items_sync_work_history on public.content_items;
create trigger content_items_sync_work_history
after insert or update of status,post_url,content_type
on public.content_items
for each row execute function public.trigger_sync_content_work_history();

create or replace function public.trigger_sync_campaign_work_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_assignment_id uuid;
begin
  if new.status in ('completed','archived') and old.status is distinct from new.status then
    for v_assignment_id in select id from public.campaign_assignments where campaign_id=new.id and status not in ('rejected','cancelled')
    loop perform public.sync_assignment_work_history(v_assignment_id); end loop;
  end if;
  return new;
end;
$$;

revoke all on function public.trigger_sync_campaign_work_history() from public, anon, authenticated;

drop trigger if exists campaigns_sync_work_history on public.campaigns;
create trigger campaigns_sync_work_history
after update of status on public.campaigns
for each row execute function public.trigger_sync_campaign_work_history();

-- Backfill prior collaborations already completed in the live system.
do $$
declare v_id uuid;
begin
  for v_id in
    select a.id
    from public.campaign_assignments a
    join public.campaigns c on c.id=a.campaign_id
    where a.status in ('paid','closed')
       or (c.status in ('completed','archived') and a.status not in ('rejected','cancelled'))
  loop
    perform public.sync_assignment_work_history(v_id);
  end loop;
end;
$$;

commit;
