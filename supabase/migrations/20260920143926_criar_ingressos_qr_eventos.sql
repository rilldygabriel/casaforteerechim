alter table public.mercado_pago_payments
  drop constraint if exists mercado_pago_payments_registration_id_key;

create unique index if not exists mercado_pago_payments_registration_active_idx
  on public.mercado_pago_payments (registration_id)
  where registration_id is not null
    and status in ('created', 'pending', 'in_process', 'approved');

create table public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  registration_id uuid not null unique references public.event_registrations(id) on delete restrict,
  public_token uuid not null unique default gen_random_uuid(),
  status text not null default 'valid'
    check (status in ('valid', 'redeemed', 'cancelled')),
  redeemed_at timestamptz,
  redeemed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_tickets_redemption_check check (
    (status = 'redeemed' and redeemed_at is not null and redeemed_by is not null)
    or (status <> 'redeemed' and redeemed_at is null and redeemed_by is null)
  )
);

create index event_tickets_event_status_idx
  on public.event_tickets (event_id, status, created_at desc);

alter table public.event_tickets enable row level security;
revoke all on public.event_tickets from anon, authenticated;
grant select, insert, update, delete on public.event_tickets to service_role;

comment on table public.event_tickets is
  'Ingressos digitais com QR emitidos somente para inscricoes de eventos com pagamento aprovado.';
comment on column public.event_tickets.public_token is
  'Token aleatorio apresentado no QR; nao contem dados pessoais e funciona como credencial de retirada.';

insert into public.event_tickets (event_id, registration_id)
select distinct payment.event_id, payment.registration_id
from public.mercado_pago_payments payment
join public.events event on event.id = payment.event_id
join public.event_registrations registration on registration.id = payment.registration_id
where payment.purpose = 'event'
  and payment.status = 'approved'
  and event.slug = 'hamburguer-da-casa-20-09'
  and registration.archived_at is null
on conflict (registration_id) do nothing;
