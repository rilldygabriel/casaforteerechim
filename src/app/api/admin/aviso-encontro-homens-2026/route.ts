import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeWhatsappPhone } from "@/lib/whatsapp";
import { splitNotice } from "@/lib/event-notice-message";
import webPush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const OWNER = "34944370-8853-4c1b-866b-8c80b4e59829";
const EVENT = "26bb05a1-f6e2-4933-ba1c-fad81d92957e";
const NOTICE = "9408f342-207c-4a07-8ff0-e872ba8d7046";
const PATH = "/api/admin/aviso-encontro-homens-2026";
const REGISTRATIONS = ["bd43f044-5add-4bb9-b81a-71878e508698","362ce347-d3dd-481b-816f-949614650fa8","41cdc23c-e9f1-4607-abb5-6881cd3e6ec0","f3bc28dd-c3bb-44d3-9bef-7ab983b410b4","f612364c-1575-4076-b43e-db730e5415c1","809fdce0-8c98-4d62-8751-e244a9007d5c","55080de5-eecb-4c34-8994-1b865179d392","bc48c4c4-4fd4-4123-aae9-8f2e40889dbe","890110dd-fb14-4b5f-9f95-7ed4a8b3c500","088215c8-e392-4f7e-a4ce-b604d4b6397e","5af3bd2a-2706-424e-9d11-5c27a30a65a4","78058528-00de-421f-92e8-a628e364e822","6d94edf5-b5c0-41b1-9c73-b0e4d6339994","84f50641-cf19-45b1-a3c7-b607dfdf0496","345d3a4d-c930-4c3e-92bd-9b89b27070e2"];
const TEMPLATE = "comunicado_casa_forte_marketing";
const graph = () => `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0"}`;
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));

