create table if not exists public.finance_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  description text not null check (char_length(description) between 1 and 240),
  category text,
  account_name text,
  amount_cents bigint not null check (amount_cents > 0),
  direction text not null check (direction in ('credit', 'debit')),
  source text not null default 'manual' check (source in ('manual', 'mobills', 'open_finance')),
  source_fingerprint text not null unique,
  imported_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists finance_ledger_entries_date_idx
  on public.finance_ledger_entries (transaction_date desc);

create index if not exists finance_ledger_entries_direction_date_idx
  on public.finance_ledger_entries (direction, transaction_date desc);

alter table public.finance_ledger_entries enable row level security;

revoke all on table public.finance_ledger_entries from anon, authenticated;
grant all on table public.finance_ledger_entries to service_role;
