create table public.finance_service_income_records (
  id uuid primary key default gen_random_uuid(),
  service_date date not null,
  service_name text not null check (char_length(btrim(service_name)) between 2 and 120),
  cash_cents bigint not null default 0 check (cash_cents >= 0),
  counted_by text[] not null check (cardinality(counted_by) between 1 and 12),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.finance_service_income_pix (
  id uuid primary key default gen_random_uuid(),
  service_income_id uuid not null references public.finance_service_income_records(id) on delete cascade,
  bank_name text not null check (char_length(btrim(bank_name)) between 2 and 120),
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

create index finance_service_income_records_date_idx
  on public.finance_service_income_records (service_date desc);
create index finance_service_income_records_created_by_idx
  on public.finance_service_income_records (created_by)
  where created_by is not null;
create index finance_service_income_pix_record_idx
  on public.finance_service_income_pix (service_income_id);

alter table public.finance_service_income_records enable row level security;
alter table public.finance_service_income_pix enable row level security;

revoke all on table public.finance_service_income_records from anon, authenticated;
revoke all on table public.finance_service_income_pix from anon, authenticated;

grant select, insert, update, delete on table public.finance_service_income_records to service_role;
grant select, insert, update, delete on table public.finance_service_income_pix to service_role;

comment on table public.finance_service_income_records is
  'Conferências das entradas de cada culto, acessíveis somente pelo painel financeiro administrativo.';
comment on table public.finance_service_income_pix is
  'Detalhamento dos valores recebidos por Pix e do banco de destino em cada culto.';