async function owner() {
  const auth = await getSupabaseServerClient();
  const { data: { user } } = await auth.auth.getUser();
  return user?.id === OWNER;
}
async function campaign() {
  const db = getSupabaseServiceClient();
  const { data: notice, error } = await db.from("family_announcements").select("id,title,body,recipient_user_ids,created_by").eq("id",NOTICE).single();
  if (error || notice?.created_by !== OWNER || !Array.isArray(notice.recipient_user_ids)) throw new Error("Aviso restrito não preparado.");
  const { data: registrations, error: re } = await db.from("event_registrations").select("full_name,phone,status,consent").eq("event_id",EVENT).is("archived_at",null).eq("status","confirmed").in("id",REGISTRATIONS);
  if (re || registrations?.length !== REGISTRATIONS.length) throw new Error("Destinatários não puderam ser verificados.");
  const recipients = new Map<string,string>();
  for (const p of (registrations ?? []).filter(r=>r.consent)) {
    const phone = normalizeWhatsappPhone(p.phone);
    if (phone) recipients.set(phone,p.full_name);
  }
  return { db, notice, recipients, registrations: registrations ?? [], parts: splitNotice(notice.body) };
}
async function template() {
  const token=process.env.WHATSAPP_ACCESS_TOKEN;
  const account=process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  if (!token || !account) throw new Error("WhatsApp não configurado.");
  const r=await fetch(`${graph()}/${account}/message_templates?name=${TEMPLATE}&fields=name,status,language,components`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store",signal:AbortSignal.timeout(10000)});
  const p=await r.json();
  if(!r.ok) throw new Error(`Meta ${p.error?.code ?? r.status}: ${p.error?.message ?? "erro de consulta"}`);
  const t=p.data?.find((x: {name:string;language:string;status:string})=>x.name===TEMPLATE&&x.language==="pt_BR"&&x.status==="APPROVED");
  if(!t) throw new Error("Modelo não aprovado ou indisponível.");
  return t;
}
async function report(note="") {
  const {db,notice,recipients,registrations,parts}=await campaign();
  const {data:deliveries,error}=await db.from("event_notice_deliveries").select("channel,recipient,part,status,error_message,provider_message_id").eq("announcement_id",NOTICE).order("id");
  if(error) throw error;
  const {data:subs}=await db.from("web_push_subscriptions").select("id,user_id").in("user_id",notice.recipient_user_ids);
  let readiness; try {readiness=await template();} catch(e) {readiness={error:e instanceof Error?e.message:"Falha Meta"};}
  const data={note,registrations:registrations.length,phones:recipients.size,parts:parts.length,accounts:notice.recipient_user_ids.length,pushDevices:subs?.length??0,template:readiness,deliveries};
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aviso Encontro Homens</title><body style="font:16px system-ui;max-width:1000px;margin:32px auto;padding:20px"><h1>Aviso Encontro Homens</h1><p>Envio exclusivo do proprietário. Cada lote envia até quatro telefones; nenhum envio é repetido automaticamente.</p><form method="post" action="${PATH}"><button name="action" value="whatsapp" style="padding:16px">Enviar próximo lote WhatsApp</button> <button name="action" value="push" style="padding:16px">Enviar notificações push dos inscritos</button></form><pre style="white-space:pre-wrap">${escapeHtml(JSON.stringify(data,null,2))}</pre><h2>Mensagem integral</h2><pre style="white-space:pre-wrap">${escapeHtml(notice.body)}</pre></body></html>`,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Frame-Options":"DENY"}});
}
export async function GET() {
  if(!await owner()) return new Response("Não autorizado",{status:403});
  try{return await report();}catch(e){return new Response(e instanceof Error?e.message:"Erro",{status:500});}
}
export async function POST(request:Request) {
  if(!await owner()) return new Response("Não autorizado",{status:403});
  if(request.headers.get("origin")!=="https://www.casaforteerechim.app.br") return new Response("Origem inválida",{status:403});
  if(Date.now()>Date.parse("2026-10-24T02:30:00Z")) return new Response("Campanha encerrada",{status:410});
  const action=(await request.formData()).get("action");
  const {db,notice,recipients,parts}=await campaign();
  if(action==="whatsapp") {
    await template(); // Fail before any claim or send if provider is unavailable.
    const {data:existing,error}=await db.from("event_notice_deliveries").select("recipient,part,status").eq("announcement_id",NOTICE).eq("channel","whatsapp");
    if(error) throw error;
    const done=new Set((existing??[]).map(x=>`${x.recipient}:${x.part}`));
    const blocked=new Set((existing??[]).filter(x=>x.status!=="accepted").map(x=>x.recipient));
    const batch=[...recipients].filter(([phone])=>!blocked.has(phone)&&parts.some((_,i)=>!done.has(`${phone}:${i}`))).slice(0,4);
    await Promise.all(batch.map(async([phone,name])=>{
      const {data:conversation,error:ce}=await db.from("whatsapp_conversations").upsert({phone,contact_name:name},{onConflict:"phone"}).select("id").single();
      if(ce||!conversation) throw new Error("Falha ao preparar conversa.");
      for(let part=0;part<parts.length;part++) {
        const {data:claim,error:claimed}=await db.from("event_notice_deliveries").insert({announcement_id:NOTICE,channel:"whatsapp",recipient:phone,part}).select("id").single();
        if(claimed?.code==="23505") continue;
        if(claimed||!claim) throw new Error("Falha ao reservar envio.");
        try {
          const r=await fetch(`${graph()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:"POST",headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,"Content-Type":"application/json"},body:JSON.stringify({messaging_product:"whatsapp",to:phone,type:"template",template:{name:TEMPLATE,language:{code:"pt_BR"},components:[{type:"body",parameters:[{type:"text",text:parts[part]}]}]}}),signal:AbortSignal.timeout(12000)});
          const payload=await r.json();
          const id=payload.messages?.[0]?.id;
          const err=id?null:`Meta ${payload.error?.code??r.status}: ${payload.error?.message??"Envio não confirmado"}`;
          await db.from("event_notice_deliveries").update({status:id?"accepted":"failed",provider_message_id:id??null,error_message:err,updated_at:new Date().toISOString()}).eq("id",claim.id);
          await db.from("whatsapp_messages").insert({conversation_id:conversation.id,wa_message_id:id??`event-notice:${claim.id}`,direction:"outbound",message_type:"template",body:parts[part],status:id?"sent":"failed",error_message:err,raw_payload:{campaign:NOTICE,part,response:payload}});
          if(!id) break;
        }catch(e){
          await db.from("event_notice_deliveries").update({status:"unknown",error_message:e instanceof Error?e.message:"Resultado desconhecido",updated_at:new Date().toISOString()}).eq("id",claim.id);
          break;
        }
      }
    }));
  }else if(action==="push") {
    const pub=process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY, priv=process.env.WEB_PUSH_PRIVATE_KEY;
    if(!pub||!priv) return new Response("Push não configurado",{status:503});
    webPush.setVapidDetails("mailto:contato@casaforteerechim.app.br",pub,priv);
    const {data:subscriptions,error}=await db.from("web_push_subscriptions").select("id,endpoint,p256dh,auth_key").in("user_id",notice.recipient_user_ids);
    if(error) throw error;
    for(const sub of subscriptions??[]) {
      const {data:claim,error:claimed}=await db.from("event_notice_deliveries").insert({announcement_id:NOTICE,channel:"push",recipient:sub.id}).select("id").single();
      if(claimed?.code==="23505") continue;
      if(claimed||!claim) throw new Error("Falha ao reservar push.");
      try {
        await webPush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth_key}},JSON.stringify({title:notice.title,body:"Sexta às 19h30 até domingo ao meio-dia. Confira a lista completa do que levar e as orientações do Encontro.",url:`/familia/notificacoes#mensagem-${NOTICE}`,tag:NOTICE}),{TTL:172800,urgency:"high",timeout:10000});
        await db.from("event_notice_deliveries").update({status:"accepted",updated_at:new Date().toISOString()}).eq("id",claim.id);
      }catch(e){await db.from("event_notice_deliveries").update({status:"failed",error_message:e instanceof Error?e.message:"Falha push",updated_at:new Date().toISOString()}).eq("id",claim.id);}
    }
  }else return new Response("Ação inválida",{status:400});
  return Response.redirect(new URL(PATH,"https://www.casaforteerechim.app.br"),303);
}
