import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function actionHarness({ signedIn = true, approved = true, saveError = null } = {}) {
  const writes = [];
  const client = { auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'own-member-id' } : null } }) }, from(table) {
    let update;
    const chain = {
      select() { return chain; }, eq(key, value) { if (update) writes.push({ table, key, value, update }); return chain; },
      update(data) { update = data; return chain; },
      maybeSingle: async () => update ? { data: saveError ? null : { profile_completed: true }, error: saveError } : { data: { is_admin: false, approval_status: approved ? 'approved' : 'pending' } },
      delete() { return chain; },
    }; return chain;
  } };
  const exports = {};
  const nativeRequire = createRequire(import.meta.url);
  vm.runInNewContext(ts.transpileModule(read('src/app/familia/actions.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, console: { error() {} }, require(name) {
      if (name === 'next/cache') return { revalidatePath() {} };
      if (name === '@/lib/supabase/server') return { getSupabaseServerClient: async () => client };
      if (name === '@/lib/supabase/service') return { getSupabaseServiceClient: () => client };
      return nativeRequire(name);
    },
  });
  return { run: exports.updateMemberProfile, writes };
}

function validForm(gender = 'masculino') {
  const form = new FormData();
  Object.entries({ fullName: 'Pessoa de Teste', phone: '54999990000', birthDate: '1990-02-20', gender, address: 'Rua de teste, 123', churchSinceMonth: '2020-01', jesusYear: '2020', attendedOtherChurch: 'nao', baptized: 'sim', married: 'nao', hasDiscipler: 'nao', servesMinistry: 'nao' }).forEach(([key, value]) => form.set(key, value));
  return form;
}

test('ação salva formulário completo e confirma sucesso para ambos os gêneros', async () => {
  for (const gender of ['masculino', 'feminino']) {
    const { run, writes } = actionHarness();
    const result = await run({}, validForm(gender));
    assert.equal(result.kind, 'success');
    assert.equal(result.earnedStar, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].update.gender, gender);
    assert.equal(writes[0].key, 'user_id');
    assert.equal(writes[0].value, 'own-member-id');
  }
});

test('ação não grava sem sessão, sem aprovação ou com dados inválidos', async () => {
  for (const config of [{ signedIn: false }, { approved: false }, {}]) {
    const { run, writes } = actionHarness(config);
    const form = validForm();
    if (!Object.keys(config).length) form.set('birthDate', '1990-02-31');
    assert.equal((await run({}, form)).kind, 'error');
    assert.equal(writes.length, 0);
  }
});

test('ação retorna erro seguro sem afirmar que salvou quando banco falha', async () => {
  const { run } = actionHarness({ saveError: { code: '42501' } });
  const result = await run({}, validForm());
  assert.equal(result.kind, 'error');
  assert.equal(result.earnedStar, null);
  assert.match(result.message, /campos continuam preenchidos/);
});

test('correção concede somente edição de gender sem ampliar políticas', () => {
  const sql = read('supabase/migrations/20261011220647_permitir_membro_salvar_genero_perfil.sql').replace(/--.*$/gm, '');
  assert.match(sql, /grant update \(gender\) on public.member_profiles to authenticated;/i);
  assert.doesNotMatch(sql, /grant (all|update on)|disable row level|create policy|security definer/i);
});

test('erro de salvamento não dispara o reset automático do formulário', () => {
  const form = read('src/app/familia/profile-form.tsx');
  assert.match(form, /event.preventDefault\(\)/);
  assert.match(form, /new FormData\(event.currentTarget\)/);
  assert.match(form, /startTransition\(\(\) => formAction\(formData\)\)/);
  assert.doesNotMatch(form, /action=\{formAction\}/);
  assert.match(form, /disabled=\{isPending\}/);
});

test('salvamento continua autenticado e limitado ao próprio membro', () => {
  const action = read('src/app/familia/actions.ts');
  assert.match(action, /supabase.auth.getUser\(\)/);
  assert.match(action, /accessProfile.approval_status !== "approved"/);
  assert.match(action, /data: savedProfile, error \} = await supabase/);
  assert.match(action, /\.eq\("user_id", user.id\)\s*\.select\("profile_completed"\)/);
  assert.match(action, /member_profile_save_failed/);
});
