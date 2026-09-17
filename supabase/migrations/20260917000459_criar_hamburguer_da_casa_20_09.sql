alter table public.event_registrations
  add column if not exists simple_quantity integer not null default 0,
  add column if not exists double_quantity integer not null default 0,
  add column if not exists order_total_cents bigint not null default 0;

alter table public.event_registrations
  drop constraint if exists event_registrations_simple_quantity_check,
  add constraint event_registrations_simple_quantity_check
    check (simple_quantity between 0 and 100),
  drop constraint if exists event_registrations_double_quantity_check,
  add constraint event_registrations_double_quantity_check
    check (double_quantity between 0 and 100),
  drop constraint if exists event_registrations_order_total_cents_check,
  add constraint event_registrations_order_total_cents_check
    check (order_total_cents >= 0);

insert into public.events (
  title,
  slug,
  description,
  category,
  start_date,
  start_time,
  location,
  image_url,
  status,
  registration_enabled,
  registration_status,
  registration_deadline,
  capacity,
  is_public,
  is_featured,
  registration_fee_cents
)
values (
  'Hambúrguer da Casa',
  'hamburguer-da-casa-20-09',
  'Depois do culto de domingo, fique com a família da Casa. Reserve quantos hambúrgueres desejar: simples por R$ 20 ou duplo por R$ 30.',
  'Eventos especiais',
  '2026-09-20',
  null,
  'Igreja Casa Forte Erechim',
  '/images/eventos/hamburguer-da-casa-20-09.jpg',
  'confirmed',
  true,
  'open',
  '2026-09-20 21:00:00-03',
  100,
  true,
  true,
  2000
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  category = excluded.category,
  start_date = excluded.start_date,
  start_time = excluded.start_time,
  location = excluded.location,
  image_url = excluded.image_url,
  status = excluded.status,
  registration_enabled = excluded.registration_enabled,
  registration_status = excluded.registration_status,
  registration_deadline = excluded.registration_deadline,
  capacity = excluded.capacity,
  is_public = excluded.is_public,
  is_featured = excluded.is_featured,
  registration_fee_cents = excluded.registration_fee_cents,
  archived_at = null,
  updated_at = now();

create or replace function public.create_hamburger_registration(
  p_event_slug text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_phone_normalized text,
  p_simple_quantity integer,
  p_double_quantity integer
)
returns table (registration_id uuid, total_amount_cents bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_event public.events%rowtype;
  reserved_quantity integer;
  requested_quantity integer;
  created_registration_id uuid;
  calculated_total bigint;
begin
  requested_quantity := p_simple_quantity + p_double_quantity;
  if p_simple_quantity < 0 or p_double_quantity < 0 or requested_quantity < 1 or requested_quantity > 100 then
    raise exception using errcode = '22023', message = 'INVALID_QUANTITY';
  end if;

  select *
  into selected_event
  from public.events
  where slug = p_event_slug
  for update;

  if selected_event.id is null
    or selected_event.archived_at is not null
    or selected_event.is_public is not true
    or selected_event.registration_enabled is not true
    or selected_event.registration_status <> 'open'
    or selected_event.status = 'cancelled'
    or (selected_event.registration_deadline is not null and selected_event.registration_deadline < now()) then
    raise exception using errcode = 'P0001', message = 'REGISTRATION_CLOSED';
  end if;

  if exists (
    select 1
    from public.event_registrations registration
    where registration.event_id = selected_event.id
      and registration.phone_normalized = p_phone_normalized
  ) then
    raise unique_violation using message = 'DUPLICATE_REGISTRATION';
  end if;

  select coalesce(sum(registration.simple_quantity + registration.double_quantity), 0)::integer
  into reserved_quantity
  from public.event_registrations registration
  where registration.event_id = selected_event.id
    and registration.archived_at is null
    and registration.status not in ('cancelled', 'rejected', 'withdrew');

  if selected_event.capacity is not null and reserved_quantity + requested_quantity > selected_event.capacity then
    raise exception using errcode = 'P0001', message = 'CAPACITY_EXCEEDED';
  end if;

  calculated_total := (p_simple_quantity * 2000)::bigint + (p_double_quantity * 3000)::bigint;

  insert into public.event_registrations (
    event_id,
    full_name,
    email,
    phone,
    phone_normalized,
    attendance_duration,
    notes,
    status,
    consent,
    simple_quantity,
    double_quantity,
    order_total_cents
  ) values (
    selected_event.id,
    p_full_name,
    p_email,
    p_phone,
    p_phone_normalized,
    'not_attending',
    '',
    'awaiting_payment',
    true,
    p_simple_quantity,
    p_double_quantity,
    calculated_total
  )
  returning id into created_registration_id;

  return query select created_registration_id, calculated_total;
end;
$$;

revoke all on function public.create_hamburger_registration(text, text, text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.create_hamburger_registration(text, text, text, text, text, integer, integer)
  to service_role;
