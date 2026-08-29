-- Integra a agenda privada do Rilldy Gabriel com a area de discipuladores da
-- Casa Forte. Compromissos privados nunca sao expostos: a igreja enxerga
-- somente os horarios publicados explicitamente pelos membros da agenda.

create schema if not exists private;

create table public.pastoral_calendar_settings (
  calendar_id uuid primary key references public.agenda_calendars(id) on delete cascade,
  title text not null default 'Agenda pastoral'
    check (char_length(btrim(title)) between 2 and 100),
  audience text not null default 'discipler'
    check (audience = 'discipler'),
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pastoral_availability_slots (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.pastoral_calendar_settings(calendar_id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  host_name text not null check (char_length(btrim(host_name)) between 2 and 100),
  location text check (location is null or char_length(btrim(location)) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'available'
    check (status in ('available', 'booked', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pastoral_availability_time_check check (
    ends_at > starts_at
    and ends_at <= starts_at + interval '4 hours'
  )
);

create table public.pastoral_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.pastoral_availability_slots(id) on delete restrict,
  requester_id uuid not null references auth.users(id) on delete restrict,
  requester_name text not null check (char_length(btrim(requester_name)) between 2 and 180),
  requester_phone text check (requester_phone is null or char_length(requester_phone) <= 30),
  agenda_event_id uuid references public.agenda_events(id) on delete set null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled')),
  booked_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  read_at timestamptz,
  constraint pastoral_booking_cancel_state_check check (
    (status = 'confirmed' and cancelled_at is null and cancelled_by is null)
    or (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null)
  )
);

create index pastoral_slots_calendar_status_start_idx
  on public.pastoral_availability_slots (calendar_id, status, starts_at);
create index pastoral_slots_created_by_idx
  on public.pastoral_availability_slots (created_by);
create index pastoral_bookings_requester_booked_idx
  on public.pastoral_bookings (requester_id, booked_at desc);
create index pastoral_bookings_agenda_event_idx
  on public.pastoral_bookings (agenda_event_id)
  where agenda_event_id is not null;
create unique index pastoral_bookings_one_active_per_slot_idx
  on public.pastoral_bookings (slot_id)
  where status = 'confirmed';

create or replace function private.is_pastoral_calendar_member(target_calendar uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.agenda_members
      where calendar_id = target_calendar
        and user_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.agenda_calendars
      where id = target_calendar
        and owner_id = (select auth.uid())
    )
  );
$$;

create or replace function private.is_approved_discipler()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.discipler_roles role
      join public.member_profiles profile on profile.user_id = role.member_id
      where role.member_id = (select auth.uid())
        and (profile.approval_status = 'approved' or profile.is_admin = true)
    );
$$;

create or replace function private.can_manage_pastoral_calendar(target_calendar uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1
      from public.agenda_calendars
      where id = target_calendar
        and owner_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.agenda_members
      where calendar_id = target_calendar
        and user_id = (select auth.uid())
        and role in ('owner', 'editor')
    )
  );
$$;

alter table public.pastoral_calendar_settings enable row level security;
alter table public.pastoral_availability_slots enable row level security;
alter table public.pastoral_bookings enable row level security;

create policy pastoral_settings_read
  on public.pastoral_calendar_settings for select to authenticated
  using (
    (select private.is_pastoral_calendar_member(calendar_id))
    or (is_active and (select private.is_approved_discipler()))
  );

create policy pastoral_slots_read
  on public.pastoral_availability_slots for select to authenticated
  using (
    (select private.is_pastoral_calendar_member(calendar_id))
    or (
      status in ('available', 'booked')
      and starts_at > now()
      and (select private.is_approved_discipler())
      and exists (
        select 1
        from public.pastoral_calendar_settings setting
        where setting.calendar_id = pastoral_availability_slots.calendar_id
          and setting.is_active = true
      )
    )
  );

create policy pastoral_bookings_read
  on public.pastoral_bookings for select to authenticated
  using (
    requester_id = (select auth.uid())
    or exists (
      select 1
      from public.pastoral_availability_slots slot
      where slot.id = pastoral_bookings.slot_id
        and (select private.is_pastoral_calendar_member(slot.calendar_id))
    )
  );

create or replace function public.configure_pastoral_calendar(
  p_calendar_id uuid,
  p_title text default 'Agenda pastoral',
  p_is_active boolean default true
) returns public.pastoral_calendar_settings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_setting public.pastoral_calendar_settings;
begin
  if v_user_id is null
    or not (select private.can_manage_pastoral_calendar(p_calendar_id)) then
    raise exception 'Acesso nao autorizado';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 2 and 100 then
    raise exception 'Titulo invalido';
  end if;

  insert into public.pastoral_calendar_settings (
    calendar_id, title, audience, is_active, created_by, updated_at
  ) values (
    p_calendar_id, btrim(p_title), 'discipler', p_is_active, v_user_id, now()
  )
  on conflict (calendar_id) do update
    set title = excluded.title,
        is_active = excluded.is_active,
        updated_at = now()
  returning * into v_setting;

  return v_setting;
end;
$$;

create or replace function public.publish_pastoral_slot(
  p_calendar_id uuid,
  p_host_name text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_location text default null
) returns public.pastoral_availability_slots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_slot public.pastoral_availability_slots;
begin
  if v_user_id is null
    or not (select private.can_manage_pastoral_calendar(p_calendar_id)) then
    raise exception 'Acesso nao autorizado';
  end if;

  if char_length(btrim(coalesce(p_host_name, ''))) not between 2 and 100 then
    raise exception 'Responsavel invalido';
  end if;

  if p_starts_at <= now()
    or p_starts_at > now() + interval '180 days'
    or p_ends_at <= p_starts_at
    or p_ends_at > p_starts_at + interval '4 hours' then
    raise exception 'Horario invalido';
  end if;

  -- Serializa publicacoes do mesmo calendario durante a verificacao de choque.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_calendar_id::text, 7811)
  );

  if exists (
    select 1
    from public.agenda_events event
    where event.calendar_id = p_calendar_id
      and event.status <> 'cancelado'
      and event.starts_at < p_ends_at
      and event.ends_at > p_starts_at
  ) then
    raise exception 'Esse horario ja possui um compromisso na agenda';
  end if;

  if exists (
    select 1
    from public.pastoral_availability_slots slot
    where slot.calendar_id = p_calendar_id
      and slot.status in ('available', 'booked')
      and slot.starts_at < p_ends_at
      and slot.ends_at > p_starts_at
  ) then
    raise exception 'Esse horario ja foi publicado';
  end if;

  insert into public.pastoral_calendar_settings (
    calendar_id, title, audience, is_active, created_by
  ) values (
    p_calendar_id, 'Agenda pastoral', 'discipler', true, v_user_id
  ) on conflict (calendar_id) do nothing;

  insert into public.pastoral_availability_slots (
    calendar_id, created_by, host_name, location, starts_at, ends_at
  ) values (
    p_calendar_id,
    v_user_id,
    btrim(p_host_name),
    nullif(btrim(coalesce(p_location, '')), ''),
    p_starts_at,
    p_ends_at
  ) returning * into v_slot;

  return v_slot;
