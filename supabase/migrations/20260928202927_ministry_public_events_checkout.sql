-- Only the two verified pastors and the approved leaders of each ministry.
create or replace function public.can_manage_ministry_fund(p_key text) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.member_profiles p where p.user_id=(select auth.uid()) and p.approval_status='approved')
 and ((select auth.uid()) in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid,'4233f7fd-d931-445d-afab-d775d221a68e'::uuid)
 or exists(select 1 from public.ministry_leaders l where l.member_id=(select auth.uid()) and l.ministry_key=p_key));
$$;

alter table public.events add column ministry_key text,
 add column ministry_fund_id uuid unique,
 add column ministry_products jsonb not null default '[]',
 add column ministry_payment_methods text[] not null default array['pix','card'];
alter table public.events add constraint events_ministry_fund_fk foreign key(ministry_fund_id,ministry_key) references public.ministry_fund_events(id,ministry_key),
 add constraint events_ministry_pair check ((ministry_fund_id is null and ministry_key is null) or (ministry_fund_id is not null and ministry_key is not null)),
 add constraint events_ministry_methods check (cardinality(ministry_payment_methods) between 1 and 3 and ministry_payment_methods <@ array['pix','card','cash']),
 add constraint events_ministry_products_array check(jsonb_typeof(ministry_products)='array' and jsonb_array_length(ministry_products)<=10);
create index events_ministry_idx on public.events(ministry_key);
grant insert,update on public.events to authenticated;
create policy ministry_event_read on public.events for select to authenticated using(ministry_key is not null and public.can_manage_ministry_fund(ministry_key));
create policy ministry_event_insert on public.events for insert to authenticated with check(ministry_key is not null and public.can_manage_ministry_fund(ministry_key));
create policy ministry_event_update on public.events for update to authenticated using(ministry_key is not null and public.can_manage_ministry_fund(ministry_key)) with check(ministry_key is not null and public.can_manage_ministry_fund(ministry_key));

create function public.guard_ministry_public_event() returns trigger language plpgsql security invoker set search_path='' as $$
declare p jsonb;
begin
 if tg_op='UPDATE' and (new.ministry_key is distinct from old.ministry_key or new.ministry_fund_id is distinct from old.ministry_fund_id or (old.ministry_key is not null and (new.id<>old.id or new.slug<>old.slug))) then raise exception 'OWNERSHIP_IMMUTABLE'; end if;
 if new.ministry_key is null then return new; end if;
 if new.id<>new.ministry_fund_id or jsonb_array_length(new.ministry_products) not between 1 and 10 then raise exception 'INVALID_PRODUCTS'; end if;
 for p in select value from jsonb_array_elements(new.ministry_products) loop
  if coalesce(p->>'id','') !~ '^[a-zA-Z0-9_-]{1,64}$' or length(trim(coalesce(p->>'name',''))) not between 2 and 100 or coalesce(p->>'price_cents','') !~ '^[0-9]+$' or (p->>'price_cents')::bigint not between 1 and 9999999 then raise exception 'INVALID_PRODUCTS'; end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(new.ministry_products))<>jsonb_array_length(new.ministry_products) then raise exception 'INVALID_PRODUCTS'; end if;
 if new.is_public and (new.image_url is null or new.image_url not like 'https://fjwkfpwraipxmcjlwssv.supabase.co/storage/v1/object/public/casa-event-images/ministerios/'||new.ministry_key||'/%') then raise exception 'IMAGE_REQUIRED'; end if;
 return new;
end;$$;
revoke all on function public.guard_ministry_public_event() from public,anon,authenticated;
create trigger ministry_public_guard before insert or update on public.events for each row execute function public.guard_ministry_public_event();

create function public.sync_ministry_event_details() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.events set title=new.title,description=new.description,start_date=new.event_date,
 is_public=case when new.status='archived' then false else is_public end,
 registration_status=case when new.status in ('archived','completed') then 'closed' else registration_status end
 where ministry_fund_id=new.id;
 return new;
end;$$;
revoke all on function public.sync_ministry_event_details() from public,anon,authenticated;
create trigger ministry_details_sync after update on public.ministry_fund_events for each row execute function public.sync_ministry_event_details();

