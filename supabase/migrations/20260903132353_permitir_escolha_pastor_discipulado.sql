alter table public.pastoral_bookings
  add column selected_host_name text;

update public.pastoral_bookings booking
set selected_host_name = case slot.host_name
  when 'Pr. Rilldy' then 'Rilldy'
  when 'Pra. Lize' then 'Lisi'
  when 'Pr. Rilldy e Pra. Lize' then 'Rilldy e Lisi'
  else slot.host_name
end
from public.pastoral_availability_slots slot
where slot.id = booking.slot_id;

alter table public.pastoral_bookings
  alter column selected_host_name set not null,
  add constraint pastoral_bookings_selected_host_check
    check (selected_host_name in ('Rilldy', 'Lisi', 'Rilldy e Lisi'));

drop function public.book_pastoral_slot(uuid);

create function public.book_pastoral_slot(
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
  if v_user_id is null or not (select private.is_approved_discipler()) then
    raise exception 'somente discipuladores autorizados podem reservar';
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
    raise exception 'discipulador ja possui outra reserva nesse periodo';
  end if;

  select coalesce(nullif(btrim(full_name), ''), email), phone
  into v_name, v_phone
  from public.member_profiles
  where user_id = v_user_id;

  if v_name is null then
    raise exception 'perfil do discipulador nao encontrado';
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

comment on column public.pastoral_bookings.selected_host_name is
  'Responsavel escolhido pelo discipulo quando o horario foi publicado para os dois pastores.';
