import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { canManageMediaAccess, MEDIA_ACCESS_OWNER_ID, parseMediaAccessChange } from '../src/lib/media-access-policy.ts';

const memberId = '4233f7fd-d931-445d-afab-d775d221a68e';
test('somente o proprietário aprovado e administrador gerencia esta tela', () => {
  assert.equal(canManageMediaAccess(MEDIA_ACCESS_OWNER_ID, { is_admin: true, approval_status: 'approved' }), true);
  for (const profile of [null, {is_admin:false,approval_status:'approved'}, {is_admin:true,approval_status:'pending'}]) assert.equal(canManageMediaAccess(MEDIA_ACCESS_OWNER_ID, profile), false);
  assert.equal(canManageMediaAccess(memberId, {is_admin:true,approval_status:'approved'}), false);
});
test('exige UUID e booleano; ignora qualquer grupo ou permissão adicional no payload', () => {
  assert.deepEqual(parseMediaAccessChange({ memberId, enabled: true, group_key:'equipe_pastoral',is_admin:true }), { memberId,enabled:true });
  for (const value of [null, {}, {memberId,enabled:'true'}, {memberId:'bad',enabled:true}]) assert.equal(parseMediaAccessChange(value), null);
});

// Exercise the real route handlers, replacing only their infrastructure imports.
const source = readFileSync(new URL('../src/app/api/admin/midias/acessos/route.ts', import.meta.url), 'utf8');
const runtime = stripTypeScriptTypes(source.replace(/^import .*;\n/gm, ''));
class MediaError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const harness = { allowed:true, enabled:false, calls:[], pages:[], admin:false, fail:false };
const client = { from(table) {
  const query = { filters:[], action:'select', select(){return this;}, order(){return this;},
    eq(key,value){this.filters.push([key,value]);return this;},
    range(from,to){harness.calls.push({table,action:'range',from,to});return Promise.resolve({data:harness.pages.shift()??[],error:null});},
    upsert(row,options){this.action='upsert';this.row=row;this.options=options;return this;},
    delete(){this.action='delete';return this;},
    maybeSingle(){return this;},
    then(resolve,reject){
      harness.calls.push({table,action:this.action,filters:this.filters,row:this.row,options:this.options});
      if(harness.fail) return Promise.resolve({data:null,error:new Error('db failed')}).then(resolve,reject);
      if(this.action==='upsert') harness.enabled=true;
      if(this.action==='delete') harness.enabled=false;
      const data=table==='member_profiles'?{user_id:memberId,is_admin:harness.admin}:(harness.enabled?{member_id:memberId}:null);
      return Promise.resolve({data,error:null}).then(resolve,reject);
    }
  };return query;
}};
globalThis.__mediaTestDeps={
  revalidatePath:()=>{}, parseMediaAccessChange, MediaError,
  requireMediaAccessManager:async()=>{if(!harness.allowed)throw new MediaError('Forbidden',403);return {supabase:client,user:{id:MEDIA_ACCESS_OWNER_ID}};},
  checkMediaOrigin:request=>{if(request.headers.get('origin')!==new URL(request.url).origin)throw new MediaError('Origin',403);},
  readMediaJson:request=>request.json(),
  mediaError:error=>Response.json({error:error.message},{status:error.status??500}),
};
const route=await import('data:text/javascript;base64,'+Buffer.from('const {revalidatePath,parseMediaAccessChange,MediaError,requireMediaAccessManager,checkMediaOrigin,readMediaJson,mediaError}=globalThis.__mediaTestDeps;\n'+runtime).toString('base64'));
function reset(){Object.assign(harness,{allowed:true,enabled:false,calls:[],pages:[],admin:false,fail:false});}
function request(enabled,origin='https://example.test'){return new Request('https://example.test/api/admin/midias/acessos',{method:'PATCH',headers:{origin,'content-type':'application/json'},body:JSON.stringify({memberId,enabled,group_key:'equipe_pastoral'})});}
test('lista todos os cadastros com paginação e apenas a classificação Mídias',async()=>{
  reset();const profile={user_id:memberId,full_name:'Teste',is_admin:false,approval_status:'approved',member_group_memberships:[{group_key:'voluntario'}]};
  harness.pages=[Array.from({length:500},()=>profile),[{...profile,member_group_memberships:[{group_key:'midia'}]}]];
  const response=await route.GET();const {members}=await response.json();
  assert.equal(members.length,501);assert.equal(members[0].media_enabled,false);assert.equal(members[500].media_enabled,true);
  assert.equal(harness.calls[1].from,500);assert.match(response.headers.get('cache-control'),/no-store/);
});
test('marca e desmarca somente midia, com confirmação de persistência',async()=>{
  reset();let response=await route.PATCH(request(true));assert.equal(response.status,200);assert.deepEqual(await response.json(),{enabled:true});
  const insert=harness.calls.find(call=>call.action==='upsert');assert.deepEqual(insert.row,{member_id:memberId,group_key:'midia',assigned_by:MEDIA_ACCESS_OWNER_ID});
  response=await route.PATCH(request(false));assert.equal(response.status,200);assert.deepEqual(await response.json(),{enabled:false});
  const deletion=harness.calls.find(call=>call.action==='delete');assert.deepEqual(deletion.filters,[['member_id',memberId],['group_key','midia']]);
});
test('bloqueia visitante ou não proprietário e não consulta nem altera cadastros',async()=>{
  reset();harness.allowed=false;assert.equal((await route.GET()).status,403);assert.equal((await route.PATCH(request(true))).status,403);assert.equal(harness.calls.length,0);
});
test('bloqueia outra origem, permissões herdadas e falhas no banco sem anunciar sucesso',async()=>{
  reset();assert.equal((await route.PATCH(request(true,'https://evil.test'))).status,403);assert.equal(harness.calls.length,0);
  harness.admin=true;assert.equal((await route.PATCH(request(true))).status,409);assert.equal(harness.calls.some(call=>call.action==='upsert'),false);
  reset();harness.fail=true;assert.equal((await route.PATCH(request(true))).status,500);
});
test('não adiciona envio de aviso, WhatsApp ou push e usa sessão/RLS, não service role',()=>{
  assert.doesNotMatch(source,/whatsapp|announcement|web_push|sendNotification|ServiceClient/);
});
