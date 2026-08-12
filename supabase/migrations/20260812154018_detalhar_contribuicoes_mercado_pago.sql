alter table public.mercado_pago_payments
  drop constraint if exists mercado_pago_payments_purpose_check;

alter table public.mercado_pago_payments
  add constraint mercado_pago_payments_purpose_check
  check (purpose in ('tithe', 'offering', 'firstfruits', 'contribution', 'event'));

alter table public.mercado_pago_payments
  add column tithe_cents bigint not null default 0 check (tithe_cents >= 0),
  add column offering_cents bigint not null default 0 check (offering_cents >= 0),
  add column firstfruits_cents bigint not null default 0 check (firstfruits_cents >= 0);

alter table public.mercado_pago_payments
  add constraint mercado_pago_contribution_breakdown_check check (
    (purpose = 'contribution'
      and tithe_cents + offering_cents + firstfruits_cents = amount_cents
      and tithe_cents + offering_cents + firstfruits_cents > 0)
    or
    (purpose <> 'contribution'
      and tithe_cents = 0
      and offering_cents = 0
      and firstfruits_cents = 0)
  );

create index mercado_pago_contributions_approved_idx
  on public.mercado_pago_payments (approved_at desc)
  where purpose = 'contribution' and status = 'approved';

comment on column public.mercado_pago_payments.tithe_cents is
  'Parcela de dízimo informada no checkout único de contribuição.';
comment on column public.mercado_pago_payments.offering_cents is
  'Parcela de oferta informada no checkout único de contribuição.';
comment on column public.mercado_pago_payments.firstfruits_cents is
  'Parcela de primícias informada no checkout único de contribuição.';
