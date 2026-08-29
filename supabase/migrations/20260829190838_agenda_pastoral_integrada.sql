-- Agenda pastoral compartilhada entre dois projetos Supabase distintos.
-- A Casa Forte armazena somente disponibilidades explicitamente publicadas e
-- reservas. Compromissos privados do site Rio de Gabriel nunca são copiados.

create schema if not exists private;

create table public.pastoral_calendar_settings (
  source_calendar_id uuid primary key,
  title text not null default 'Agenda pastoral' check (char_length(btrim(title)) between 2 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pastoral_availability_slots (
  id uuid primary key default gen_random_uuid(),
  source_calendar_id uuid not null references public.pastoral_calendar_settings(source_calendar_id) on delete cascade,
  host_name text not null check (host_name in ('Pr. Rilldy', 'Pra. Lize', 'Pr. Rilldy e Pra. Lize')),
  location text check (location is null or char_length(btrim(location)) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'available' check (status in ('available', 'booked', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pastoral_availability_time_check check (ends_at > starts_at and ends_at <= starts_at + interval '4 hours')
);

create table public.pastoral_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.pastoral_availability_slots(id) on delete restrict,
  requester_id uuid not null references auth.users(id) on delete restrict,
  requester_name text not null check (char_length(btrim(requester_name)) between 2 and 180),
  requester_phone text check (requester_phone is null or char_length(requester_phone) <= 30),
  source_event_id uuid,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  read_at timestamptz,
  constraint pastoral_booking_cancel_state_check check (
    (status = 'confirmed' and cancelled_at is null and cancelled_by is null)
    or (status = 'cancelled' and cancelled_at is not null)
  )
);

create index pastoral_slots_calendar_status_start_idx on public.pastoral_availability_slots (source_calendar_id, status, starts_at);
create index pastoral_bookings_requester_booked_idx on public.pastoral_bookings (requester_id, booked_at desc);
create unique index pastoral_bookings_one_active_per_slot_idx on public.pastoral_bookings (slot_id) where status = 'confirmed';

create or replace function private.is_approved_discipler()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.discipler_roles role
    join public.member_profiles profile on profile.user_id = role.member_id
    where role.member_id = (select auth.uid())
      and (profile.approval_status = 'approved' or profile.is_admin = true)
  );
$$;

create or replace function private.is_casa_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.member_profiles where user_id = (select auth.uid()) and is_admin = true
  );
$$;

alter table public.pastoral_calendar_settings enable row level security;
alter table public.pastoral_availability_slots enable row level security;
alter table public.pastoral_bookings enable row level security;

create policy pastoral_settings_read on public.pastoral_calendar_settings for select to authenticated
  using ((select private.is_approved_discipler()) or (select private.is_casa_admin()));
create policy pastoral_slots_read on public.pastoral_availability_slots for select to authenticated
  using ((select private.is_approved_discipler()) or (select private.is_casa_admin()));
create policy pastoral_bookings_read on public.pastoral_bookings for select to authenticated
  using (requester_id = (select auth.uid()) or (select private.is_casa_admin()));

create or replace function public.book_pastoral_slot(p_slot_id uuid)
returns table (booking_id uuid, slot_id uuid, source_calendar_id uuid, requester_name text,
  requester_phone text, host_name text, starts_at timestamptz, ends_at timestamptz, location text)
language plpgsql security definer set search_path = '' as $$
declare
  v_user_id uuid := (select auth.uid());
  v_slot public.pastoral_availability_slots;
  v_name text;
  v_phone text;
  v_booking_id uuid;
begin
  if v_user_id is null or not (select private.is_approved_discipler()) then
    raise exception 'somente discipuladores autorizados podem reservar';
  end if;

  select slot.* into v_slot from public.pastoral_availability_slots slot
  join public.pastoral_calendar_settings setting on setting.source_calendar_id = slot.source_calendar_id
  where slot.id = p_slot_id and slot.status = 'available' and setting.is_active
  for update of slot;
  if not found or v_slot.starts_at <= now() then raise exception 'horario nao esta mais disponivel'; end if;

  if exists (
    select 1 from public.pastoral_bookings booking
    join public.pastoral_availability_slots other_slot on other_slot.id = booking.slot_id
    where booking.requester_id = v_user_id and booking.status = 'confirmed'
      and other_slot.starts_at < v_slot.ends_at and other_slot.ends_at > v_slot.starts_at
  ) then raise exception 'discipulador ja possui outra reserva nesse periodo'; end if;

  select coalesce(nullif(btrim(full_name), ''), email), phone into v_name, v_phone
  from public.member_profiles where user_id = v_user_id;
  if v_name is null then raise exception 'perfil do discipulador nao encontrado'; end if;

  insert into public.pastoral_bookings (slot_id, requester_id, requester_name, requester_phone)
  values (v_slot.id, v_user_id, v_name, v_phone) returning id into v_booking_id;
  update public.pastoral_availability_slots set status = 'booked', updated_at = now() where id = v_slot.id;

  return query select v_booking_id, v_slot.id, v_slot.source_calendar_id, v_name, v_phone,
    v_slot.host_name, v_slot.starts_at, v_slot.ends_at, v_slot.location;
end;
$$;

revoke all on public.pastoral_calendar_settings from public, anon, authenticated;
revoke all on public.pastoral_availability_slots from public, anon, authenticated;
revoke all on public.pastoral_bookings from public, anon, authenticated;
grant select on public.pastoral_calendar_settings, public.pastoral_availability_slots, public.pastoral_bookings to authenticated;
grant all on public.pastoral_calendar_settings, public.pastoral_availability_slots, public.pastoral_bookings to service_role;
revoke all on function private.is_approved_discipler() from public, anon;
revoke all on function private.is_casa_admin() from public, anon;
grant execute on function private.is_approved_discipler(), private.is_casa_admin() to authenticated;
revoke all on function public.book_pastoral_slot(uuid) from public, anon;
grant execute on function public.book_pastoral_slot(uuid) to authenticated;

comment on table public.pastoral_availability_slots is 'Somente horarios pastorais publicados; nenhum compromisso privado e copiado entre os sites.';
comment on table public.pastoral_bookings is 'Reservas dos discipuladores autorizados da Casa Forte.';
