create or replace function private.can_book_pastoral_agenda()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.member_profiles profile
      join public.member_group_memberships membership
        on membership.member_id = profile.user_id
      where profile.user_id = (select auth.uid())
        and (profile.approval_status = 'approved' or profile.is_admin = true)
        and membership.group_key in ('discipulador', 'equipe_pastoral')
    );
$$;

revoke all on function private.can_book_pastoral_agenda() from public, anon;
grant execute on function private.can_book_pastoral_agenda() to authenticated;

drop policy pastoral_settings_read on public.pastoral_calendar_settings;
create policy pastoral_settings_read
  on public.pastoral_calendar_settings for select to authenticated
  using ((select private.can_book_pastoral_agenda()) or (select private.is_casa_admin()));

drop policy pastoral_slots_read on public.pastoral_availability_slots;
create policy pastoral_slots_read
  on public.pastoral_availability_slots for select to authenticated
  using ((select private.can_book_pastoral_agenda()) or (select private.is_casa_admin()));

create or replace function public.book_pastoral_slot(
  p_slot_id uuid,
  p_selected_host_name text default null
)
returns table (
  booking_id uuid,
  slot_id uuid,
  source_calendar_id uuid,
  requester_name text,
  requester_phone text,
  host_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  location text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_slot public.pastoral_availability_slots;
  v_slot_host text;
  v_selected_host text;
  v_name text;
  v_phone text;
  v_booking_id uuid;
begin
  if v_user_id is null or not (select private.can_book_pastoral_agenda()) then
    raise exception 'somente discipuladores e equipe pastoral autorizados podem reservar';
  end if;

  select slot.* into v_slot
  from public.pastoral_availability_slots slot
  join public.pastoral_calendar_settings setting
    on setting.source_calendar_id = slot.source_calendar_id
  where slot.id = p_slot_id
    and slot.status = 'available'
    and setting.is_active
  for update of slot;

  if not found or v_slot.starts_at <= now() then
    raise exception 'horario nao esta mais disponivel';
  end if;

  v_slot_host := case v_slot.host_name
    when 'Pr. Rilldy' then 'Rilldy'
    when 'Pra. Lize' then 'Lisi'
    when 'Pr. Rilldy e Pra. Lize' then 'Rilldy e Lisi'
    else v_slot.host_name
  end;

  v_selected_host := coalesce(nullif(btrim(p_selected_host_name), ''), v_slot_host);
  if v_slot_host = 'Rilldy e Lisi' then
    if v_selected_host not in ('Rilldy', 'Lisi', 'Rilldy e Lisi') then
      raise exception 'escolha pastoral invalida';
    end if;
  elsif v_selected_host <> v_slot_host then
    raise exception 'responsavel nao esta disponivel nesse horario';
  end if;

  if exists (
    select 1
    from public.pastoral_bookings booking
    join public.pastoral_availability_slots other_slot on other_slot.id = booking.slot_id
    where booking.requester_id = v_user_id
      and booking.status = 'confirmed'
      and other_slot.starts_at < v_slot.ends_at
      and other_slot.ends_at > v_slot.starts_at
  ) then
    raise exception 'membro ja possui outra reserva nesse periodo';
  end if;

  select coalesce(nullif(btrim(full_name), ''), email), phone
  into v_name, v_phone
  from public.member_profiles
  where user_id = v_user_id;

  if v_name is null then
    raise exception 'perfil do membro nao encontrado';
  end if;

  insert into public.pastoral_bookings (
    slot_id,
    requester_id,
    requester_name,
    requester_phone,
    selected_host_name
  )
  values (v_slot.id, v_user_id, v_name, v_phone, v_selected_host)
  returning id into v_booking_id;

  update public.pastoral_availability_slots
  set status = 'booked', updated_at = now()
  where id = v_slot.id;

  return query
  select
    v_booking_id,
    v_slot.id,
    v_slot.source_calendar_id,
    v_name,
    v_phone,
    v_selected_host,
    v_slot.starts_at,
    v_slot.ends_at,
    v_slot.location;
end;
$$;

revoke all on function public.book_pastoral_slot(uuid, text) from public, anon;
grant execute on function public.book_pastoral_slot(uuid, text) to authenticated;

comment on function private.can_book_pastoral_agenda() is
  'Autoriza membros aprovados classificados como discipuladores ou equipe pastoral a visualizar e reservar horarios pastorais.';

comment on table public.pastoral_bookings is
  'Reservas dos discipuladores e integrantes da equipe pastoral autorizados da Casa Forte.';