end;
$$;

create or replace function public.book_pastoral_slot(p_slot_id uuid)
returns table (
  booking_id uuid,
  booked_slot_id uuid,
  calendar_id uuid,
  calendar_owner_id uuid,
  host_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  requester_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_slot public.pastoral_availability_slots;
  v_owner_id uuid;
  v_requester_name text;
  v_requester_phone text;
  v_booking_id uuid;
  v_event_id uuid;
begin
  if v_user_id is null or not (select private.is_approved_discipler()) then
    raise exception 'Somente discipuladores autorizados podem reservar';
  end if;

  select profile.full_name, profile.phone
    into v_requester_name, v_requester_phone
  from public.member_profiles profile
  where profile.user_id = v_user_id;

  if char_length(btrim(coalesce(v_requester_name, ''))) < 2 then
    raise exception 'Complete seu nome no cadastro antes de reservar';
  end if;

  select slot.*
    into v_slot
  from public.pastoral_availability_slots slot
  join public.pastoral_calendar_settings setting
    on setting.calendar_id = slot.calendar_id and setting.is_active = true
  where slot.id = p_slot_id
  for update of slot;

  if v_slot.id is null
    or v_slot.status <> 'available'
    or v_slot.starts_at <= now() then
    raise exception 'Esse horario nao esta mais disponivel';
  end if;

  select owner_id into v_owner_id
  from public.agenda_calendars
  where id = v_slot.calendar_id;

  if v_owner_id is null then
    raise exception 'Agenda pastoral indisponivel';
  end if;

  if exists (
    select 1
    from public.agenda_events event
    where event.calendar_id = v_slot.calendar_id
      and event.status <> 'cancelado'
      and event.starts_at < v_slot.ends_at
      and event.ends_at > v_slot.starts_at
  ) then
    update public.pastoral_availability_slots
      set status = 'cancelled', updated_at = now()
    where id = v_slot.id;
    raise exception 'Esse horario acabou de ficar indisponivel';
  end if;

  if exists (
    select 1
    from public.pastoral_bookings booking
    join public.pastoral_availability_slots booked_slot on booked_slot.id = booking.slot_id
    where booking.requester_id = v_user_id
      and booking.status = 'confirmed'
      and booked_slot.starts_at < v_slot.ends_at
      and booked_slot.ends_at > v_slot.starts_at
  ) then
    raise exception 'Voce ja possui outra reserva nesse periodo';
  end if;

  insert into public.pastoral_bookings (
    slot_id, requester_id, requester_name, requester_phone
  ) values (
    v_slot.id, v_user_id, btrim(v_requester_name), v_requester_phone
  ) returning id into v_booking_id;

  insert into public.agenda_events (
    calendar_id,
    created_by,
    title,
    description,
    category,
    location,
    person_name,
    person_phone,
    starts_at,
    ends_at,
    status,
    reminder_minutes,
    whatsapp_reminder
  ) values (
    v_slot.calendar_id,
    v_owner_id,
    'Discipulado pastoral - ' || btrim(v_requester_name),
    'Reserva feita pelo painel da Casa Forte. Responsavel: ' || v_slot.host_name || '.',
    'discipulado',
    v_slot.location,
    btrim(v_requester_name),
    v_requester_phone,
    v_slot.starts_at,
    v_slot.ends_at,
    'confirmado',
    60,
    false
  ) returning id into v_event_id;

  update public.pastoral_bookings
    set agenda_event_id = v_event_id
  where id = v_booking_id;

  update public.pastoral_availability_slots
    set status = 'booked', updated_at = now()
  where id = v_slot.id;

  return query select
    v_booking_id,
    v_slot.id,
    v_slot.calendar_id,
    v_owner_id,
    v_slot.host_name,
    v_slot.starts_at,
    v_slot.ends_at,
    btrim(v_requester_name);
end;
$$;

create or replace function public.cancel_pastoral_slot(p_slot_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendar_id uuid;
  v_status text;
begin
  select calendar_id, status into v_calendar_id, v_status
  from public.pastoral_availability_slots
  where id = p_slot_id
  for update;

  if v_calendar_id is null
    or not (select private.can_manage_pastoral_calendar(v_calendar_id)) then
    raise exception 'Acesso nao autorizado';
  end if;

  if v_status = 'booked' then
    raise exception 'Cancele a reserva antes de remover o horario';
  end if;

  update public.pastoral_availability_slots
    set status = 'cancelled', updated_at = now()
  where id = p_slot_id and status = 'available';

  return found;
end;
$$;

create or replace function public.cancel_pastoral_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_booking public.pastoral_bookings;
  v_calendar_id uuid;
begin
  select booking.* into v_booking
  from public.pastoral_bookings booking
  where booking.id = p_booking_id
  for update;

  select slot.calendar_id into v_calendar_id
  from public.pastoral_availability_slots slot
  where slot.id = v_booking.slot_id;

  if v_booking.id is null
    or v_user_id is null
    or not (select private.can_manage_pastoral_calendar(v_calendar_id)) then
    raise exception 'Acesso nao autorizado';
  end if;

  if v_booking.status <> 'confirmed' then
    return false;
  end if;

  update public.pastoral_bookings
    set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user_id
  where id = p_booking_id;

  update public.pastoral_availability_slots
    set status = 'cancelled', updated_at = now()
  where id = v_booking.slot_id;

  update public.agenda_events
    set status = 'cancelado', updated_at = now()
  where id = v_booking.agenda_event_id;

  return true;
end;
$$;

create or replace function public.mark_pastoral_booking_read(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_calendar_id uuid;
begin
  select slot.calendar_id into v_calendar_id
  from public.pastoral_bookings booking
  join public.pastoral_availability_slots slot on slot.id = booking.slot_id
  where booking.id = p_booking_id;

  if v_calendar_id is null
    or not (select private.can_manage_pastoral_calendar(v_calendar_id)) then
    raise exception 'Acesso nao autorizado';
  end if;

  update public.pastoral_bookings
    set read_at = coalesce(read_at, now())
  where id = p_booking_id;

  return found;
end;
$$;

revoke all on public.pastoral_calendar_settings from public, anon, authenticated;
revoke all on public.pastoral_availability_slots from public, anon, authenticated;
revoke all on public.pastoral_bookings from public, anon, authenticated;
grant select on public.pastoral_calendar_settings,
  public.pastoral_availability_slots,
  public.pastoral_bookings to authenticated;
grant all on public.pastoral_calendar_settings,
  public.pastoral_availability_slots,
  public.pastoral_bookings to service_role;

revoke all on function private.is_pastoral_calendar_member(uuid) from public, anon;
revoke all on function private.is_approved_discipler() from public, anon;
revoke all on function private.can_manage_pastoral_calendar(uuid) from public, anon;
grant execute on function private.is_pastoral_calendar_member(uuid),
  private.is_approved_discipler(),
  private.can_manage_pastoral_calendar(uuid) to authenticated;

revoke all on function public.configure_pastoral_calendar(uuid, text, boolean) from public, anon;
revoke all on function public.publish_pastoral_slot(uuid, text, timestamptz, timestamptz, text) from public, anon;
revoke all on function public.book_pastoral_slot(uuid) from public, anon;
revoke all on function public.cancel_pastoral_slot(uuid) from public, anon;
revoke all on function public.cancel_pastoral_booking(uuid) from public, anon;
revoke all on function public.mark_pastoral_booking_read(uuid) from public, anon;
grant execute on function public.configure_pastoral_calendar(uuid, text, boolean),
  public.publish_pastoral_slot(uuid, text, timestamptz, timestamptz, text),
  public.book_pastoral_slot(uuid),
  public.cancel_pastoral_slot(uuid),
  public.cancel_pastoral_booking(uuid),
  public.mark_pastoral_booking_read(uuid) to authenticated;

comment on table public.pastoral_availability_slots is
  'Somente horarios publicados; nenhum compromisso privado da agenda e exposto.';
comment on table public.pastoral_bookings is
  'Reservas confirmadas por discipuladores autorizados, com espelho privado na agenda pastoral.';
comment on function public.book_pastoral_slot(uuid) is
  'Reserva atomica: bloqueia o horario e cria o compromisso privado na mesma transacao.';