-- Called as the signed-in leader; publication and internal event update are atomic.
create function public.publish_ministry_event(p_id uuid,p_key text,p_title text,p_description text,p_date date,p_time time,p_location text,p_image text,p_products jsonb,p_methods text[],p_capacity integer,p_publish boolean) returns text
language plpgsql security invoker set search_path='' as $$
declare v_slug text; p jsonb; v_min bigint;
begin
 if not public.can_manage_ministry_fund(p_key) then raise exception 'NOT_ALLOWED'; end if;
 perform 1 from public.ministry_fund_events where id=p_id and ministry_key=p_key for update;
 if not found then raise exception 'EVENT_NOT_FOUND'; end if;
 if jsonb_typeof(p_products)<>'array' or jsonb_array_length(p_products) not between 1 and 10 then raise exception 'INVALID_PRODUCTS'; end if;
 for p in select value from jsonb_array_elements(p_products) loop
  if coalesce(p->>'id','') !~ '^[a-zA-Z0-9_-]{1,64}$' or length(trim(coalesce(p->>'name',''))) not between 2 and 100 or coalesce(p->>'price_cents','') !~ '^[0-9]+$' or (p->>'price_cents')::bigint not between 1 and 9999999 then raise exception 'INVALID_PRODUCTS'; end if;
 end loop;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_products))<>jsonb_array_length(p_products) then raise exception 'INVALID_PRODUCTS'; end if;
 if p_publish and (p_image is null or p_date<(now() at time zone 'America/Sao_Paulo')::date) then raise exception 'IMAGE_AND_FUTURE_DATE_REQUIRED'; end if;
 select min((value->>'price_cents')::bigint) into v_min from jsonb_array_elements(p_products);
 v_slug:='ministerio-'||p_key||'-'||p_id::text;
 insert into public.events(id,ministry_fund_id,ministry_key,title,slug,description,category,start_date,start_time,location,image_url,registration_enabled,registration_status,registration_fee_cents,is_public,is_featured,capacity,ministry_products,ministry_payment_methods)
 values(p_id,p_id,p_key,p_title,v_slug,p_description,'Eventos dos ministérios',p_date,p_time,p_location,p_image,true,case when p_publish then 'open' else 'closed' end,v_min,p_publish,p_publish,p_capacity,p_products,p_methods)
 on conflict(id) do update set title=excluded.title,description=excluded.description,start_date=excluded.start_date,start_time=excluded.start_time,location=excluded.location,image_url=excluded.image_url,registration_status=excluded.registration_status,registration_fee_cents=excluded.registration_fee_cents,is_public=excluded.is_public,is_featured=excluded.is_featured,capacity=excluded.capacity,ministry_products=excluded.ministry_products,ministry_payment_methods=excluded.ministry_payment_methods,updated_at=now()
 where events.ministry_fund_id=p_id and events.ministry_key=p_key;
 if not found then raise exception 'EVENT_NOT_FOUND'; end if;
 update public.ministry_fund_events set title=p_title,description=p_description,event_date=p_date where id=p_id and ministry_key=p_key;
 return v_slug;
end;
$$;
revoke all on function public.publish_ministry_event(uuid,text,text,text,date,time,text,text,jsonb,text[],integer,boolean) from public,anon;
grant execute on function public.publish_ministry_event(uuid,text,text,text,date,time,text,text,jsonb,text[],integer,boolean) to authenticated;

alter table public.event_registrations add column ministry_items jsonb not null default '[]', add column ministry_quantity integer not null default 0, add column ministry_method text;
alter table public.event_registrations add constraint ministry_registration_quantity check(ministry_quantity between 0 and 1000), add constraint ministry_registration_method check(ministry_method is null or ministry_method in ('pix','card','cash'));
-- Keep legacy uniqueness; product orders may be purchased again under a new request ID.
alter table public.event_registrations drop constraint event_registrations_event_id_phone_normalized_key;
create unique index event_registrations_legacy_phone_unique on public.event_registrations(event_id,phone_normalized) where ministry_method is null;

