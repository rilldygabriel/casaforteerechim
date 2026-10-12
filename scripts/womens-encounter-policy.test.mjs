import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canCreateCashRegistration, WOMENS_ENCOUNTER_SLUG, CASH_REGISTRATION_OWNER_ID } from '../src/lib/womens-encounter-policy.ts';

test('somente o presidente autorizado pode cadastrar mulheres em dinheiro', () => {
  assert.equal(canCreateCashRegistration(CASH_REGISTRATION_OWNER_ID,WOMENS_ENCOUNTER_SLUG,true),true);
  assert.equal(canCreateCashRegistration(CASH_REGISTRATION_OWNER_ID,WOMENS_ENCOUNTER_SLUG,false),false);
  assert.equal(canCreateCashRegistration('outro-admin',WOMENS_ENCOUNTER_SLUG,true),false);
  assert.equal(canCreateCashRegistration('outro-admin','hamburguer-da-casa-20-09',true),true);
});
test('trava de vagas serializa reservas e dinheiro é uma transação privada', () => {
  const sql=readFileSync(new URL('../supabase/migrations/20261012160841_womens_two_slots_owner_cash.sql',import.meta.url),'utf8');
  assert.match(sql,/for update/i);
  assert.match(sql,/reserved \+ 1 >= e.capacity/);
  assert.match(sql,/registration_status = 'closed'/);
  assert.match(sql,/count\(\*\)\+2/);
  assert.match(sql,/from public,anon,authenticated/);
  assert.match(sql,/grant execute.*to service_role/);
  assert.doesNotMatch(sql,/security definer/i);
});

test('contador público usa a mesma base de reservas da trava', () => {
  const page=readFileSync(new URL('../src/app/eventos/[slug]/page.tsx',import.meta.url),'utf8');
  assert.match(page,/data.slug !== WOMENS_ENCOUNTER_SLUG\) countQuery = countQuery.not/);
  assert.match(page,/const \{ count, error \} = await countQuery/);
});
