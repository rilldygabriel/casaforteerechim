import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageGaleto, GALETO_MANAGERS, validateGaleto, galetoTotals } from '../src/lib/galeto.ts';

const row = { id: '00000000-0000-4000-8000-000000000001', name: 'Pessoa', allocated: 10, returned: 0, sold: null, settled: 0, picked_up: 0, settlement_reviewed: false, notes: '', version: 1 };
test('somente Rilldy e Lisi; papel administrativo não amplia o acesso', () => {
  for (const id of GALETO_MANAGERS) assert.equal(canManageGaleto(id), true);
  for (const id of ['', 'admin', '00000000-0000-4000-8000-000000000001']) assert.equal(canManageGaleto(id), false);
});
test('exemplo solicitado: retirou 10, devolveu 5, deve acertar 5', () => {
  const input = validateGaleto({ ...row, returned: 5 });
  assert.deepEqual(galetoTotals([input]), { allocated: 10, returned: 5, retained: 5, unsettled: 5, uncollected: 5, settled: 0, picked_up: 0, unreviewed: 1 });
  assert.equal(galetoTotals([{ ...input, settled: 2 }]).unsettled, 3);
});
test('acertos e refeições são independentes e não dependem de vendas antigas', () => {
  for (const sold of [null, 0, 4, 10]) {
    const input = validateGaleto({ ...row, sold, returned: 5, settled: 2, picked_up: 4, settlement_reviewed: true });
    const totals = galetoTotals([input]);
    assert.equal(totals.unsettled, 3);
    assert.equal(totals.uncollected, 1);
  }
  const pickup = validateGaleto({ ...row, picked_up: 8 });
  assert.equal(pickup.settled, 0);
  assert.equal(pickup.settlement_reviewed, false);
});
test('valida inteiros, devoluções, saldos, campos e conferência', () => {
  for (const bad of [
    { allocated: -1 }, { allocated: 1.5 }, { allocated: 10001 }, { allocated: NaN },
    { settled: 11, settlement_reviewed: true }, { settled: 1 }, { picked_up: 11 },
    { picked_up: -1 }, { version: -1 }, { name: ' ' }, { name: 'a'.repeat(101) },
    { returned: -1 }, { returned: 11 }, { returned: null }, { returned: undefined }, { returned: NaN }, { returned: 0.5 }, { returned: 10001 },
    { returned: 5, settled: 6, settlement_reviewed: true }, { returned: 5, picked_up: 6 },
    { notes: 'a'.repeat(1001) }, { id: 'invalido' }, { settlement_reviewed: 'true' },
  ]) assert.throws(() => validateGaleto({ ...row, ...bad }), JSON.stringify(bad));
});
test('permite correções, zero e quantidade máxima sem exigir campo vendidos', () => {
  assert.equal(validateGaleto({ ...row, allocated: 0 }).allocated, 0);
  assert.equal(validateGaleto({ ...row, allocated: 10000, picked_up: 10000 }).picked_up, 10000);
  assert.equal(validateGaleto({ ...row, allocated: 2, sold: 10 }).allocated, 2);
  assert.equal(validateGaleto({ ...row, name: ' Pessoa ' }).name, 'Pessoa');
  assert.deepEqual(galetoTotals([]), { allocated: 0, returned: 0, retained: 0, unsettled: 0, uncollected: 0, settled: 0, picked_up: 0, unreviewed: 0 });
});
test('devolução total zera saldos sem alterar os ingressos originalmente retirados', () => {
  const totals = galetoTotals([validateGaleto({ ...row, returned: 10 })]);
  assert.equal(totals.allocated, 10);
  assert.equal(totals.retained, 0);
  assert.equal(totals.unsettled, 0);
  assert.equal(totals.uncollected, 0);
});
test('resumo soma todas as pessoas, inclusive as que não tinham vendidos informados', () => {
  const totals = galetoTotals([row, { ...row, allocated: 5, returned: 2, settled: 1, picked_up: 2, sold: 0, settlement_reviewed: true }]);
  assert.equal(totals.allocated, 15);
  assert.equal(totals.returned, 2);
  assert.equal(totals.unsettled, 12);
  assert.equal(totals.uncollected, 11);
  assert.equal(totals.allocated, totals.returned + totals.settled + totals.unsettled);
  assert.equal(totals.allocated, totals.returned + totals.picked_up + totals.uncollected);
});
