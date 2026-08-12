import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeWhatsappPhone } from "@/lib/whatsapp";

export const runtime = "nodejs";

const ONE_TIME_TOKEN = "2MtYf_8sxrHBE_5hJAzZxiGvsiLd8gcItXwHoUDug0Y";
const TEMPLATE_NAME = "novidade_pagamentos_site_2026";
const MESSAGE = `Novidade meu povo lindo

Agora o novo site (App) da casa conta com sistema de pagamento. Se você quer contribuir nas suas primícias, dízimos, ofertas e eventos.. ali você pode fazer via pix e cartão..

Benção demais né.

Acesse agora o site e veja todas as funcionalidades

www.casaforteerechim.app.br`;

function authorized(request: Request) {
  return request.headers.get("authorization") === `Bearer ${ONE_TIME_TOKEN}`;
}

function authorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function templateStatus() {
  const accountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accountId || !accessToken) return "UNCONFIGURED";
  const url = new URL(
    `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0"}/${accountId}/message_templates`,
  );
  url.searchParams.set("name", TEMPLATE_NAME);
  url.searchParams.set("fields", "status");
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  return String(payload?.data?.[0]?.status || "UNKNOWN");
}

async function runBroadcast() {
  const service = getSupabaseServiceClient();
  const { data: members, error } = await service
    .from("member_profiles")
    .select("full_name,phone");

  if (error) throw new Error("Não foi possível carregar os membros.");
  const recipientMap = new Map<string, string | null>();
  for (const member of members ?? []) {
    const phone = normalizeWhatsappPhone(member.phone);
    if (phone && !recipientMap.has(phone)) recipientMap.set(phone, member.full_name || null);
  }
  const recipients = Array.from(recipientMap.keys());
  if (!recipients.length) return { profiles: members?.length ?? 0, uniqueRecipients: 0, accepted: 0, rejected: 0, alreadySent: 0 };

  await service.from("whatsapp_conversations").upsert(
    recipients.map((phone) => ({ phone, contact_name: recipientMap.get(phone) })),
    { onConflict: "phone", ignoreDuplicates: false },
  );
  const { data: conversations } = await service
    .from("whatsapp_conversations")
    .select("id,phone")
    .in("phone", recipients);
  const conversationByPhone = new Map((conversations ?? []).map((item) => [item.phone, item.id]));
  const conversationIds = (conversations ?? []).map((item) => item.id);
  const { data: existingMessages } = conversationIds.length
    ? await service.from("whatsapp_messages").select("conversation_id").in("conversation_id", conversationIds).eq("body", MESSAGE)
    : { data: [] as { conversation_id: number }[] };
  const alreadySentIds = new Set((existingMessages ?? []).map((item) => item.conversation_id));

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) throw new Error("WhatsApp não configurado");
  let accepted = 0;
  let rejected = 0;

  for (let index = 0; index < recipients.length; index += 10) {
    const batch = recipients.slice(index, index + 10);
    await Promise.all(batch.map(async (phone) => {
      const conversationId = conversationByPhone.get(phone);
      if (!conversationId || alreadySentIds.has(conversationId)) return;
      const placeholderId = `broadcast:${TEMPLATE_NAME}:${phone}`;
      const { error: reserveError } = await service.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        wa_message_id: placeholderId,
        direction: "outbound",
        message_type: "template",
        body: MESSAGE,
        status: "sent",
        raw_payload: { campaign: TEMPLATE_NAME, state: "reserved" },
      });
      if (reserveError) return;
      try {
        const response = await fetch(
          `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0"}/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone, type: "template", template: { name: TEMPLATE_NAME, language: { code: "pt_BR" } } }),
            signal: AbortSignal.timeout(10_000),
            cache: "no-store",
          },
        );
        const payload = await response.json().catch(() => ({}));
        const providerId = payload?.messages?.[0]?.id;
        if (!response.ok || !providerId) {
          rejected += 1;
          await service.from("whatsapp_messages").update({ status: "failed", error_message: JSON.stringify(payload).slice(0, 500), raw_payload: { campaign: TEMPLATE_NAME, response: payload } }).eq("wa_message_id", placeholderId);
          return;
        }
        accepted += 1;
        await service.from("whatsapp_messages").update({ wa_message_id: providerId, raw_payload: { campaign: TEMPLATE_NAME, response: payload } }).eq("wa_message_id", placeholderId);
        await service.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: MESSAGE.slice(0, 180), updated_at: new Date().toISOString() }).eq("id", conversationId);
      } catch (sendError) {
        rejected += 1;
        await service.from("whatsapp_messages").update({ status: "failed", error_message: sendError instanceof Error ? sendError.message : "Falha ao enviar" }).eq("wa_message_id", placeholderId);
      }
    }));
  }

  return { profiles: members?.length ?? 0, uniqueRecipients: recipients.length, accepted, rejected, alreadySent: alreadySentIds.size };
}

export async function GET(request: Request) {
  if (authorizedCron(request)) {
    const status = await templateStatus();
    if (status !== "APPROVED") return Response.json({ status, sent: false });
    return Response.json({ status, sent: true, ...(await runBroadcast()) });
  }
  if (!authorized(request)) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const accountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accountId || !accessToken) {
    return Response.json({ error: "WhatsApp não configurado" }, { status: 503 });
  }

  const url = new URL(
    `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0"}/${accountId}/message_templates`,
  );
  const query = new URL(request.url).searchParams;
  if (query.get("all") !== "1") {
    url.searchParams.set("name", query.get("broadcast") === "1" ? TEMPLATE_NAME : "notificacao_site_casa_forte");
  }
  url.searchParams.set("fields", "name,status,category,language,components");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return Response.json(payload, { status: response.status });
}

export async function PUT(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const accountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accountId || !accessToken) {
    return Response.json({ error: "WhatsApp não configurado" }, { status: 503 });
  }

  const response = await fetch(
    `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0"}/${accountId}/message_templates`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: TEMPLATE_NAME,
        language: "pt_BR",
        category: "MARKETING",
        components: [{ type: "BODY", text: MESSAGE }],
      }),
      cache: "no-store",
    },
  );
  const payload = await response.json().catch(() => ({}));
  return Response.json(payload, { status: response.status });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (await templateStatus() !== "APPROVED") {
    return Response.json({ error: "O modelo ainda está em aprovação pela Meta." }, { status: 409 });
  }
  return Response.json(await runBroadcast());
}
