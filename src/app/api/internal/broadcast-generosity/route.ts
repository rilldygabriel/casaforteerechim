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

export async function GET(request: Request) {
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

  const service = getSupabaseServiceClient();
  const { data: members, error } = await service
    .from("member_profiles")
    .select("phone");

  if (error) {
    return Response.json({ error: "Não foi possível carregar os membros." }, { status: 500 });
  }

  const recipients = Array.from(
    new Set((members ?? []).map((member) => normalizeWhatsappPhone(member.phone)).filter(Boolean)),
  );
  const results: Array<{ ok: boolean; error?: string }> = [];
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) {
    return Response.json({ error: "WhatsApp não configurado" }, { status: 503 });
  }

  for (let index = 0; index < recipients.length; index += 10) {
    const batch = recipients.slice(index, index + 10);
    const batchResults = await Promise.all(
      batch.map(async (phone) => {
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
                template: { name: TEMPLATE_NAME, language: { code: "pt_BR" } },
              }),
              signal: AbortSignal.timeout(10_000),
              cache: "no-store",
            },
          );
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload?.messages?.[0]?.id) {
            return { ok: false, error: JSON.stringify(payload).slice(0, 500) };
          }
          return { ok: true };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : "Falha ao enviar" };
        }
      }),
    );
    results.push(...batchResults);
  }

  const accepted = results.filter((result) => result.ok).length;
  const failures = results
    .filter((result) => !result.ok)
    .reduce<Record<string, number>>((summary, result) => {
      const reason = result.error?.slice(0, 180) || "Falha desconhecida";
      summary[reason] = (summary[reason] ?? 0) + 1;
      return summary;
    }, {});

  return Response.json({
    profiles: members?.length ?? 0,
    uniqueRecipients: recipients.length,
    accepted,
    rejected: results.length - accepted,
    failures,
  });
}
