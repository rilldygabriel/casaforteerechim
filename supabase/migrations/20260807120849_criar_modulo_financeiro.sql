create table public.finance_payables (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(btrim(description)) between 2 and 180),
  vendor text,
  category text,
  due_date date not null,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  payment_date date,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_payables_paid_fields_check check (
    (status = 'pending' and paid_at is null and payment_date is null)
    or (status = 'paid' and paid_at is not null and payment_date is not null)
  )
);

create table public.finance_statement_imports (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  status text not null default 'analyzing' check (status in ('analyzing', 'review', 'saved', 'failed')),
  period_start date,
  period_end date,
  extracted_count integer not null default 0 check (extracted_count >= 0),
  saved_count integer not null default 0 check (saved_count >= 0),
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  analyzed_at timestamptz
);

create table public.finance_income_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null,
  description text not null check (char_length(btrim(description)) between 2 and 240),
  amount_cents bigint not null check (amount_cents > 0),
  fingerprint text not null unique,
  source text not null default 'statement' check (source in ('statement', 'manual')),
  statement_import_id uuid references public.finance_statement_imports(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index finance_payables_due_date_idx on public.finance_payables (due_date);
create index finance_payables_status_due_date_idx on public.finance_payables (status, due_date);
create index finance_payables_payment_date_idx on public.finance_payables (payment_date) where payment_date is not null;
create index finance_payables_created_by_idx on public.finance_payables (created_by) where created_by is not null;
create index finance_income_entries_transaction_date_idx on public.finance_income_entries (transaction_date desc);
create index finance_income_entries_created_by_idx on public.finance_income_entries (created_by) where created_by is not null;
create index finance_income_entries_import_id_idx on public.finance_income_entries (statement_import_id) where statement_import_id is not null;
create index finance_statement_imports_created_at_idx on public.finance_statement_imports (created_at desc);
create index finance_statement_imports_created_by_idx on public.finance_statement_imports (created_by) where created_by is not null;

alter table public.finance_payables enable row level security;
alter table public.finance_statement_imports enable row level security;
alter table public.finance_income_entries enable row level security;

revoke all on table public.finance_payables from anon, authenticated;
revoke all on table public.finance_statement_imports from anon, authenticated;
revoke all on table public.finance_income_entries from anon, authenticated;

grant select, insert, update, delete on table public.finance_payables to service_role;
grant select, insert, update, delete on table public.finance_statement_imports to service_role;
grant select, insert, update, delete on table public.finance_income_entries to service_role;

comment on table public.finance_payables is 'Contas a pagar acessíveis somente pelo painel administrativo.';
comment on table public.finance_statement_imports is 'Histórico de análises de fotos de extratos bancários.';
comment on table public.finance_income_entries is 'Entradas financeiras confirmadas após análise ou lançamento manual.';
