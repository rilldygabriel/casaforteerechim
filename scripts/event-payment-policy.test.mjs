import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { EVENT_PAYMENT_PROVIDER, CONTRIBUTION_PAYMENT_PROVIDER, validateEventPaymentInput, eventInstallmentLimit, pagBankPaymentStatus } from '../src/lib/event-payment-policy.ts';
const require = createRequire(import.meta.url);
const paymentId = '11111111-2222-4333-8444-555555555555';
const base = { method: 'pix', taxId: '12345678909' }; // algorithmic test fixture, never sent to a provider

test('eventos PagBank, contribuições Mercado Pago; parcelas no servidor', () => {
  assert.equal(EVENT_PAYMENT_PROVIDER, 'pagbank'); assert.equal(CONTRIBUTION_PAYMENT_PROVIDER, 'mercado_pago');
  assert.equal(eventInstallmentLimit('hamburguer-da-casa-20-09'), 1);
  assert.equal(validateEventPaymentInput(base, 'encontro'), null);
  assert.ok(validateEventPaymentInput({ ...base, taxId: '11111111111' }, 'encontro'));
  assert.ok(validateEventPaymentInput({ ...base, method: 'boleto' }, 'encontro'));
  const card = { ...base, method: 'card', encryptedCard: 'x'.repeat(100), cardHolder: 'Teste', installments: 4 };
  assert.equal(validateEventPaymentInput(card, 'encontro'), null);
  assert.ok(validateEventPaymentInput(card, 'hamburguer-da-casa-20-09'));
  assert.ok(validateEventPaymentInput({ ...card, installments: 1.5 }, 'encontro'));
  assert.ok(validateEventPaymentInput({ ...card, encryptedCard: undefined }, 'encontro'));
});
test('somente PAID aprova; estornos e recusas não são pendências', () => {
  for (const [provider, local] of Object.entries({ PAID: 'approved', AUTHORIZED: 'in_process', WAITING: 'pending', IN_ANALYSIS: 'in_process', DECLINED: 'rejected', CANCELED: 'cancelled', EXPIRED: 'expired', REFUNDED: 'refunded', CHARGED_BACK: 'charged_back' })) assert.equal(pagBankPaymentStatus(provider), local);
});

