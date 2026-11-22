import test from 'node:test';
import assert from 'node:assert/strict';
import { canManageGaleto, GALETO_MANAGERS, validateGaleto, galetoTotals } from '../src/lib/galeto.ts';

const row = { id: '00000000-0000-4000-8000-000000000001', name: 'Pessoa', allocated: 5, settled: 0, picked_up: 0, settlement_reviewed: false, notes: '', version: 1 };
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
  assert.deepEqual(galetoTotals([pickup, settled]), { allocated: 10, settled: 2, picked_up: 3, unreviewed: 1 });
});
test('valida inteiros, capacidade, campos e conferência', () => {
  for (const bad of [
    { allocated: -1 }, { allocated: 1.5 }, { allocated: 10001 }, { allocated: NaN },
    { settled: 6, settlement_reviewed: true }, { settled: 1 }, { picked_up: 6 },
    { picked_up: -1 }, { version: -1 }, { name: ' ' }, { name: 'a'.repeat(101) },
    { notes: 'a'.repeat(1001) }, { id: 'invalido' }, { settlement_reviewed: 'true' },
  ]) assert.throws(() => validateGaleto({ ...row, ...bad }));
});
test('permite correções, zero e quantidade máxima', () => {
  assert.equal(validateGaleto({ ...row, allocated: 0 }).allocated, 0);
  assert.equal(validateGaleto({ ...row, allocated: 10000, picked_up: 10000 }).picked_up, 10000);
  assert.equal(validateGaleto({ ...row, name: ' Pessoa ' }).name, 'Pessoa');
  assert.deepEqual(galetoTotals([]), { allocated: 0, settled: 0, picked_up: 0, unreviewed: 0 });
});
