-- Dar Al Amirat Influencer Platform
-- Website voucher approval, preparation, expiry and WhatsApp delivery workflow.

begin;

alter table public.voucher_issues
  add column if not exists transferred_to_preparation_at timestamptz,
  add column if not exists code_prepared_at timestamptz,
  add column if not exists sent_at timestamptz;

comment on column public.voucher_issues.transferred_to_preparation_at is
  'Time a website voucher was moved from approval to code preparation.';
comment on column public.voucher_issues.code_prepared_at is
  'Time the electronic voucher code was first prepared. Expiry starts from this time.';
comment on column public.voucher_issues.sent_at is
  'Time the voucher delivery was confirmed after opening WhatsApp.';

create index if not exists voucher_issues_website_preparation_idx
  on public.voucher_issues (status, amount desc, created_at)
  where source_type = 'website';

-- Preserve already prepared website vouchers: when a code exists, use the earliest
-- known preparation-compatible timestamp and give it a 30-day expiry if absent.
update public.voucher_issues
set
  transferred_to_preparation_at = coalesce(transferred_to_preparation_at, updated_at, created_at),
  code_prepared_at = coalesce(code_prepared_at, updated_at, created_at),
  expires_at = coalesce(expires_at, coalesce(code_prepared_at, updated_at, created_at) + interval '30 days')
where source_type = 'website'
  and nullif(trim(coalesce(voucher_code, '')), '') is not null
  and status in ('preparing', 'ready', 'sent', 'delivered', 'redeemed');

-- Normalize the old delivered state into sent for the electronic website flow.
update public.voucher_issues
set
  status = 'sent',
  sent_at = coalesce(sent_at, delivered_at, updated_at, now())
where source_type = 'website'
  and status = 'delivered';

notify pgrst, 'reload schema';

commit;
