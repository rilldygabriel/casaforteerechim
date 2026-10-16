// Temporary release verification harness. Removed after production acceptance.
import { randomUUID, createHash } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { Upload } from "tus-js-client";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { checkMediaOrigin, requireMediaAccess } from "@/lib/media-library-server";
import { MEDIA_BUCKET, MAX_MEDIA_BYTES } from "@/lib/media-library";

export const maxDuration = 300;
const OWNER = "34944370-8853-4c1b-866b-8c80b4e59829";
const escape = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const page = (content: string) => new Response(`<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verificação privada da mídia</title><body style="font:16px system-ui;max-width:850px;margin:100px auto;padding:24px;background:#f5f5f0;color:#17231a"><h1>Verificação privada da mídia</h1>${content}</body></html>`, { headers: { "Content-Type":"text/html;charset=utf-8", "Cache-Control":"no-store", "X-Robots-Tag":"noindex" } });
export async function GET() {
  const {user}=await requireMediaAccess();
  if(user.id!==OWNER) return new Response("Não autorizado",{status:403});
  return page('<p>Testes isolados da nova biblioteca: contas temporárias, permissões, três formatos, envio, downloads e status. Nenhuma mensagem será enviada.</p><form method="post"><button style="padding:16px">Executar verificação</button></form><form method="post"><input type="hidden" name="action" value="cleanup-ui"><button>Remover somente o Reel descartável de verificação da interface</button></form>');
}
export async function POST(request:Request) {
  checkMediaOrigin(request);
  const {user}=await requireMediaAccess();
  if(user.id!==OWNER) return new Response("Não autorizado",{status:403});
  const service=getSupabaseServiceClient();
  const form=await request.formData();
  if(form.get('action')==='cleanup-ui') {
    const {data,error}=await service.from('media_ready_posts').select('id,assets').eq('created_by',OWNER).eq('title','[QA interface] Reel').gte('created_at','2026-10-16T16:00:00Z');
    if(error)throw error;
    for(const post of data??[]) {
      const paths=post.assets.map((a:{path:string})=>a.path).filter((p:string)=>p.startsWith(`${OWNER}/${post.id}/`));
      const removed=await service.storage.from(MEDIA_BUCKET).remove(paths);if(removed.error)throw removed.error;
      const deleted=await service.from('media_ready_posts').delete().eq('id',post.id).eq('created_by',OWNER);if(deleted.error)throw deleted.error;
    }
    return page(`<p>${data?.length??0} material descartável removido. Nenhum outro material foi alterado.</p>`);
  }
  const {url,publishableKey}=getSupabaseConfig();
  const base="https://www.casaforteerechim.app.br";
  const users:string[]=[];const posts:string[]=[];const paths:string[]=[];const report:string[]=[];
  const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
  const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);report.push(message+': OK');};
  try {
    const jars:string[]=[];
    for(let i=0;i<2;i++) {
      const password=randomUUID()+randomUUID();const email=`qa-midia-${randomUUID()}@example.invalid`;
      const {data,error}=await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:'Verificação temporária de mídia'}});
      if(error||!data.user) throw new Error('Criar conta temporária');
      users.push(data.user.id);
      const {error:pe}=await service.from('member_profiles').update({approval_status:'approved',full_name:'Verificação temporária de mídia'}).eq('user_id',data.user.id);
      if(pe) throw new Error('Preparar perfil temporário');
      let cookie='';
      const client=createServerClient(url,publishableKey,{cookies:{getAll:()=>[],setAll:values=>{cookie=values.map(v=>`${v.name}=${v.value}`).join('; ');}}});
      const result=await client.auth.signInWithPassword({email,password});
      if(result.error) throw new Error('Sessão da conta temporária');
      jars.push(cookie);
    }
    const call=(path:string,method='GET',body?:unknown,actor=0)=>fetch(base+path,{method,headers:{Cookie:jars[actor],Origin:base,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const denied=await call('/api/media-library');assert(denied.status===403,'Membro sem classificação bloqueado');
    const {error:membershipError}=await service.from('member_group_memberships').insert(users.map(member_id=>({member_id,group_key:'midia',assigned_by:OWNER})));
    if(membershipError) throw new Error('Classificar contas temporárias');
    assert((await call('/api/media-library')).ok,'Membro Mídia acessa API');
    const unauth=await fetch(base+'/api/media-library',{cache:'no-store'});assert(unauth.status===401,'Visitante sem login bloqueado');
    const fixture=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/QAAAABJRU5ErkJggg==','base64');
    const videoFixture=Buffer.from('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','base64');
    for(const kind of ['image','carousel','reel']) {
      const id=randomUUID();posts.push(id);
      const files=kind==='carousel'?Array.from({length:9},(_,i)=>({name:`${9-i}.png`,mime:'image/png',bytes:Buffer.concat([fixture,Buffer.from(String(i))])})):kind==='reel'?[{name:'video.mp4',mime:'video/mp4',bytes:videoFixture},{name:'cover.png',mime:'image/png',bytes:fixture}]:[{name:'image.png',mime:'image/png',bytes:Buffer.concat([fixture,Buffer.alloc(7*1024*1024)])}];
      const payload={id,kind,title:`[QA mídia] ${kind}`,caption:'Legenda completa: ação 🙏\n\n#CasaForte',files:files.map(f=>({name:f.name,mime:f.mime,size:f.bytes.length}))};
      const init=await call('/api/media-library','POST',payload);const data=await init.json();
      if(!init.ok) throw new Error(`Iniciar ${kind}: ${data.error}`);
      for(let i=0;i<files.length;i++) {
        const spec=data.uploads[i];paths.push(spec.path);
await new Promise<void>((resolve,reject)=>new Upload(files[i].bytes,{endpoint:url.replace('.supabase.co','.storage.supabase.co')+'/storage/v1/upload/resumable/sign',headers:{'x-signature':spec.token,apikey:publishableKey},metadata:{bucketName:MEDIA_BUCKET,objectName:spec.path,contentType:files[i].mime,cacheControl:'3600'},chunkSize:6*1024*1024,uploadDataDuringCreation:true,retryDelays:[0,1000],onError:(e)=>{const response='originalResponse' in e?e.originalResponse:null;let detail='';try {const body=JSON.parse(response?.getBody()||'{}');detail=String(body.message||body.error||'').replace(/eyJ[\w.-]+/g,'[redacted]').slice(0,250);}catch{}reject(new Error(`Envio TUS ${kind}: HTTP ${response?.getStatus()} ${detail}`));},onSuccess:()=>resolve()}).start());
      }
      const done=await call(`/api/media-library/${id}`,'PATCH',{action:'complete'});const completion=await done.json();
      if(!done.ok) throw new Error(`Finalizar ${kind}: ${completion.error}`);
      const retry=await call('/api/media-library','POST',payload);assert(retry.ok && (await retry.json()).ready,'Idempotência '+kind);
      const list=await (await call('/api/media-library')).json();const stored=list.posts.find((p:{id:string})=>p.id===id);
      assert(stored && stored.assets.length===files.length && stored.caption===payload.caption,'Persistência '+kind);
      assert(stored.assets.every((a:{name:string},i:number)=>a.name===files[i].name),'Ordem '+kind);
      for(let i=0;i<files.length;i++) {const response=await call(`/api/media-library/${id}/file?index=${i}&download=1`);assert(response.ok && hash(Buffer.from(await response.arrayBuffer()))===hash(files[i].bytes),`Original íntegro ${kind} ${i+1}`);}
      assert((await call(`/api/media-library/${id}/zip?prepare=1`)).ok,'Preparação ZIP '+kind);
      const zip=await call(`/api/media-library/${id}/zip`);const bytes=Buffer.from(await zip.arrayBuffer());
      assert(zip.ok && bytes.subarray(0,2).toString()==='PK' && bytes.includes(Buffer.from('legenda.txt')) && bytes.includes(Buffer.from(payload.caption)) && files.every(f=>bytes.includes(f.bytes)),'ZIP com originais e legenda '+kind);
      assert((await call(`/api/media-library/${id}`,'PATCH',{action:'status',posted:true})).ok,'Marcar postado '+kind);
      const shared=await (await call('/api/media-library','GET',undefined,1)).json();assert(shared.posts.find((p:{id:string})=>p.id===id)?.posted,'Status compartilhado '+kind);
      assert((await call(`/api/media-library/${id}`,'PATCH',{action:'status',posted:false},1)).ok,'Desmarcar por outro membro '+kind);
    }
    // Test advertised 5 GB limit without transmitting a huge dummy file.
    const probePath=`${users[0]}/${randomUUID()}/limit.mp4`;
    const {data:token}=await service.storage.from(MEDIA_BUCKET).createSignedUploadUrl(probePath);
    if(!token)throw new Error('Preparar teste de limite');
    const metadata={bucketName:MEDIA_BUCKET,objectName:probePath,contentType:'video/mp4'};
    const large=await fetch(url.replace('.supabase.co','.storage.supabase.co')+'/storage/v1/upload/resumable/sign',{method:'POST',headers:{'Tus-Resumable':'1.0.0','Upload-Length':String(MAX_MEDIA_BYTES),'Upload-Metadata':Object.entries(metadata).map(([k,v])=>`${k} ${Buffer.from(v).toString('base64')}`).join(','),'x-signature':token.token,apikey:publishableKey}});
    assert(large.status===201,'Reserva TUS aceita 5 GB (sem transferência de 5 GB)');
    const uploadLocation=large.headers.get('location');if(uploadLocation)await fetch(new URL(uploadLocation,url),{method:'DELETE',headers:{'Tus-Resumable':'1.0.0','x-signature':token.token,apikey:publishableKey}});
    await service.from('member_group_memberships').delete().eq('member_id',users[0]).eq('group_key','midia');
    assert((await call('/api/media-library')).status===403,'Retirada de Mídia revoga acesso');
  } catch(error) { report.push('FALHA: '+(error instanceof Error?error.message:'Verificação interrompida'));console.error('media_qa_failure',report.at(-1)); }
  finally {
    if(paths.length) {const {error}=await service.storage.from(MEDIA_BUCKET).remove(paths);report.push(error?'FALHA: limpar arquivos temporários':'Arquivos temporários removidos');}
    if(posts.length) await service.from('media_ready_posts').delete().in('id',posts);
    for(const id of users) {await service.from('member_group_memberships').delete().eq('member_id',id);await service.from('member_profiles').delete().eq('user_id',id);const {error}=await service.auth.admin.deleteUser(id);if(error)report.push('FALHA: limpar conta temporária '+id);}
    report.push('Limpeza dos registros de teste executada');
  }
  return page(`<ul>${report.map(s=>`<li>${escape(s)}</li>`).join('')}</ul><a href="/admin/pronto-para-postar">Voltar à biblioteca</a>`);
}
