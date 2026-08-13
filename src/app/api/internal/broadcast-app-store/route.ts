import { createHash } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeWhatsappPhone } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

const TEMPLATE_NAME = "novidade_app_iphone_2026";
const UTILITY_TEMPLATE = "notificacao_site_casa_forte";
const PREVIOUS_MARKETING_TEMPLATE = "novidade_pagamentos_site_2026";
const REUSABLE_MARKETING_TEMPLATE = "comunicado_casa_forte_marketing";
const MANUAL_TOKEN_HASH = "caa1991a6588416e6ecf4baf21fa2d0d4251d333b3aba15ed8b0f39014d985b0";
const CAMPAIGN = "app_store_iphone_2026_08_13";
const MESSAGE = `O aplicativo já está na loja de aplicativos do iPhone é só atualizar o antigo ou baixar quem ainda não tinha.

Segue link abaixo 👇

https://apps.apple.com/br/app/casa-forte-erechim/id6740501695

Deus os abençoe poderosamente..

Em breve o aplicativo para Android estará liberado também 🫶🏼`;

type TemplateInfo = {
  name?: string;
  status?: string;
  category?: string;
  language?: string;
};

async function getTemplates() {
  const accountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accountId || !accessToken) throw new Error("WhatsApp não configurado");

  const url = new URL(
    `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0"}/${accountId}/message_templates`,
  );
  url.searchParams.set("fields", "name,status,category,language");
  url.searchParams.set("limit", "100");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Não foi possível consultar os modelos da Meta");

  return ((payload?.data ?? []) as TemplateInfo[]).filter((template) =>
    [TEMPLATE_NAME, PREVIOUS_MARKETING_TEMPLATE, UTILITY_TEMPLATE, REUSABLE_MARKETING_TEMPLATE].includes(template.name ?? ""),
  );
}

async function ensureReusableMarketingTemplate(templates: TemplateInfo[]) {
  const existing = templates.find((item) => item.name === REUSABLE_MARKETING_TEMPLATE);
  if (existing) return existing;

  const accountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accountId || !accessToken) throw new Error("WhatsApp não configurado");
  const response = await fetch(
    `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0"}/${accountId}/message_templates`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: REUSABLE_MARKETING_TEMPLATE,
        language: "pt_BR",
        category: "MARKETING",
        components: [
          { type: "HEADER", format: "TEXT", text: "Comunicado da Casa" },
          {
            type: "BODY",
            text: "Olá, família Casa Forte! 💛\n\n{{1}}\n\nDeus abençoe você poderosamente.\nIgreja Casa Forte Erechim",
            example: { body_text: [["Temos uma novidade especial para compartilhar com você."]] },
          },
        ],
      }),
      cache: "no-store",
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(payload?.error?.message || "Não foi possível criar o modelo permanente"));
  return { name: REUSABLE_MARKETING_TEMPLATE, status: payload?.status, category: payload?.category, language: "pt_BR" };
}

function authorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function authorizedManual(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return createHash("sha256").update(token).digest("hex") === MANUAL_TOKEN_HASH;
}

export async function GET(request: Request) {
  if (authorizedCron(request)) return POST(request);
  try {
    return Response.json({ templates: await getTemplates() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha ao consultar modelos" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!authorizedCron(request) && !authorizedManual(request)) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const templates = await getTemplates();
  await ensureReusableMarketingTemplate(templates);
  const template = templates.find((item) => item.name === TEMPLATE_NAME);
  if (template?.status !== "APPROVED" || template.category !== "MARKETING") {
    return Response.json({ error: "Modelo indisponível", template }, { status: 409 });
  }

  const service = getSupabaseServiceClient();
  const { data: members, error: membersError } = await service
    .from("member_profiles")
    .select("full_name,phone");
  if (membersError) return Response.json({ error: "Não foi possível carregar os membros" }, { status: 500 });

  const recipientMap = new Map<string, string | null>();
  for (const member of members ?? []) {
    const phone = normalizeWhatsappPhone(member.phone);
    if (phone && !recipientMap.has(phone)) recipientMap.set(phone, member.full_name || null);
  }
  const recipients = Array.from(recipientMap.keys());

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
  const { data: existing } = conversationIds.length
    ? await service
        .from("whatsapp_messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
        .eq("body", MESSAGE)
    : { data: [] as { conversation_id: number }[] };
  const alreadySent = new Set((existing ?? []).map((item) => item.conversation_id));

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return Response.json({ error: "WhatsApp não configurado" }, { status: 503 });
  }

  let accepted = 0;
  let rejected = 0;
  let skippedDuplicate = 0;
  const failures: Record<string, number> = {};

  for (let index = 0; index < recipients.length; index += 10) {
    const batch = recipients.slice(index, index + 10);
    await Promise.all(batch.map(async (phone) => {
      const conversationId = conversationByPhone.get(phone);
      if (!conversationId) return;
      if (alreadySent.has(conversationId)) {
        skippedDuplicate += 1;
        return;
      }

      const placeholderId = `broadcast:${CAMPAIGN}:${phone}`;
      const { error: reserveError } = await service.from("whatsapp_messages").insert({
        conversation_id: conversationId,
        wa_message_id: placeholderId,
        direction: "outbound",
        message_type: "template",
        body: MESSAGE,
        status: "sent",
        raw_payload: { campaign: CAMPAIGN, state: "reserved", category: template.category },
      });
      if (reserveError) {
        rejected += 1;
        return;
      }

      try {
        const response = await fetch(
          `https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0"}/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: phone,
              type: "template",
              template: {
                name: TEMPLATE_NAME,
                language: { code: template.language || "pt_BR" },
              },
            }),
            signal: AbortSignal.timeout(12_000),
            cache: "no-store",
          },
        );
        const payload = await response.json().catch(() => ({}));
        const providerId = payload?.messages?.[0]?.id as string | undefined;
        if (!response.ok || !providerId) {
          const reason = String(payload?.error?.message || "Recusada pela Meta").slice(0, 180);
          failures[reason] = (failures[reason] ?? 0) + 1;
          rejected += 1;
          await service
            .from("whatsapp_messages")
            .update({ status: "failed", error_message: reason, raw_payload: { campaign: CAMPAIGN, response: payload } })
            .eq("wa_message_id", placeholderId);
          return;
        }

        accepted += 1;
        await service
          .from("whatsapp_messages")
          .update({ wa_message_id: providerId, raw_payload: { campaign: CAMPAIGN, response: payload } })
          .eq("wa_message_id", placeholderId);
        await service
          .from("whatsapp_conversations")
          .update({ last_message_at: new Date().toISOString(), last_message_preview: MESSAGE.slice(0, 180), updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Falha ao enviar";
        failures[reason] = (failures[reason] ?? 0) + 1;
        rejected += 1;
        await service
          .from("whatsapp_messages")
          .update({ status: "failed", error_message: reason })
          .eq("wa_message_id", placeholderId);
      }
    }));
  }

  return Response.json({
    template: { name: template.name, status: template.status, category: template.category },
    profiles: members?.length ?? 0,
    uniqueRecipients: recipients.length,
    accepted,
    rejected,
    skippedDuplicate,
    failures,
  });
}
