// Disposable PostgreSQL WASM only. No fixture is sent to the live Supabase project.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {validateMethods,validateProducts,isMinistryPastor} from '../src/lib/ministry-event-policy.ts';
test('catálogo e recebimentos: somente valores válidos e pastores explícitos',()=>{
  assert.deepEqual(validateMethods(['pix','card','pix']),['pix','card']);
  for(const value of [[],['mercado_pago'],['boleto'],null])assert.throws(()=>validateMethods(value));
  assert.equal(validateProducts([{id:'pastel',name:'Pastel',price_cents:2000}])[0].price_cents,2000);
  for(const value of [[],[{id:'x',name:'XX',price_cents:-1}],[{id:'x',name:'XX',price_cents:1.5}]])assert.throws(()=>validateProducts(value));
  assert.equal(isMinistryPastor('4233f7fd-d931-445d-afab-d775d221a68e'),true);
  assert.equal(isMinistryPastor('00000000-0000-4000-8000-000000000001'),false);
});
test('publicação RLS, preços do servidor, reserva, recebimentos idempotentes e estorno',{skip:!process.env.PGLITE_TEST_MODULE},async()=>{
  const {PGlite}=await import(process.env.PGLITE_TEST_MODULE);const db=new PGlite();
  const load=async file=>fs.readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8');
  const leader='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003',admin='00000000-0000-4000-8000-000000000001',pastor='34944370-8853-4c1b-866b-8c80b4e59829',lisi='4233f7fd-d931-445d-afab-d775d221a68e',event='10000000-0000-4000-8000-000000000001';
  const as=async(id)=>db.exec(`reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`);
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table member_profiles(user_id uuid primary key,is_admin boolean,approval_status text);create table ministry_leaders(member_id uuid,ministry_key text);grant select on member_profiles,ministry_leaders to authenticated;create function public.is_admin() returns boolean language sql stable as $$select exists(select 1 from public.member_profiles where user_id=auth.uid() and is_admin)$$;
      insert into member_profiles values('${admin}',true,'approved'),('${leader}',false,'approved'),('${other}',false,'approved'),('${pastor}',true,'approved'),('${lisi}',true,'approved');insert into ministry_leaders values('${leader}','cozinha'),('${other}','louvor');`);
    await db.exec((await load('20260804203944_criar_eventos_e_inscricoes.sql')).split('insert into public.events')[0]);
    await db.exec((await load('20260812145259_integrar_checkout_mercado_pago.sql')).split('create table public.mercado_pago_webhook_events')[0]);
    await db.exec(`alter table event_registrations add column email text,add column order_total_cents bigint default 0;alter table mercado_pago_payments drop constraint mercado_pago_payments_registration_id_key;alter table mercado_pago_payments add column payment_provider text default 'mercado_pago',add column created_by uuid,add column whatsapp_notification_status text,add column provider_order_id text;alter table mercado_pago_payments enable row level security;grant all on mercado_pago_payments to service_role;`);
    await db.exec(await load('20260928194000_ministry_events_cashbox_dreams.sql'));
    await db.exec(await load('20260928202927_ministry_public_events_checkout.sql'));
    await db.exec(await load('20260928205814_ministry_payment_reservation_guard.sql'));
    await as(leader);await db.exec(`insert into ministry_fund_events(id,ministry_key,title,event_date)values('${event}','cozinha','Pastéis local','2099-10-01')`);
    const product=JSON.stringify([{id:'simples',name:'Pastel simples',price_cents:2000},{id:'duplo',name:'Pastel duplo',price_cents:3000}]);
    const publish=await db.query(`select publish_ministry_event($1,'cozinha','Pastéis local','Somente fixture local','2099-10-01','19:00','Casa',$2,$3::jsonb,array['pix','card','cash'],10,true) as slug`,[event,'https://fjwkfpwraipxmcjlwssv.supabase.co/storage/v1/object/public/casa-event-images/ministerios/cozinha/local.webp',product]);
    const slug=publish.rows[0].slug;
    await assert.rejects(db.exec(`update events set ministry_key='louvor' where id='${event}'`));
    await assert.rejects(db.exec(`update events set ministry_products='[]' where id='${event}'`));
    for(const id of [admin,other]){await as(id);assert.equal((await db.query('select * from ministry_fund_events')).rows.length,0);assert.equal((await db.query(`update events set title='Invasão' where id='${event}' returning id`)).rows.length,0);}
    for(const id of [pastor,lisi]){await as(id);assert.equal((await db.query('select * from ministry_fund_events')).rows.length,1);}
    await db.exec('reset role;set role anon');assert.equal((await db.query('select * from events')).rows.length,1);await assert.rejects(db.query('select * from ministry_event_receipts'));await assert.rejects(db.query(`select create_ministry_order(gen_random_uuid(),'x','Nome','a@b.com','54999999999','[]','pix')`));
    await db.exec('reset role');
    const order=async(id,items,method='pix')=>(await db.query(`select create_ministry_order($1,$2,'Comprador local','teste@example.invalid','54999999999',$3::jsonb,$4) as result`,[id,slug,JSON.stringify(items),method])).rows[0].result;
    const id='20000000-0000-4000-8000-000000000001';
    const first=await order(id,[{id:'simples',quantity:2,price_cents:1},{id:'duplo',quantity:3}]);assert.equal(first.amountCents,13000);assert.ok(first.paymentId);
    assert.equal((await order(id,[{id:'simples',quantity:1}])).paymentId,first.paymentId);
    assert.equal((await db.query('select * from ministry_event_receipts')).rows.length,0);
    await assert.rejects(db.query('select begin_ministry_payment($1,$2)',[first.paymentId,'card']));
    await db.query('select begin_ministry_payment($1,$2)',[first.paymentId,'pix']);
    await db.exec(`update mercado_pago_payments set created_at=now()-interval '25 hours' where id='${first.paymentId}'`);
    assert.equal((await db.query('select expire_unstarted_ministry_orders() as expired')).rows[0].expired,0);
    await assert.rejects(order('20000000-0000-4000-8000-000000000002',[{id:'simples',quantity:6}]));
    await assert.rejects(order('20000000-0000-4000-8000-000000000002',[{id:'simples',quantity:1}],'boleto'));
    await db.exec(`update mercado_pago_payments set status='approved' where id='${first.paymentId}';update mercado_pago_payments set status='approved' where id='${first.paymentId}'`);
    let receipt=(await db.query('select * from ministry_event_receipts')).rows;assert.equal(receipt.length,1);assert.equal(Number(receipt[0].amount_cents),13000);assert.equal(receipt[0].quantity,5);
    const cashid='20000000-0000-4000-8000-000000000002';await order(cashid,[{id:'simples',quantity:2}],'cash');assert.equal((await db.query('select * from ministry_event_receipts')).rows.length,1);
    await assert.rejects(db.query(`select confirm_ministry_cash($1,$2)`,[cashid,other]));await assert.rejects(db.query(`select confirm_ministry_cash($1,$2)`,[cashid,admin]));
    await db.query(`select confirm_ministry_cash($1,$2)`,[cashid,leader]);await db.query(`select confirm_ministry_cash($1,$2)`,[cashid,leader]);
    assert.equal((await db.query(`select * from mercado_pago_payments where registration_id='${cashid}'`)).rows.length,1);
    await as(leader);let totals=(await db.query(`select * from ministry_fund_totals() where scope='ministry'`)).rows[0];assert.equal(Number(totals.sales_cents),17000);assert.equal(Number(totals.units),7);
    await as(other);assert.equal((await db.query('select * from ministry_event_receipts')).rows.length,0);assert.equal((await db.query('select * from ministry_fund_totals()')).rows.length,0);
    await db.exec(`reset role;update mercado_pago_payments set status='refunded' where id='${first.paymentId}'`);
    await as(leader);totals=(await db.query(`select * from ministry_fund_totals() where scope='ministry'`)).rows[0];assert.equal(Number(totals.sales_cents),4000);assert.equal(Number(totals.units),2);
    await db.exec('reset role');const abandoned=await order('20000000-0000-4000-8000-000000000003',[{id:'simples',quantity:1}]);await db.exec(`update mercado_pago_payments set created_at=now()-interval '25 hours' where id='${abandoned.paymentId}'`);assert.equal((await db.query('select expire_unstarted_ministry_orders() as expired')).rows[0].expired,1);await assert.rejects(db.query('select begin_ministry_payment($1,$2)',[abandoned.paymentId,'pix']));
    await as(leader);await db.exec(`update ministry_fund_events set status='archived' where id='${event}'`);await db.exec('reset role;set role anon');assert.equal((await db.query('select * from events')).rows.length,0);
  }finally{await db.close();}
});