create table public.ministry_event_receipts(
 registration_id uuid primary key references public.event_registrations(id),
 event_id uuid not null, ministry_key text not null,
 amount_cents bigint not null default 0, quantity integer not null default 0,
 received_on date not null, updated_at timestamptz not null default now(),
 foreign key(event_id,ministry_key) references public.ministry_fund_events(id,ministry_key)
);
create index ministry_receipts_event_idx on public.ministry_event_receipts(event_id,ministry_key);
alter table public.ministry_event_receipts enable row level security;
revoke all on public.ministry_event_receipts from anon,authenticated;
grant select on public.ministry_event_receipts to authenticated;
grant all on public.ministry_event_receipts to service_role;
create policy ministry_receipts_read on public.ministry_event_receipts for select to authenticated using(public.can_manage_ministry_fund(ministry_key));
-- Payment writes are service-only. No SECURITY DEFINER or client-editable paid flags.
create function public.sync_ministry_receipt() returns trigger language plpgsql security invoker set search_path='' as $$
declare r public.event_registrations; e public.events; v_amount bigint;
begin
 if new.registration_id is null then return new; end if;
 select * into r from public.event_registrations where id=new.registration_id for update;
 if r.ministry_method is null then return new; end if;
 select * into e from public.events where id=r.event_id;
 if e.ministry_fund_id is null then return new; end if;
 select coalesce(sum(amount_cents),0) into v_amount from public.mercado_pago_payments where registration_id=r.id and status='approved';
 if v_amount=0 then update public.ministry_event_receipts set amount_cents=0,quantity=0,updated_at=now() where registration_id=r.id; return new; end if;
 insert into public.ministry_event_receipts(registration_id,event_id,ministry_key,amount_cents,quantity,received_on)
 values(r.id,e.ministry_fund_id,e.ministry_key,v_amount,case when v_amount>0 then r.ministry_quantity else 0 end,(now() at time zone 'America/Sao_Paulo')::date)
 on conflict(registration_id) do update set amount_cents=excluded.amount_cents,quantity=excluded.quantity,updated_at=now();
 return new;
end;
$$;
revoke all on function public.sync_ministry_receipt() from public,anon,authenticated;
create trigger ministry_receipt_sync after insert or update of status,amount_cents on public.mercado_pago_payments for each row execute function public.sync_ministry_receipt();