function load(source, mocks) {
  const code = ts.transpileModule(fs.readFileSync(new URL(source, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)((id) => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('node:') ? require(id) : (() => { throw new Error(`Unmocked module: ${id}`); })(), exports);
  return exports;
}
function dbMock(payment, { otherPaid = false } = {}) {
  const writes = [];
  return { writes, from(table) {
    const filters = []; let mutation; let values;
    const q = {
      select() { return q; }, eq(k,v) { filters.push([k,v]); return q; }, neq() { return q; }, limit() { return q; },
      update(v) { mutation='update';values=v;return q; }, upsert(v) { mutation='upsert';values=v;return q; },
      async maybeSingle() { return { data: table === 'mercado_pago_payments' && filters.some(([k,v])=>k==='payment_provider'&&v==='pagbank') && payment.payment_provider === 'pagbank' ? payment : null, error:null }; },
      then(resolve) { if(mutation) writes.push({table, mutation, values}); return Promise.resolve({data: mutation ? [{id:paymentId}] : otherPaid ? [{id:'other'}] : [],error:null}).then(resolve); },
    }; return q;
  }};
}
function library(db, delivered) {
  return load('../src/lib/pagbank.ts', {
    'server-only': {}, '@/lib/supabase/service': { getSupabaseServiceClient:()=>db },
    '@/lib/event-payment-policy': { pagBankPaymentStatus },
    '@/lib/event-ticket-delivery': { getEventTicketDeliveryState: async()=>({ticketUrl:undefined,emailSent:false,whatsappSent:false}), deliverEventTicket:async(input)=>{delivered.push(input);return {ticketUrl:'https://example.test/ticket',emailSent:true,whatsappSent:true};} },
    '@/lib/event-tickets': {cancelEventTicket:async()=>{}},
    qrcode: {toBuffer:async()=>Buffer.from('mock-qr')},
  });
}
function providerOrder({status='PAID', paid=25000, reference=paymentId, amount=25000}={}) {
  return {id:'ORDE_AAAA-BBBB',reference_id:reference,charges:[{id:'CHAR_AAAA-BBBB',reference_id:reference,status,amount:{value:amount,summary:{paid}},paid_at:'2026-09-28T13:30:00Z',payment_method:{type:'PIX'},qr_code:{text:'test-code'}}]};
}
test('PagBank: criação usa valor confiável, idempotência e cartão criptografado', async()=>{
  const original=global.fetch; const oldToken=process.env.PAGBANK_TOKEN; process.env.PAGBANK_TOKEN='unit-token';
  const requests=[];global.fetch=async(url,init)=>{requests.push({url:String(url),...init});return Response.json(providerOrder({status:'WAITING',paid:0}));};
  try {
    const lib=library(dbMock({}),[]);
    const r=await lib.createPagBankEventPayment({paymentId,eventTitle:'Encontro',amountCents:25000,payerName:'Teste unitário',payerEmail:'unit@example.test',payerPhone:'00000000000',taxId:base.taxId,method:'card',encryptedCard:'ciphertext',installments:4});
    const sent=JSON.parse(requests[0].body);
    assert.equal(requests[0].headers['x-idempotency-key'],paymentId);
    assert.equal(sent.charges[0].amount.value,25000);
    assert.equal(sent.charges[0].payment_method.card.store,false);
    assert.equal(sent.charges[0].payment_method.card.number,undefined);
    assert.equal(sent.customer.phones,undefined);
    assert.equal(r.providerOrderId,'ORDE_AAAA-BBBB');
  } finally {global.fetch=original;if(oldToken===undefined)delete process.env.PAGBANK_TOKEN;else process.env.PAGBANK_TOKEN=oldToken;}
});
test('PagBank: reconcilia valor pago, confirma inscrição, contabiliza e emite ingresso', async()=>{
  const original=global.fetch;const oldToken=process.env.PAGBANK_TOKEN;process.env.PAGBANK_TOKEN='unit-token';global.fetch=async()=>Response.json(providerOrder());
  try {
    const db=dbMock({id:paymentId,event_id:'event',registration_id:'reg',amount_cents:25000,payment_provider:'pagbank',provider_order_id:'ORDE_AAAA-BBBB'});const delivered=[];
    const r=await library(db,delivered).synchronizePagBankEventPayment(paymentId);
    assert.equal(r.status,'approved');assert.equal(r.emailSent,true);assert.equal(delivered.length,1);
    assert.ok(db.writes.some(w=>w.table==='event_registrations'&&w.values.status==='confirmed'));
    assert.ok(db.writes.some(w=>w.table==='finance_income_entries'&&w.values.source==='pagbank'&&w.values.amount_cents===25000));
  } finally {global.fetch=original;if(oldToken===undefined)delete process.env.PAGBANK_TOKEN;else process.env.PAGBANK_TOKEN=oldToken;}
});
test('PagBank: webhook antes da persistência recupera pedido; não toca contribuições MP', async()=>{
  const original=global.fetch;const oldToken=process.env.PAGBANK_TOKEN;process.env.PAGBANK_TOKEN='unit-token';let calls=0;global.fetch=async()=>{calls++;return Response.json(providerOrder());};
  try {
    const payment={id:paymentId,event_id:'event',registration_id:'reg',amount_cents:25000,payment_provider:'pagbank',provider_order_id:null};
    const db=dbMock(payment);assert.equal((await library(db,[]).synchronizePagBankEventPayment(paymentId,'ORDE_AAAA-BBBB')).status,'approved');
    const mp=dbMock({...payment,payment_provider:'mercado_pago'});assert.equal((await library(mp,[]).synchronizePagBankEventPayment(paymentId,'ORDE_AAAA-BBBB')).ignored,true);assert.equal(mp.writes.length,0);assert.equal(calls,1);
  } finally {global.fetch=original;if(oldToken===undefined)delete process.env.PAGBANK_TOKEN;else process.env.PAGBANK_TOKEN=oldToken;}
});
test('PagBank: valor, referência ou pagamento parcial não emitem ingressos', async()=>{
  const original=global.fetch;const oldToken=process.env.PAGBANK_TOKEN;process.env.PAGBANK_TOKEN='unit-token';
  try {
    for(const input of [{amount:100},{paid:100},{reference:'wrong'}]){
      global.fetch=async()=>Response.json(providerOrder(input));const db=dbMock({id:paymentId,event_id:'event',registration_id:'reg',amount_cents:25000,payment_provider:'pagbank',provider_order_id:'ORDE_AAAA-BBBB'});const deliveries=[];
      await assert.rejects(library(db,deliveries).synchronizePagBankEventPayment(paymentId));assert.equal(deliveries.length,0);assert.equal(db.writes.length,0);
    }
  } finally {global.fetch=original;if(oldToken===undefined)delete process.env.PAGBANK_TOKEN;else process.env.PAGBANK_TOKEN=oldToken;}
});
test('PagBank: WAITING não contabiliza nem entrega ingresso', async()=>{
  const original=global.fetch;const oldToken=process.env.PAGBANK_TOKEN;process.env.PAGBANK_TOKEN='unit-token';global.fetch=async()=>Response.json(providerOrder({status:'WAITING',paid:0}));
  try {
    const db=dbMock({id:paymentId,event_id:'event',registration_id:'reg',amount_cents:25000,payment_provider:'pagbank',provider_order_id:'ORDE_AAAA-BBBB'});const deliveries=[];
    assert.equal((await library(db,deliveries).synchronizePagBankEventPayment(paymentId)).status,'pending');assert.equal(deliveries.length,0);assert.ok(!db.writes.some(w=>w.table==='finance_income_entries'));
  } finally {global.fetch=original;if(oldToken===undefined)delete process.env.PAGBANK_TOKEN;else process.env.PAGBANK_TOKEN=oldToken;}
});

function paymentRoute({ provider='pagbank', status='created', orderId=null, fail=false }={}) {
  const calls=[];
  const payment={id:paymentId,event_id:'event',registration_id:'reg',payer_name:'Teste',payer_email:'unit@example.test',payer_phone:'54999999999',amount_cents:25000,status,payment_provider:provider,provider_order_id:orderId};
  const rows={mercado_pago_payments:payment, events:{id:'event',slug:'encontro',title:'Encontro',registration_fee_cents:25000},event_registrations:{id:'reg',status:status==='approved'?'confirmed':'awaiting_payment'}};
  const service={from(table){const q={select(){return q;},eq(){return q;},in(){return q;},update(v){calls.push({write:table,value:v});return q;},async maybeSingle(){return {data:rows[table],error:null};},then(resolve){return Promise.resolve({error:null}).then(resolve);}};return q;}};
  const route=load('../src/app/api/eventos/[slug]/pagamento/route.ts',{
    'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
    '@/lib/supabase/service':{getSupabaseServiceClient:()=>service},
    '@/lib/event-ticket-delivery':{getEventTicketDeliveryState:async()=>({})},
    '@/lib/event-payment-policy':{validateEventPaymentInput},
    '@/lib/pagbank':{isPagBankConfigured:()=>true,createPagBankEventPayment:async(input)=>{calls.push({provider:'pagbank',input});if(fail)throw new Error('provider unavailable');return {providerOrderId:'ORDE_AAAA-BBBB',providerPaymentId:'CHAR_AAAA-BBBB',status:'pending',paymentMethodId:'pix',qrCode:'code'};},synchronizePagBankEventPayment:async()=>({status:'pending',providerPaymentId:'CHAR_AAAA-BBBB'})},
    '@/lib/mercado-pago':{isMercadoPagoBrickConfigured:()=>true,createMercadoPagoBrickPayment:async(input)=>{calls.push({provider:'mercado_pago',input});return {providerPaymentId:'123',status:'pending'};},synchronizeMercadoPagoPayment:async()=>({status:'pending'})},
  });
  const post=(body)=>route.POST(new Request('https://example.test/api/eventos/encontro/pagamento',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({paymentId,...body})}),{params:Promise.resolve({slug:'encontro'})});
  return {calls,post};
}
test('API cobra novos eventos no PagBank com o valor do banco, não o valor do cliente',async()=>{
  const {post,calls}=paymentRoute();const response=await post({...base,amountCents:1});assert.equal(response.status,200);
  const charged=calls.find(c=>c.provider);assert.equal(charged.provider,'pagbank');assert.equal(charged.input.amountCents,25000);assert.equal(calls.filter(c=>c.provider==='mercado_pago').length,0);
});
test('API preserva cobranças antigas MP e não duplica pedido PagBank existente',async()=>{
  const old=paymentRoute({provider:'mercado_pago'});assert.equal((await old.post({formData:{}})).status,200);assert.equal(old.calls.find(c=>c.provider).provider,'mercado_pago');
  const existing=paymentRoute({orderId:'ORDE_AAAA-BBBB'});assert.equal((await existing.post(base)).status,200);assert.equal(existing.calls.filter(c=>c.provider).length,0);
});
test('API não cobra inscrição paga, CPF inválido nem faz fallback financeiro silencioso',async()=>{
  const paid=paymentRoute({status:'approved'});assert.equal((await paid.post(base)).status,409);assert.equal(paid.calls.length,0);
  const bad=paymentRoute();assert.equal((await bad.post({...base,taxId:'000'})).status,400);assert.equal(bad.calls.length,0);
  const outage=paymentRoute({fail:true});const original=console.error;console.error=()=>{};
  try {assert.equal((await outage.post(base)).status,502);assert.equal(outage.calls.filter(c=>c.provider==='mercado_pago').length,0);} finally {console.error=original;}
});
