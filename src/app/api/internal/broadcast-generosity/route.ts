import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeWhatsappPhone, sendWhatsappNotification } from "@/lib/whatsapp";

export const runtime = "nodejs";

const ONE_TIME_TOKEN = "2MtYf_8sxrHBE_5hJAzZxiGvsiLd8gcItXwHoUDug0Y";
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
  if (new URL(request.url).searchParams.get("all") !== "1") {
    url.searchParams.set("name", "notificacao_site_casa_forte");
  }
  url.searchParams.set("fields", "name,status,category,language,components");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
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

  for (let index = 0; index < recipients.length; index += 10) {
    const batch = recipients.slice(index, index + 10);
    const batchResults = await Promise.all(
      batch.map((phone) => sendWhatsappNotification(phone, MESSAGE)),
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
