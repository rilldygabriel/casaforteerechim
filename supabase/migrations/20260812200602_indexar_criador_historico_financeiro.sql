create index if not exists finance_ledger_entries_created_by_idx
  on public.finance_ledger_entries (created_by)
  where created_by is not null;
