import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageGaleto, GALETO_MANAGERS, validateGaleto, galetoTotals } from '../src/lib/galeto.ts';

const row = { id: '00000000-0000-4000-8000-000000000001', name: 'Pessoa', allocated: 5, returned: 0, sold: 4, settled: 0, picked_up: 0, settlement_reviewed: false, notes: '', version: 1 };
test('somente Rilldy e Lisi; papel administrativo não amplia o acesso', () => {
  for (const id of GALETO_MANAGERS) assert.equal(canManageGaleto(id), true);
  for (const id of ['', 'admin', '00000000-0000-4000-8000-000000000001']) assert.equal(canManageGaleto(id), false);
});
test('acerto e retirada são independentes', () => {
  const pickup = validateGaleto({ ...row, picked_up: 3 });
  assert.equal(pickup.settled, 0);
  assert.equal(pickup.settlement_reviewed, false);
  const settled = validateGaleto({ ...row, settled: 2, settlement_reviewed: true });
  assert.equal(settled.picked_up, 0);
  assert.deepEqual(galetoTotals([pickup, settled]), { allocated: 10, returned: 0, retained: 10, sold: 8, unsold: 2, unsettled: 6, uncollected: 5, salesUnknown: 0, settled: 2, picked_up: 3, unreviewed: 1 });
});
test('valida inteiros, capacidade, campos e conferência', () => {
  for (const bad of [
    { allocated: -1 }, { allocated: 1.5 }, { allocated: 10001 }, { allocated: NaN },
    { settled: 6, settlement_reviewed: true }, { settled: 1 }, { picked_up: 6 },
    { picked_up: -1 }, { version: -1 }, { name: ' ' }, { name: 'a'.repeat(101) },
    { returned: -1 }, { returned: 2 }, { returned: null }, { returned: undefined }, { returned: NaN }, { returned: 0.5 }, { returned: 10001 },
    { sold: null }, { sold: undefined }, { sold: -1 }, { sold: 6 }, { sold: 2.5 }, { sold: 2, picked_up: 3 }, { sold: 2, settled: 3, settlement_reviewed: true },
    { notes: 'a'.repeat(1001) }, { id: 'invalido' }, { settlement_reviewed: 'true' },
  ]) assert.throws(() => validateGaleto({ ...row, ...bad }));
});
test('permite correções, zero e quantidade máxima', () => {
  assert.equal(validateGaleto({ ...row, allocated: 0, sold: 0 }).allocated, 0);
  assert.equal(validateGaleto({ ...row, allocated: 10000, sold: 10000, picked_up: 10000 }).picked_up, 10000);
  assert.equal(validateGaleto({ ...row, name: ' Pessoa ' }).name, 'Pessoa');
  assert.deepEqual(galetoTotals([]), { allocated: 0, returned: 0, retained: 0, sold: 0, unsold: 0, unsettled: 0, uncollected: 0, salesUnknown: 0, settled: 0, picked_up: 0, unreviewed: 0 });
});
test('vendas desconhecidas não viram vendas nem saldos fictícios', () => {
  const totals = galetoTotals([{ ...row, sold: null }, { ...row, settled: 2, picked_up: 1, settlement_reviewed: true }]);
  assert.equal(totals.salesUnknown, 1);
  assert.equal(totals.sold, 4);
  assert.equal(totals.unsold, 1);
  assert.equal(totals.unsettled, 2);
  assert.equal(totals.uncollected, 3);
});
test('devolvidos descontam apenas o saldo de venda, não os acertos nem refeições', () => {
  const partial = validateGaleto({ ...row, allocated: 10, sold: 6, returned: 3, settled: 4, picked_up: 2, settlement_reviewed: true });
  const totals = galetoTotals([partial]);
  assert.equal(totals.returned, 3);
  assert.equal(totals.retained, 7);
  assert.equal(totals.unsold, 1);
  assert.equal(totals.unsettled, 2);
  assert.equal(totals.uncollected, 4);
  assert.equal(totals.allocated, totals.returned + totals.sold + totals.unsold);
});
test('devolução total e correções não alteram a quantidade originalmente entregue', () => {
  const returned = validateGaleto({ ...row, sold: 0, returned: 5 });
  assert.equal(galetoTotals([returned]).unsold, 0);
  assert.equal(galetoTotals([returned]).retained, 0);
  assert.equal(galetoTotals([returned]).allocated, 5);
  assert.equal(galetoTotals([{ ...returned, returned: 2 }]).unsold, 3);
});
test('devolução conhecida não inventa vendas quando o campo ainda não foi informado', () => {
  const totals = galetoTotals([{ ...row, sold: null, returned: 3 }]);
  assert.equal(totals.returned, 3);
  assert.equal(totals.retained, 2);
  assert.equal(totals.salesUnknown, 1);
  assert.equal(totals.unsold, 0);
});
