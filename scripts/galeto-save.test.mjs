import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as lib from '../src/lib/galeto.ts';

const require = createRequire(import.meta.url);
function load(path, mocks, suffix = '') {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8') + suffix;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const row = { id: '00000000-0000-4000-8000-000000000001', name: 'Teste', allocated: 10, returned: 5, sold: null, settled: 2, picked_up: 1, settlement_reviewed: true, notes: '', version: 1, updated_at: '' };

test('ação exige acesso e aceite e salva somente os campos do controle corrigido', async () => {
  let userId = lib.GALETO_MANAGERS[0];
  const calls = [];
  const { saveGaleto } = load('../src/app/admin/eventos/galeto/actions.ts', {
    '@/lib/galeto': lib,
    'next/cache': { revalidatePath: () => {} },
    '@/lib/supabase/server': { getSupabaseServerClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
      rpc: async (name, input) => { calls.push({ name, input }); return { data: { ...row, version: 2 }, error: null }; },
    }) },
  });
  assert.equal((await saveGaleto(row, false)).ok, false);
  assert.equal((await saveGaleto({ ...row, settled: 6 }, true)).ok, false);
  userId = 'outsider';
  assert.equal((await saveGaleto(row, true)).ok, false);
  assert.equal(calls.length, 0);
  for (const id of lib.GALETO_MANAGERS) {
    userId = id;
    assert.equal((await saveGaleto(row, true)).ok, true);
  }
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, 'save_galeto_control_v3');
  assert.equal(calls[0].input.p_allocated, 10);
  assert.equal(calls[0].input.p_returned, 5);
  assert.equal(calls[0].input.p_settled, 2);
  assert.equal('p_sold' in calls[0].input, false);
});

test('card recalcula sem salvar, exige aceite novo após cada edição e preserva saldo salvo', async () => {
  const slots = [];
  let cursor = 0;
  let saves = 0;
  let saved;
  const mockReact = {
    useState: initial => {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef: initial => { const i = cursor++; return slots[i] ??= { current: initial }; },
    useTransition: () => [false, callback => callback()],
  };
  const { AllocationCard } = load('../src/app/admin/eventos/galeto/control.tsx', {
    react: mockReact,
    'next/navigation': { useRouter: () => ({ refresh: () => {} }) },
    '@/lib/galeto': lib,
    './galeto.module.css': {},
    './actions': { saveGaleto: async (input, confirmed) => {
      assert.equal(confirmed, true);
      saves++;
      return { ok: true, row: { ...input, version: 2, updated_at: '' } };
    } },
  }, '\nexport { AllocationCard };');
  let currentRow = { ...row };
  const render = () => { cursor = 0; return AllocationCard({ row: currentRow, onSaved: value => { saved = value; currentRow = value; } }); };
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  const find = predicate => nodes(render()).find(predicate);
  const checkbox = () => find(n => n.type === 'input' && n.props.type === 'checkbox');
  const save = () => find(n => n.type === 'button' && n.props.type === 'submit');
  const field = label => find(n => n.type === 'input' && n.props['aria-label'] === `${label} · Teste`);
  const balance = label => find(n => n.type === 'span' && Array.isArray(n.props.children) && n.props.children[0] === label)?.props.children[1].props.children;
  assert.equal(field('Ingressos retirados').props.value, 10);
  assert.equal(field('Vendidos'), undefined);
  assert.equal(balance('Falta acertar '), 3);
  assert.equal(save().props.disabled, true);
  field('Devolvidos').props.onChange({ target: { valueAsNumber: 4 } });
  assert.equal(balance('Falta acertar '), 4);
  assert.equal(saves, 0);
  assert.equal(lib.galetoTotals([currentRow]).unsettled, 3);
  checkbox().props.onChange({ target: { checked: true } });
  assert.equal(save().props.disabled, false);
  field('Acertados').props.onChange({ target: { valueAsNumber: 3 } });
  assert.equal(checkbox().props.checked, false);
  assert.equal(save().props.disabled, true);
  await find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(saves, 0);
  checkbox().props.onChange({ target: { checked: true } });
  await find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(saves, 1);
  assert.equal(saved.returned, 4);
  assert.equal(saved.settled, 3);
  assert.equal(lib.galetoTotals([saved]).unsettled, 3);
  assert.equal(save().props.disabled, true);
});