create function public.create_ministry_order(p_id uuid,p_slug text,p_name text,p_email text,p_phone text,p_items jsonb,p_method text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.events; r public.event_registrations; i jsonb; product jsonb; items jsonb:='[]'; qty integer:=0; n integer; total bigint:=0; payment_id uuid;
begin
 select * into e from public.events where slug=p_slug for update;
 if e.id is null or e.ministry_fund_id is null then raise exception 'EVENT_NOT_FOUND'; end if;
 select * into r from public.event_registrations where id=p_id;
 if found then
  if r.event_id<>e.id or r.phone_normalized<>p_phone then raise exception 'INVALID_REQUEST'; end if;
  select id into payment_id from public.mercado_pago_payments where registration_id=r.id order by created_at desc limit 1;
  return jsonb_build_object('registrationId',r.id,'paymentId',payment_id,'amountCents',r.order_total_cents,'method',r.ministry_method,'status',r.status);
 end if;
 if not e.is_public or e.archived_at is not null or e.status='cancelled' or not e.registration_enabled or e.registration_status<>'open' or e.start_date<(now() at time zone 'America/Sao_Paulo')::date or (e.registration_deadline is not null and e.registration_deadline<now()) or exists(select 1 from public.ministry_fund_events where id=e.ministry_fund_id and status<>'planned') then raise exception 'REGISTRATION_CLOSED'; end if;
 if p_method is null or not(p_method=any(e.ministry_payment_methods)) then raise exception 'METHOD_NOT_ALLOWED'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 10 then raise exception 'INVALID_ITEMS'; end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'INVALID_ITEMS'; end if;
 for i in select value from jsonb_array_elements(p_items) loop
  if coalesce(i->>'quantity','') !~ '^[0-9]+$' then raise exception 'INVALID_ITEMS'; end if;
  n:=(i->>'quantity')::integer;
  if n not between 1 and 1000 then raise exception 'INVALID_ITEMS'; end if;
  select value into product from jsonb_array_elements(e.ministry_products) where value->>'id'=i->>'id';
  if product is null then raise exception 'INVALID_ITEMS'; end if;
  total:=total+(product->>'price_cents')::bigint*n; qty:=qty+n;
  items:=items||jsonb_build_array(product||jsonb_build_object('quantity',n));
 end loop;
 if qty>1000 or total>999999999 then raise exception 'INVALID_ITEMS'; end if;
 if e.capacity is not null and (select coalesce(sum(ministry_quantity),0) from public.event_registrations where event_id=e.id and archived_at is null and status not in ('cancelled','rejected','withdrew'))+qty>e.capacity then raise exception 'CAPACITY_EXCEEDED'; end if;
 insert into public.event_registrations(id,event_id,full_name,email,phone,phone_normalized,attendance_duration,notes,consent,status,order_total_cents,ministry_items,ministry_quantity,ministry_method)
 values(p_id,e.id,p_name,p_email,p_phone,p_phone,'not_attending','Pedido do ministério',true,'awaiting_payment',total,items,qty,p_method);
 if p_method<>'cash' then
  payment_id:=gen_random_uuid();
  insert into public.mercado_pago_payments(id,purpose,payment_provider,event_id,registration_id,payer_name,payer_email,payer_phone,amount_cents)
  values(payment_id,'event','pagbank',e.id,p_id,p_name,p_email,p_phone,total);
 end if;
 return jsonb_build_object('registrationId',p_id,'paymentId',payment_id,'amountCents',total,'method',p_method,'status','awaiting_payment');
end;
$$;
revoke all on function public.create_ministry_order(uuid,text,text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.create_ministry_order(uuid,text,text,text,text,jsonb,text) to service_role;

create function public.confirm_ministry_cash(p_registration uuid,p_actor uuid,p_cancel boolean default false) returns void
language plpgsql security invoker set search_path='' as $$
declare r public.event_registrations; e public.events;
begin
 select * into r from public.event_registrations where id=p_registration for update;
 select * into e from public.events where id=r.event_id;
 if e.ministry_fund_id is null or r.ministry_method is distinct from 'cash' then raise exception 'INVALID_ORDER'; end if;
 if not exists(select 1 from public.member_profiles where user_id=p_actor and approval_status='approved') or not (p_actor in ('34944370-8853-4c1b-866b-8c80b4e59829'::uuid,'4233f7fd-d931-445d-afab-d775d221a68e'::uuid) or exists(select 1 from public.ministry_leaders where member_id=p_actor and ministry_key=e.ministry_key)) then raise exception 'NOT_ALLOWED'; end if;
 if r.status='confirmed' then return; end if;
 if r.status<>'awaiting_payment' then raise exception 'INVALID_STATUS'; end if;
 if p_cancel then update public.event_registrations set status='cancelled',updated_at=now() where id=r.id; return; end if;
 insert into public.mercado_pago_payments(purpose,payment_provider,event_id,registration_id,payer_name,payer_email,payer_phone,amount_cents,status,status_detail,payment_method_id,payment_type_id,net_received_cents,approved_at,created_by,whatsapp_notification_status)
 values('event','manual',e.id,r.id,r.full_name,r.email,r.phone,r.order_total_cents,'approved','ministry_cash','cash','cash',r.order_total_cents,now(),p_actor,'skipped');
 update public.event_registrations set status='confirmed',updated_at=now() where id=r.id;
end;
$$;
revoke all on function public.confirm_ministry_cash(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.confirm_ministry_cash(uuid,uuid,boolean) to service_role;

create or replace function public.ministry_fund_totals() returns table (
 ministry_key text,scope text,scope_id uuid,sales_cents bigint,donations_cents bigint,expenses_cents bigint,other_in_cents bigint,withdrawals_cents bigint,in_kind_cents bigint,units bigint,balance_cents bigint
) language sql stable security invoker set search_path='' as $$
 with entries as (
  select e.ministry_key,e.event_id,e.dream_id,e.kind,e.amount_cents,e.quantity from public.ministry_fund_entries e where e.voided_at is null
  union all select r.ministry_key,r.event_id,null::uuid,'sale',r.amount_cents,r.quantity from public.ministry_event_receipts r where r.amount_cents>0
 ) select e.ministry_key,case when grouping(e.event_id)=0 then 'event' when grouping(e.dream_id)=0 then 'dream' else 'ministry' end,coalesce(e.event_id,e.dream_id),
 coalesce(sum(e.amount_cents) filter(where e.kind='sale'),0)::bigint,coalesce(sum(e.amount_cents) filter(where e.kind='cash_donation'),0)::bigint,coalesce(sum(e.amount_cents) filter(where e.kind='expense'),0)::bigint,coalesce(sum(e.amount_cents) filter(where e.kind='opening_balance'),0)::bigint,coalesce(sum(e.amount_cents) filter(where e.kind='withdrawal'),0)::bigint,coalesce(sum(e.amount_cents) filter(where e.kind='in_kind'),0)::bigint,coalesce(sum(e.quantity) filter(where e.kind='sale'),0)::bigint,
 coalesce(sum(case when e.kind in ('sale','cash_donation','opening_balance') then e.amount_cents when e.kind in ('expense','withdrawal') then -e.amount_cents else 0 end),0)::bigint
 from entries e group by grouping sets((e.ministry_key),(e.ministry_key,e.event_id),(e.ministry_key,e.dream_id))
 having (grouping(e.event_id)=1 or e.event_id is not null) and (grouping(e.dream_id)=1 or e.dream_id is not null);
$$;
