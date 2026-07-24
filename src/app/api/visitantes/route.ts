import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://fjwkfpwraipxmcjlwssv.supabase.co";
const SUPABASE_KEY = "sb_publishable_OX9MFnLc_trBAs1dmjH0Gw_UDZOhl6r";
const WHATSAPP_GRAPH_API_VERSION =
  process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
const WHATSAPP_NOTIFICATION_TO = "5554992640253";
const WHATSAPP_TEMPLATE_NAME = "notificacao_site_casa_forte";
const WHATSAPP_TEMPLATE_LANGUAGE = "pt_BR";

const PASSOS_FE = new Set([
  "aceitei_jesus",
  "batizado",
  "caminhada_longa",
  "conhecendo",
]);
const EXPERIENCIAS = new Set(["ruim", "boa", "ótima"]);
const RETORNOS = new Set([
  "Sim, estarei no próximo culto",
  "Não, fui só visitar",
]);

type VisitorPayload = {
  nome?: unknown;
  telefone?: unknown;
  cidade?: unknown;
  bairro?: unknown;
  acompanhamento?: unknown;
  convidado_por?: unknown;
  igreja_anterior?: unknown;
  passo_fe?: unknown;
  mensagem_pastor?: unknown;
  experiencia_culto?: unknown;
  voltar_culto?: unknown;
  data_visita?: unknown;
  status_acompanhamento?: unknown;
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

function visitorNotification(payload: {
  nome: string;
  telefone: string;
  cidade: string;
  bairro: string;
  acompanhamento: boolean;
  convidado_por: string | null;
  igreja_anterior: string | null;
  passo_fe: string;
  mensagem_pastor: boolean;
  experiencia_culto: string;
  voltar_culto: string;
  data_visita: string;
}) {
  return [
    "NOVO VISITANTE — CASA FORTE",
    `Nome: ${clean(payload.nome, 120)}`,
    `WhatsApp: ${clean(payload.telefone, 40)}`,
    `Cidade: ${clean(payload.cidade, 80)}`,
    `Bairro: ${clean(payload.bairro, 80)}`,
    `Data da visita: ${clean(payload.data_visita, 20)}`,
    `Quer acompanhamento: ${payload.acompanhamento ? "Sim" : "Não"}`,
    `Convidado por: ${clean(payload.convidado_por, 120) || "Não informado"}`,
    `Igreja anterior: ${clean(payload.igreja_anterior, 120) || "Não informada"}`,
    `Passo de fé: ${clean(payload.passo_fe, 80)}`,
    `Quer mensagem do pastor: ${payload.mensagem_pastor ? "Sim" : "Não"}`,
    `Experiência no culto: ${clean(payload.experiencia_culto, 40)}`,
    `Deseja voltar: ${clean(payload.voltar_culto, 120)}`,
  ].join(" | ");
}

async function notifyWhatsApp(payload: {
  nome: string;
  telefone: string;
  cidade: string;
  bairro: string;
  acompanhamento: boolean;
  convidado_por: string | null;
  igreja_anterior: string | null;
  passo_fe: string;
  mensagem_pastor: boolean;
  experiencia_culto: string;
  voltar_culto: string;
  data_visita: string;
}) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    console.error(
      "WhatsApp visitor notification skipped: WHATSAPP_ACCESS_TOKEN missing",
    );
    return;
  }

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
          to: WHATSAPP_NOTIFICATION_TO,
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
                    text: visitorNotification(payload),
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
        "WhatsApp visitor notification failed",
        response.status,
        result?.error?.code,
        result?.error?.message,
        result?.error?.error_data?.details,
      );
      return;
    }

    console.info(
      "WhatsApp visitor notification sent",
      result?.messages?.[0]?.id || "without-message-id",
    );
  } catch (error) {
    console.error("WhatsApp visitor notification unavailable", error);
  }
}

export async function POST(request: NextRequest) {
  let body: VisitorPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const payload = {
    nome: text(body.nome),
    telefone: text(body.telefone),
    cidade: text(body.cidade),
    bairro: text(body.bairro),
    acompanhamento: body.acompanhamento === true,
    convidado_por: text(body.convidado_por) || null,
    igreja_anterior: text(body.igreja_anterior) || null,
    passo_fe: text(body.passo_fe),
    mensagem_pastor: body.mensagem_pastor === true,
    experiencia_culto: text(body.experiencia_culto),
    voltar_culto: text(body.voltar_culto),
    data_visita: text(body.data_visita),
    status_acompanhamento: "novo",
  };

  const invalid =
    payload.nome.length < 3 ||
    payload.telefone.length < 8 ||
    payload.cidade.length < 2 ||
    payload.bairro.length < 2 ||
    !PASSOS_FE.has(payload.passo_fe) ||
    !EXPERIENCIAS.has(payload.experiencia_culto) ||
    !RETORNOS.has(payload.voltar_culto) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.data_visita);

  if (invalid) {
    return NextResponse.json(
      { error: "Revise os dados preenchidos." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/visitantes`, {
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
      console.error("Supabase visitor insert failed", response.status, details);
      return NextResponse.json(
        { error: "Não foi possível salvar o cadastro." },
        { status: 502 },
      );
    }

    await notifyWhatsApp(payload);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Visitor integration unavailable", error);
    return NextResponse.json(
      { error: "Integração temporariamente indisponível." },
      { status: 503 },
    );
  }
}
