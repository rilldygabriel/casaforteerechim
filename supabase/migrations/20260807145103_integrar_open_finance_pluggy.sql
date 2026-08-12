alter table public.finance_income_entries
  drop constraint if exists finance_income_entries_source_check;

alter table public.finance_income_entries
  add constraint finance_income_entries_source_check
  check (source in ('statement', 'manual', 'open_finance'));

create table public.finance_bank_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'pluggy' check (provider = 'pluggy'),
  provider_item_id text not null unique,
  institution_name text not null default 'Instituição financeira',
  connector_id text,
  status text not null default 'pending' check (status in ('pending', 'active', 'error', 'disconnected')),
  error_code text,
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.finance_bank_connections(id) on delete cascade,
  provider_account_id text not null unique,
  name text not null,
  type text not null,
  subtype text,
  number_masked text,
  currency_code text not null default 'BRL',
  current_balance_cents bigint,
  updated_at timestamptz not null default now()
);

create table public.finance_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.finance_bank_accounts(id) on delete cascade,
  provider_transaction_id text not null unique,
  transaction_date date not null,
  description text not null check (char_length(btrim(description)) between 2 and 240),
  amount_cents bigint not null check (amount_cents > 0),
  direction text not null check (direction in ('credit', 'debit')),
  status text not null default 'posted' check (status in ('posted', 'pending')),
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.finance_income_entries
  add column bank_transaction_id uuid unique
  references public.finance_bank_transactions(id) on delete cascade;

create table public.finance_open_finance_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'pluggy' check (provider = 'pluggy'),
  provider_event_id text not null unique,
  event_type text not null,
  provider_item_id text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error_message text
);

create index finance_bank_connections_status_idx on public.finance_bank_connections(status);
create index finance_bank_connections_created_by_idx on public.finance_bank_connections(created_by) where created_by is not null;
create index finance_bank_accounts_connection_idx on public.finance_bank_accounts(connection_id);
create index finance_bank_transactions_account_date_idx on public.finance_bank_transactions(account_id, transaction_date desc);
create index finance_bank_transactions_direction_date_idx on public.finance_bank_transactions(direction, transaction_date desc);
create index finance_income_entries_bank_transaction_idx on public.finance_income_entries(bank_transaction_id) where bank_transaction_id is not null;
create index finance_open_finance_events_received_idx on public.finance_open_finance_events(received_at desc);

alter table public.finance_bank_connections enable row level security;
alter table public.finance_bank_accounts enable row level security;
alter table public.finance_bank_transactions enable row level security;
alter table public.finance_open_finance_events enable row level security;

revoke all on table public.finance_bank_connections from anon, authenticated;
revoke all on table public.finance_bank_accounts from anon, authenticated;
revoke all on table public.finance_bank_transactions from anon, authenticated;
revoke all on table public.finance_open_finance_events from anon, authenticated;

grant select, insert, update, delete on table public.finance_bank_connections to service_role;
grant select, insert, update, delete on table public.finance_bank_accounts to service_role;
grant select, insert, update, delete on table public.finance_bank_transactions to service_role;
grant select, insert, update, delete on table public.finance_open_finance_events to service_role;

comment on table public.finance_bank_connections is 'Conexões bancárias Open Finance acessíveis somente pelo servidor administrativo.';
comment on table public.finance_bank_accounts is 'Contas bancárias sincronizadas, sem armazenar credenciais bancárias.';
comment on table public.finance_bank_transactions is 'Movimentações bancárias normalizadas vindas do Open Finance.';
comment on table public.finance_open_finance_events is 'Controle idempotente dos webhooks recebidos do provedor Open Finance.';
