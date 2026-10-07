import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PAUSED_REPORT_VALUE, isHistoricalReceipt, receiptReportValue, receiptReportDescription, paymentPurpose } from '../src/lib/finance-report-visibility.ts';

test('preserva valores até 03/10 inclusive no fuso de São Paulo', () => {
  for (const date of ['2026-09-30', '2026-10-03', '2026-10-03T23:59:59-03:00', '2026-10-04T02:59:59.999Z']) {
    assert.equal(isHistoricalReceipt(date), true);
    assert.match(receiptReportValue(29300, 'contribution', date), /293,00/);
    assert.equal(receiptReportDescription('Dízimo R$ 293,00', 'contribution', date), 'Dízimo R$ 293,00');
  }
  for (const date of ['2026-10-04', '2026-10-04T03:00:00.000Z', '2026-10-07', 'inválida', undefined]) {
    assert.equal(isHistoricalReceipt(date), false);
    assert.equal(receiptReportValue(29300, 'contribution', date), PAUSED_REPORT_VALUE);
    assert.match(receiptReportValue(29300, 'event', date), /293,00/);
  }
});

test('contribuições e entradas sem vínculo de evento não preenchem valores', () => {
  for (const purpose of ['contribution', 'tithe', 'firstfruits', 'offering', undefined, null]) {
    for (const amount of [0, 100, 145000]) assert.equal(receiptReportValue(amount, purpose), PAUSED_REPORT_VALUE);
  }
});

test('eventos continuam exibindo seus valores reais', () => {
  assert.match(receiptReportValue(25000, 'event'), /250,00/);
  assert.match(receiptReportValue(0, 'event'), /0,00/);
});

test('descrições legadas não revelam o detalhamento monetário', () => {
  assert.equal(receiptReportDescription('Contribuição · Dízimo R$ 1.200,00 · Primícias R$\u00a0100,00', 'contribution'), 'Contribuição · Dízimo — · Primícias —');
  assert.equal(receiptReportDescription('Evento R$ 250,00', 'event'), 'Evento R$ 250,00');
});

test('normaliza a relação de pagamento sem presumir que uma entrada é evento', () => {
  assert.equal(paymentPurpose({purpose:'event'}), 'event');
  assert.equal(paymentPurpose([{purpose:'contribution'}]), 'contribution');
  assert.equal(paymentPurpose(null), undefined);
  assert.equal(paymentPurpose([]), undefined);
});

test('painel mantém estrutura e restringe o resumo de recebimentos a eventos aprovados', () => {
  const page = readFileSync(new URL('../src/app/admin/financeiro/page.tsx', import.meta.url), 'utf8');
  for (const section of ['finance-online-summary','finance-service-income-panel','finance-ledger-section','finance-income-section','finance-payables-section']) assert.ok(page.includes(section));
  assert.match(page, /eq\("payment.purpose", "event"\)/);
  assert.match(page, /eq\("payment.status", "approved"\)/);
  assert.match(page, /is\("payment.report_excluded_at", null\)/);
  assert.match(page, /lt\("approved_at", REPORT_PAUSE_START\)/);
  assert.match(page, /receiptReportValue\(Number\(payment.amount_cents\), payment.purpose, payment.approved_at \|\| payment.created_at\)/);
  assert.match(page, /receiptReportValue\(Number\(entry.amount_cents\), paymentPurpose\(entry.payment\), entry.transaction_date\)/);
  assert.match(page, /isHistoricalReceipt\(record.service_date\)/);
  assert.match(page, /isHistoricalReceipt\(entry.transaction_date\)/);
});
