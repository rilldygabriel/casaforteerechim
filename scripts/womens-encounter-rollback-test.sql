begin;
set local statement_timeout='10s';
set local role service_role;
do $test$
declare eid uuid; before_count integer; rid uuid; closed text; denied boolean;
begin
select id into eid from public.events where slug='encontro-com-deus-mulheres-2026' for update;
select count(*) into before_count from public.event_registrations where event_id=eid and archived_at is null;
update public.events set capacity=before_count+2,registration_status='open' where id=eid;
insert into public.event_registrations(event_id,full_name,phone,phone_normalized,attendance_duration,status,consent)
values(eid,'TESTE ROLLBACK VAGA 1','5500000000001','5500000000001','not_attending','awaiting_payment',true);
select registration_status into closed from public.events where id=eid;
if closed <> 'open' then raise exception 'first seat closed too early'; end if;
insert into public.event_registrations(event_id,full_name,phone,phone_normalized,attendance_duration,status,consent)
values(eid,'TESTE ROLLBACK VAGA 2','5500000000002','5500000000002','not_attending','awaiting_payment',true);
select registration_status into closed from public.events where id=eid;
if closed <> 'closed' then raise exception 'second seat did not close'; end if;
denied:=false;
begin
insert into public.event_registrations(event_id,full_name,phone,phone_normalized,attendance_duration,status,consent)
values(eid,'TESTE ROLLBACK VAGA 3','5500000000003','5500000000003','not_attending','awaiting_payment',true);
exception when others then if sqlerrm='REGISTRATION_CLOSED' then denied:=true; else raise; end if; end;
if not denied then raise exception 'third seat allowed'; end if;
denied:=false;
begin
perform public.create_womens_cash_registration('4233f7fd-d931-445d-afab-d775d221a68e','TESTE NAO AUTORIZADO','5500000000004','5500000000004',null);
exception when others then if sqlerrm='FORBIDDEN' then denied:=true; else raise; end if; end;
if not denied then raise exception 'other admin allowed'; end if;
rid:=public.create_womens_cash_registration('34944370-8853-4c1b-866b-8c80b4e59829','TESTE ROLLBACK DINHEIRO','5500000000005','5500000000005',null);
if not exists(select 1 from public.event_registrations where id=rid and status='confirmed') then raise exception 'cash registration missing'; end if;
if not exists(select 1 from public.mercado_pago_payments p join public.finance_income_entries f on f.mercado_pago_payment_id=p.id where p.registration_id=rid and p.status='approved' and p.payment_method_id='cash' and p.amount_cents=25000 and f.amount_cents=25000) then raise exception 'cash ledger mismatch'; end if;
if not exists(select 1 from public.events where id=eid and capacity=before_count+3 and registration_status='closed') then raise exception 'cash changed public slots'; end if;
if has_function_privilege('authenticated','public.create_womens_cash_registration(uuid,text,text,text,text)','EXECUTE') then raise exception 'RPC exposed'; end if;
end $test$;
select 'PASS: two seats, automatic closure, owner-only atomic cash, closed remains closed' as test_result;
rollback;
