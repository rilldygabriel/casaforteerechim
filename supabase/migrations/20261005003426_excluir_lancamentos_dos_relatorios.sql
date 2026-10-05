-- Reporting-only exclusion. Keep approved payments, provider references and
-- income fingerprints intact so reconciliation cannot recreate a removed entry.
alter table public.mercado_pago_payments
  add column report_excluded_at timestamptz,
  add column report_exclusion_reason text;

alter table public.finance_income_entries
  add column report_excluded_at timestamptz,
  add column report_exclusion_reason text;

comment on column public.mercado_pago_payments.report_excluded_at is
  'Administrative reporting exclusion only; never changes provider payment status or refunds funds.';
comment on column public.finance_income_entries.report_excluded_at is
  'Administrative reporting exclusion; retain the original entry for audit and import deduplication.';
