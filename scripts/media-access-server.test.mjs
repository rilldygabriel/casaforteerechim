import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { canManageMediaAccess, canRevokeMediaAccess, MEDIA_ACCESS_OWNER_ID } from '../src/lib/media-access-policy.ts';

const state = {};
class MediaError extends Error { constructor(message, status) { super(message); this.status = status; } }
const service = {};
const client = {
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from(table) {
    const filters = [];
    return {
      select() { return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      async maybeSingle() {
        assert.ok(filters.some(([key, value]) => ['user_id', 'member_id'].includes(key) && value === state.user.id));
        if (table === 'member_group_memberships') {
          assert.ok(filters.some(([key, value]) => key === 'group_key' && value === 'midia'));
          assert.ok(filters.some(([key, value]) => key === 'member_groups.active' && value === true));
        }
        return { data: table === 'member_profiles' ? state.profile : state.membership, error: state.error };
      },
    };
  },
};
globalThis.__mediaGuardDeps = {
  getSupabaseServerClient: async () => client,
  getSupabaseServiceClient: () => { state.serviceCalls++; return service; },
  canManageMediaAccess, canRevokeMediaAccess, MediaError,
};
const source = readFileSync(new URL('../src/lib/media-access-server.ts', import.meta.url), 'utf8');
const runtime = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, ''));
const { requireMediaAccessManager } = await import('data:text/javascript;base64,' + Buffer.from('const {getSupabaseServerClient,getSupabaseServiceClient,canManageMediaAccess,canRevokeMediaAccess,MediaError}=globalThis.__mediaGuardDeps;\n' + runtime).toString('base64'));
function reset() { Object.assign(state, { user: { id: '00000000-0000-4000-8000-000000000001' }, profile: { is_admin: false, approval_status: 'approved' }, membership: { member_id: 'test' }, error: null, serviceCalls: 0 }); }
test('guard checks live own active membership before obtaining privileged client', async () => {
  reset();
  const result = await requireMediaAccessManager();
  assert.equal(result.supabase, service);
  assert.equal(result.canRevoke, false);
  assert.equal(state.serviceCalls, 1);
});
test('missing, revoked, inactive or pending membership fails closed without privileged client', async () => {
  for (const changes of [{ user: null }, { membership: null }, { profile: null }, { profile: { approval_status: 'pending' } }, { error: new Error('db unavailable') }]) {
    reset(); Object.assign(state, changes);
    await assert.rejects(requireMediaAccessManager, error => [401, 403, 503].includes(error.status));
    assert.equal(state.serviceCalls, 0);
  }
});
test('owner retains revocation without an explicit media classification', async () => {
  reset(); state.user.id = MEDIA_ACCESS_OWNER_ID; state.profile.is_admin = true; state.membership = null;
  assert.equal((await requireMediaAccessManager()).canRevoke, true);
});
