alter table public.member_profiles
  add column if not exists can_sell_manual_tickets boolean not null default false;

comment on column public.member_profiles.can_sell_manual_tickets is
  'Permite registrar ingressos presenciais pagos em dinheiro, sem ampliar as demais permissoes do painel.';

update public.member_profiles
set can_sell_manual_tickets = user_id in (
  '34944370-8853-4c1b-866b-8c80b4e59829'::uuid,
  '8e8adcf7-39a3-4d42-bf56-fc8d473a02e7'::uuid
)
where can_sell_manual_tickets = true
   or user_id in (
     '34944370-8853-4c1b-866b-8c80b4e59829'::uuid,
     '8e8adcf7-39a3-4d42-bf56-fc8d473a02e7'::uuid
   );

create index if not exists member_profiles_manual_ticket_sales_idx
  on public.member_profiles (user_id)
  where can_sell_manual_tickets = true;

alter table public.mercado_pago_payments
  drop constraint if exists mercado_pago_payments_payment_provider_check;
alter table public.mercado_pago_payments
  add constraint mercado_pago_payments_payment_provider_check
  check (payment_provider in ('mercado_pago', 'pagbank', 'manual'));

alter table public.mercado_pago_payments
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists mercado_pago_payments_created_by_idx
  on public.mercado_pago_payments (created_by)
  where created_by is not null;
