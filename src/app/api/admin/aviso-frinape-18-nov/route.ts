import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { sendWhatsappBroadcast, verifyWhatsappBroadcastTemplate } from "@/lib/whatsapp-broadcast";
import { isMetaBusinessPhoneNumberId } from "@/lib/whatsapp-command-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const OWNER = "34944370-8853-4c1b-866b-8c80b4e59829";
const NOTICE = "2fcdbc1e-b564-4a6a-bb8d-d6547fd839fd";
const PATH = "/api/admin/aviso-frinape-18-nov";
const ORIGIN = "https://www.casaforteerechim.app.br";
const MESSAGE = "Olá benção de Deus. hoje não teremos culto na casa, mas nos encontramos na frinape as 20h para adorar a Deus no show do David quilan será uma benção !";
const campaign = `announcement_${NOTICE}`;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));

async function authorized() {
  const auth = await getSupabaseServerClient();
  const { data: { user } } = await auth.auth.getUser();
  return user?.id === OWNER;
}
async function notice() {
  const db = getSupabaseServiceClient();
  const { data, error } = await db.from("family_announcements").select("id,body,created_by").eq("id", NOTICE).single();
  if (error || data?.created_by !== OWNER || data?.body !== MESSAGE) throw new Error("Aviso não corresponde à mensagem autorizada.");
  return db;
}
async function report(note = "") {
  const db = await notice();
  const { data, error } = await db.from("whatsapp_messages").select("status,error_message").eq("raw_payload->>campaign", campaign);
  if (error) throw new Error("Falha ao conferir registros de envio.");
  let template;
  try { template = await verifyWhatsappBroadcastTemplate(); }
  catch (e) { template = { error: e instanceof Error ? e.message : "Falha ao consultar modelo" }; }
  const summary = { note, template, phoneIdValid: isMetaBusinessPhoneNumberId(process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()), total: data?.length ?? 0,
    counts: (data ?? []).reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {}),
    errors: [...new Set((data ?? []).map(r => r.error_message).filter(Boolean))] };
  return new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Aviso Frinape</title><body style="font:18px system-ui;max-width:900px;margin:32px auto;padding:24px"><h1>Aviso Frinape — WhatsApp</h1><p>O aviso do aplicativo já foi publicado. Esta ação envia apenas WhatsApp, sem repetir destinatários registrados.</p><p>${escape(MESSAGE)}</p><form action="${PATH}" method="post"><button style="padding:16px" name="action" value="send">Enviar próximo lote de até 50 contatos</button></form><pre style="white-space:pre-wrap">${escape(JSON.stringify(summary, null, 2))}</pre></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY" } });
}
export async function GET() {
  if (!await authorized()) return new Response("Não autorizado", { status: 403 });
  try { return await report(); } catch (e) { return new Response(e instanceof Error ? e.message : "Falha", { status: 500 }); }
}
export async function POST(request: Request) {
  if (!await authorized()) return new Response("Não autorizado", { status: 403 });
  if (request.headers.get("origin") !== ORIGIN) return new Response("Origem inválida", { status: 403 });
  if (Date.now() >= Date.parse("2026-11-18T23:00:00Z")) return new Response("Campanha encerrada", { status: 410 });
  if ((await request.formData()).get("action") !== "send") return new Response("Ação inválida", { status: 400 });
  try {
    await notice();
    const result = await sendWhatsappBroadcast(MESSAGE, campaign, "members", undefined, 50);
    return await report(JSON.stringify(result));
  } catch (e) { return await report(e instanceof Error ? e.message : "Envio não concluído"); }
}
