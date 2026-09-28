// Runs only against disposable local PGlite. Never inserts fixtures in Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const modulePath=process.env.PGLITE_TEST_MODULE;
test('RLS, livro caixa imutável, vínculo e somas de eventos/sonhos', {skip:!modulePath}, async()=>{
  const {PGlite}=await import(modulePath);
  const db=new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
      create table member_profiles(user_id uuid primary key,is_admin boolean,approval_status text);
      create table ministry_leaders(member_id uuid,ministry_key text);
      grant select on member_profiles,ministry_leaders to authenticated;
      create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.member_profiles where user_id=auth.uid() and is_admin)$$;
      insert into member_profiles values ('00000000-0000-4000-8000-000000000001',true,'approved'),('00000000-0000-4000-8000-000000000002',false,'approved'),('00000000-0000-4000-8000-000000000003',false,'approved'),('00000000-0000-4000-8000-000000000004',false,'approved'),('00000000-0000-4000-8000-000000000005',false,'pending');
      insert into ministry_leaders values ('00000000-0000-4000-8000-000000000002','cozinha'),('00000000-0000-4000-8000-000000000003','louvor'),('00000000-0000-4000-8000-000000000005','cozinha');`);
    await db.exec(await fs.readFile(new URL('../supabase/migrations/20260928194000_ministry_events_cashbox_dreams.sql',import.meta.url),'utf8'));
    async function as(n){await db.exec(`reset role;select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-${String(n).padStart(12,'0')}',false);set role authenticated;`);}
    const event='10000000-0000-4000-8000-000000000001',dream='20000000-0000-4000-8000-000000000001',sale='30000000-0000-4000-8000-000000000001';
    await as(2);
    await db.exec(`insert into ministry_fund_events(id,ministry_key,title,event_date)values('${event}','cozinha','Pastéis de teste','2026-09-28');insert into ministry_fund_dreams(id,ministry_key,title,target_cents)values('${dream}','cozinha','Meta de teste',10000);`);
    await db.exec(`insert into ministry_fund_entries(id,ministry_key,event_id,dream_id,kind,description,amount_cents,quantity,occurred_on)values('${sale}','cozinha','${event}','${dream}','sale','Pastéis',12000,30,'2026-09-28');insert into ministry_fund_entries(ministry_key,event_id,dream_id,kind,description,amount_cents,occurred_on)values('cozinha','${event}','${dream}','expense','Ingredientes',3000,'2026-09-28'),('cozinha','${event}','${dream}','cash_donation','Doação',1000,'2026-09-28'),('cozinha','${event}','${dream}','in_kind','Queijo doado',5000,'2026-09-28');`);
    let totals=await db.query('select * from ministry_fund_totals()');assert.equal(totals.rows.length,3);
    for(const t of totals.rows){assert.equal(Number(t.balance_cents),10000);assert.equal(Number(t.units),30);assert.equal(Number(t.in_kind_cents),5000);}
    await assert.rejects(db.exec(`update ministry_fund_entries set amount_cents=1 where id='${sale}'`));
    await assert.rejects(db.exec(`delete from ministry_fund_entries where id='${sale}'`));
    await assert.rejects(db.exec(`update ministry_fund_events set ministry_key='louvor' where id='${event}'`));
    await as(3);assert.equal((await db.query('select * from ministry_fund_events')).rows.length,0);assert.equal((await db.query('select * from ministry_fund_totals()')).rows.length,0);
    await assert.rejects(db.exec(`insert into ministry_fund_events(ministry_key,title,event_date)values('cozinha','Invasão','2026-09-28')`));
    await assert.rejects(db.exec(`insert into ministry_fund_entries(ministry_key,event_id,kind,description,amount_cents,quantity,occurred_on)values('louvor','${event}','sale','Vínculo errado',100,1,'2026-09-28')`));
    for(const n of [4,5]){await as(n);assert.equal((await db.query('select * from ministry_fund_entries')).rows.length,0);await assert.rejects(db.exec(`insert into ministry_fund_dreams(ministry_key,title,target_cents)values('cozinha','Sem acesso',1000)`));}
    await as(1);assert.equal((await db.query('select * from ministry_fund_entries')).rows.length,4);
    await db.exec(`update ministry_fund_entries set voided_at=now(),void_reason='Duplicado' where id='${sale}'`);
    totals=await db.query('select * from ministry_fund_totals()');for(const t of totals.rows){assert.equal(Number(t.balance_cents),-2000);assert.equal(Number(t.units),0);}
    await assert.rejects(db.exec(`update ministry_fund_entries set voided_at=null,void_reason=null where id='${sale}'`));
    await db.exec(`insert into ministry_fund_entries(ministry_key,kind,description,amount_cents,occurred_on)values('cozinha','opening_balance','Saldo anterior',10000,'2026-09-28')`);
    await assert.rejects(db.exec(`insert into ministry_fund_entries(ministry_key,kind,description,amount_cents,occurred_on)values('cozinha','opening_balance','Saldo repetido',10000,'2026-09-28')`));
    await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from ministry_fund_events'));
  } finally {await db.close();}
});
