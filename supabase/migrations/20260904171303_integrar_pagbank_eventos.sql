alter table public.mercado_pago_payments
  add column payment_provider text not null default 'mercado_pago'
    check (payment_provider in ('mercado_pago', 'pagbank')),
  add column provider_order_id text unique,
  add column pix_qr_code text;

create index mercado_pago_payments_provider_status_idx
  on public.mercado_pago_payments (payment_provider, status, created_at desc);

alter table public.finance_income_entries
  drop constraint if exists finance_income_entries_source_check;
alter table public.finance_income_entries
  add constraint finance_income_entries_source_check
  check (source in ('statement', 'manual', 'open_finance', 'mercado_pago', 'pagbank'));

create table public.pagbank_webhook_events (
  id uuid primary key default gen_random_uuid(),
  payload_hash text not null unique,
  provider_object_id text,
  signature_valid boolean not null default false,
  status text not null default 'received'
    check (status in ('received', 'processed', 'ignored', 'failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index pagbank_webhook_received_idx
  on public.pagbank_webhook_events (received_at desc);

alter table public.pagbank_webhook_events enable row level security;
revoke all on public.pagbank_webhook_events from anon, authenticated;
grant select, insert, update, delete on public.pagbank_webhook_events to service_role;

comment on column public.mercado_pago_payments.payment_provider is
  'Processador responsável pela cobrança; PagBank é usado exclusivamente em eventos.';
comment on table public.pagbank_webhook_events is
  'Auditoria e idempotência das notificações assinadas de pagamentos PagBank.';
