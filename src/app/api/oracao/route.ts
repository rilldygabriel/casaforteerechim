import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://fjwkfpwraipxmcjlwssv.supabase.co";
const SUPABASE_KEY = "sb_publishable_OX9MFnLc_trBAs1dmjH0Gw_UDZOhl6r";
const WHATSAPP_GRAPH_API_VERSION =
  process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
const WHATSAPP_NOTIFICATION_RECIPIENTS = [
  { name: "Casa Forte", phone: "5554992640253" },
  { name: "Pastor Rilldy", phone: "5554993217227" },
  { name: "Pastora Lisi", phone: "5554991619014" },
  { name: "Pastora Eli", phone: "5554991460455" },
] as const;
const WHATSAPP_TEMPLATE_NAME = "notificacao_site_casa_forte";
const WHATSAPP_TEMPLATE_LANGUAGE = "pt_BR";

const CATEGORIAS = new Set([
  "saude",
  "familia",
  "vida_espiritual",
  "casamento",
  "financeiro",
  "ansiedade_emocional",
  "outro",
]);

type PrayerPayload = {
  nome?: unknown;
  telefone?: unknown;
  categoria?: unknown;
  pedido?: unknown;
  deseja_contato?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clean(value: unknown, max = 600) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function prayerNotification(payload: {
  nome: string;
  telefone: string;
  categoria: string;
  pedido: string;
  deseja_contato: boolean;
}) {
  return [
    "NOVO PEDIDO DE ORAÇÃO — CASA FORTE",
    `Nome: ${clean(payload.nome, 120)}`,
    `WhatsApp: ${clean(payload.telefone, 40)}`,
    `Categoria: ${clean(payload.categoria, 80)}`,
    `Deseja contato: ${payload.deseja_contato ? "Sim" : "Não"}`,
    `Pedido: ${clean(payload.pedido, 900)}`,
  ].join(" | ");
}

async function notifyWhatsApp(payload: {
  nome: string;
  telefone: string;
  categoria: string;
  pedido: string;
  deseja_contato: boolean;
}) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    console.error(
      "WhatsApp prayer notifications skipped: WHATSAPP_ACCESS_TOKEN missing",
    );
    return;
  }

  const notification = prayerNotification(payload);

  const deliveries = await Promise.all(
    WHATSAPP_NOTIFICATION_RECIPIENTS.map(async (recipient) => {
      try {
        const response = await fetch(
          `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              recipient_type: "individual",
              to: recipient.phone,
              type: "template",
              template: {
                name: WHATSAPP_TEMPLATE_NAME,
                language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
                components: [
                  {
                    type: "body",
                    parameters: [
                      {
                        type: "text",
                        text: notification,
                      },
                    ],
                  },
                ],
              },
            }),
            signal: AbortSignal.timeout(8000),
            cache: "no-store",
          },
        );

        const result = await response.json();

        if (!response.ok) {
          console.error(
            "WhatsApp prayer notification failed",
            recipient.name,
            response.status,
            result?.error?.code,
            result?.error?.message,
            result?.error?.error_data?.details,
          );
          return false;
        }

        console.info(
          "WhatsApp prayer notification sent",
          recipient.name,
          result?.messages?.[0]?.id || "without-message-id",
        );
        return true;
      } catch (error) {
        console.error(
          "WhatsApp prayer notification unavailable",
          recipient.name,
          error,
        );
        return false;
      }
    }),
  );

  console.info(
    "WhatsApp prayer notification summary",
    deliveries.filter(Boolean).length,
    WHATSAPP_NOTIFICATION_RECIPIENTS.length,
  );
}

export async function POST(request: NextRequest) {
  let body: PrayerPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const payload = {
    nome: text(body.nome),
    telefone: text(body.telefone),
    categoria: text(body.categoria),
    pedido: text(body.pedido),
    deseja_contato: body.deseja_contato === true,
    urgente: false,
    status: "novo",
  };

  const invalid =
    payload.nome.length < 3 ||
    payload.telefone.length < 8 ||
    !CATEGORIAS.has(payload.categoria) ||
    payload.pedido.length < 5 ||
    payload.pedido.length > 5000;

  if (invalid) {
    return NextResponse.json(
      { error: "Revise os dados preenchidos." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/pedidos_oracao`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Supabase prayer insert failed", response.status, details);
      return NextResponse.json(
        { error: "Não foi possível salvar o pedido." },
        { status: 502 },
      );
    }

    await notifyWhatsApp(payload);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Prayer integration unavailable", error);
    return NextResponse.json(
      { error: "Integração temporariamente indisponível." },
      { status: 503 },
    );
  }
}
