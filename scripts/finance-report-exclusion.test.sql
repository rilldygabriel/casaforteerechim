-- Integration regression: runs against existing data but persists no changes.
begin;
do $$
declare
  payment public.mercado_pago_payments%rowtype;
  income public.finance_income_entries%rowtype;
  payment_total_before bigint;
  income_total_before bigint;
begin
  select p.* into strict payment
  from public.mercado_pago_payments p
  where p.purpose = 'contribution' and p.status = 'approved'
    and p.report_excluded_at is null
    and exists (select 1 from public.finance_income_entries i
      where i.mercado_pago_payment_id = p.id and i.report_excluded_at is null)
  limit 1;
  select * into strict income from public.finance_income_entries
  where mercado_pago_payment_id = payment.id and report_excluded_at is null;

  select coalesce(sum(amount_cents), 0) into payment_total_before
  from public.mercado_pago_payments
  where purpose = 'contribution' and status = 'approved' and report_excluded_at is null;
  select coalesce(sum(amount_cents), 0) into income_total_before
  from public.finance_income_entries where report_excluded_at is null;

  update public.mercado_pago_payments set report_excluded_at = now(),
    report_exclusion_reason = 'Rolled-back regression test' where id = payment.id;
  update public.finance_income_entries set report_excluded_at = now(),
    report_exclusion_reason = 'Rolled-back regression test' where id = income.id;

  assert not exists (select 1 from public.mercado_pago_payments
    where id = payment.id and report_excluded_at is null), 'Payment remains visible';
  assert not exists (select 1 from public.finance_income_entries
    where id = income.id and report_excluded_at is null), 'Income remains visible';
  assert (select coalesce(sum(amount_cents), 0) from public.mercado_pago_payments
    where purpose = 'contribution' and status = 'approved' and report_excluded_at is null)
    = payment_total_before - payment.amount_cents, 'Payment total incorrect';
  assert (select coalesce(sum(amount_cents), 0) from public.finance_income_entries
    where report_excluded_at is null) = income_total_before - income.amount_cents,
    'Income total incorrect';
  assert (select to_jsonb(p) - 'report_excluded_at' - 'report_exclusion_reason'
    from public.mercado_pago_payments p where id = payment.id)
    = to_jsonb(payment) - 'report_excluded_at' - 'report_exclusion_reason',
    'Payment data changed';
  assert (select to_jsonb(i) - 'report_excluded_at' - 'report_exclusion_reason'
    from public.finance_income_entries i where id = income.id)
    = to_jsonb(income) - 'report_excluded_at' - 'report_exclusion_reason',
    'Income audit data changed';
end $$;
rollback;
