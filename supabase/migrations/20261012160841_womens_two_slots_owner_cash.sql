-- Serialize the final public reservations. Manual cash entries use a separate,
-- service-only transaction, authenticated as Pastor Rilldy by the server action.
create function public.guard_womens_encounter_capacity() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare e public.events%rowtype; reserved integer;
begin
  select * into e from public.events where id = new.event_id for update;
  if e.slug <> 'encontro-com-deus-mulheres-2026' then return new; end if;
  if current_setting('casa.womens_cash_actor', true) = '34944370-8853-4c1b-866b-8c80b4e59829' then
    return new;
  end if;
  if not e.registration_enabled or e.registration_status <> 'open'
     or e.archived_at is not null or e.status = 'cancelled'
     or (e.registration_deadline is not null and e.registration_deadline < now()) then
    raise exception 'REGISTRATION_CLOSED';
  end if;
  select count(*) into reserved from public.event_registrations
    where event_id = e.id and archived_at is null;
  if e.capacity is not null and reserved >= e.capacity then
    raise exception 'CAPACITY_EXCEEDED';
  end if;
  if e.capacity is not null and reserved + 1 >= e.capacity then
    update public.events set registration_status = 'closed', updated_at = now() where id = e.id;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_womens_encounter_capacity() from public, anon, authenticated;
create trigger guard_womens_encounter_capacity before insert on public.event_registrations
for each row execute function public.guard_womens_encounter_capacity();

create function public.create_womens_cash_registration(
  p_actor uuid, p_full_name text, p_phone text, p_phone_normalized text, p_email text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare e public.events%rowtype; registration_id uuid; payment_id uuid;
begin
  if p_actor is distinct from '34944370-8853-4c1b-866b-8c80b4e59829'::uuid
    or not exists(select 1 from public.member_profiles where user_id=p_actor
      and approval_status='approved' and is_admin and can_sell_manual_tickets) then
    raise exception 'FORBIDDEN';
  end if;
  if char_length(trim(p_full_name)) not between 3 and 160
     or p_phone_normalized !~ '^[0-9]{10,13}$' then raise exception 'INVALID_INPUT'; end if;
  select * into strict e from public.events where slug='encontro-com-deus-mulheres-2026' for update;
  if e.archived_at is not null or e.status='cancelled' or e.registration_fee_cents<=0 then
    raise exception 'EVENT_UNAVAILABLE';
  end if;
  perform set_config('casa.womens_cash_actor',p_actor::text,true);
  insert into public.event_registrations(event_id,full_name,email,phone,phone_normalized,
    attendance_duration,notes,status,consent,order_total_cents)
  values(e.id,trim(p_full_name),nullif(trim(p_email),''),p_phone,p_phone_normalized,
    'not_attending','Inscrição manual · pagamento em dinheiro','confirmed',true,e.registration_fee_cents)
  returning id into registration_id;
  perform set_config('casa.womens_cash_actor','',true);
  -- Manual entries do not consume either of the two public seats or reopen sales.
  update public.events set capacity=case when capacity is null then null else capacity+1 end,
    updated_at=now() where id=e.id;
  insert into public.mercado_pago_payments(purpose,payment_provider,event_id,registration_id,
    payer_name,payer_email,payer_phone,amount_cents,status,status_detail,payment_method_id,
    payment_type_id,net_received_cents,approved_at,created_by,whatsapp_notification_status)
  values('event','manual',e.id,registration_id,trim(p_full_name),nullif(trim(p_email),''),p_phone,
    e.registration_fee_cents,'approved','manual_cash','cash','cash',e.registration_fee_cents,
    now(),p_actor,'skipped') returning id into payment_id;
  insert into public.finance_income_entries(transaction_date,description,amount_cents,fingerprint,
    source,created_by,mercado_pago_payment_id)
  values((now() at time zone 'America/Sao_Paulo')::date,'Inscrição em dinheiro · '||e.title,
    e.registration_fee_cents,'manual_event_ticket|'||payment_id::text,'manual',p_actor,payment_id);
  return registration_id;
end;
$$;
revoke all on function public.create_womens_cash_registration(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.create_womens_cash_registration(uuid,text,text,text,text) to service_role;

-- Exactly two new reservations, preserving all existing records and payments.
do $$ declare target uuid; begin
  select id into strict target from public.events where slug='encontro-com-deus-mulheres-2026' for update;
  update public.events set capacity=(select count(*)+2 from public.event_registrations
    where event_id=target and archived_at is null),registration_enabled=true,
    registration_status='open',registration_deadline=null,updated_at=now() where id=target;
end; $$;
