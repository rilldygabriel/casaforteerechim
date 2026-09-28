-- Serialize abandoned-reservation cleanup with the start of a real provider request.
create function public.begin_ministry_payment(p_id uuid,p_method text) returns void
language plpgsql security invoker set search_path='' as $$
declare p public.mercado_pago_payments; e public.events; r public.event_registrations;
begin
 select * into p from public.mercado_pago_payments where id=p_id;
 select * into e from public.events where id=p.event_id for update;
 select * into p from public.mercado_pago_payments where id=p_id for update;
 select * into r from public.event_registrations where id=p.registration_id;
 if e.ministry_key is null or p.payment_provider<>'pagbank' or p.status not in ('created','in_process') or r.status<>'awaiting_payment' or r.ministry_method<>p_method or not(p_method=any(e.ministry_payment_methods)) or p.amount_cents<>r.order_total_cents then raise exception 'INVALID_RESERVATION'; end if;
 update public.mercado_pago_payments set status='in_process',updated_at=now() where id=p_id;
end;$$;
revoke all on function public.begin_ministry_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.begin_ministry_payment(uuid,text) to service_role;

create function public.expire_unstarted_ministry_orders() returns integer
language plpgsql security invoker set search_path='' as $$
declare e record; p record; v_count integer:=0;
begin
 for e in select distinct event_id from public.mercado_pago_payments where payment_provider='pagbank' and status='created' and provider_order_id is null and created_at<now()-interval '24 hours' loop
  perform 1 from public.events where id=e.event_id and ministry_key is not null for update;
  if not found then continue; end if;
  for p in update public.mercado_pago_payments set status='expired',status_detail='checkout_not_started_24h',updated_at=now()
   where event_id=e.event_id and payment_provider='pagbank' and status='created' and provider_order_id is null and created_at<now()-interval '24 hours' returning registration_id loop
    update public.event_registrations set status='cancelled',updated_at=now() where id=p.registration_id and status='awaiting_payment' and ministry_method in ('pix','card');
    v_count:=v_count+1;
  end loop;
 end loop;
 return v_count;
end;$$;
revoke all on function public.expire_unstarted_ministry_orders() from public,anon,authenticated;
grant execute on function public.expire_unstarted_ministry_orders() to service_role;
