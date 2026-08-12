alter table public.events
  add column registration_fee_cents bigint not null default 0
  check (registration_fee_cents >= 0);

alter table public.event_registrations
  drop constraint if exists event_registrations_status_check;
alter table public.event_registrations
  add constraint event_registrations_status_check
  check (status in ('awaiting_payment', 'pending', 'contacting', 'confirmed', 'withdrew', 'baptized', 'cancelled', 'rejected'));

create table public.mercado_pago_payments (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('tithe', 'offering', 'firstfruits', 'event')),
  event_id uuid references public.events(id) on delete restrict,
  registration_id uuid unique references public.event_registrations(id) on delete restrict,
  payer_name text not null check (char_length(btrim(payer_name)) between 2 and 160),
  payer_email text check (payer_email is null or char_length(payer_email) <= 254),
  payer_phone text check (payer_phone is null or char_length(payer_phone) <= 24),
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'created'
    check (status in ('created', 'pending', 'in_process', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back', 'expired')),
  status_detail text,
  provider_preference_id text unique,
  provider_payment_id text unique,
  checkout_url text,
  payment_method_id text,
  payment_type_id text,
  net_received_cents bigint,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mercado_pago_payment_event_check check (
    (purpose = 'event' and event_id is not null and registration_id is not null)
    or (purpose <> 'event' and event_id is null and registration_id is null)
  )
);

create table public.mercado_pago_webhook_events (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  provider_object_id text,
  action text,
  signature_valid boolean not null default false,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

alter table public.finance_income_entries
  drop constraint if exists finance_income_entries_source_check;
alter table public.finance_income_entries
  add constraint finance_income_entries_source_check
  check (source in ('statement', 'manual', 'open_finance', 'mercado_pago'));
alter table public.finance_income_entries
  add column mercado_pago_payment_id uuid unique
  references public.mercado_pago_payments(id) on delete restrict;

create index mercado_pago_payments_status_created_idx
  on public.mercado_pago_payments (status, created_at desc);
create index mercado_pago_payments_purpose_created_idx
  on public.mercado_pago_payments (purpose, created_at desc);
create index mercado_pago_payments_event_idx
  on public.mercado_pago_payments (event_id) where event_id is not null;
create index mercado_pago_webhook_received_idx
  on public.mercado_pago_webhook_events (received_at desc);
create index finance_income_entries_mercado_pago_idx
  on public.finance_income_entries (mercado_pago_payment_id)
  where mercado_pago_payment_id is not null;

alter table public.mercado_pago_payments enable row level security;
alter table public.mercado_pago_webhook_events enable row level security;

revoke all on public.mercado_pago_payments from anon, authenticated;
revoke all on public.mercado_pago_webhook_events from anon, authenticated;
grant select, insert, update, delete on public.mercado_pago_payments to service_role;
grant select, insert, update, delete on public.mercado_pago_webhook_events to service_role;

comment on table public.mercado_pago_payments is
  'Cobranças de eventos, dízimos e ofertas criadas no servidor e confirmadas pelo webhook do Mercado Pago.';
comment on table public.mercado_pago_webhook_events is
  'Auditoria e idempotência das notificações assinadas recebidas do Mercado Pago.';
