import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WHATSAPP_GRAPH_API_VERSION =
  process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
const PASTORAL_NOTIFICATION_RECIPIENTS = [
  { name: "Pastor Rilldy", phone: "5554993217227" },
  { name: "Pastora Lisi", phone: "5554991619014" },
] as const;
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

function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  return null;
}

function followupSteps(visitorId: number, visitDate: string) {
  const [year, month, day] = visitDate.split("-").map(Number);
  const visitWeekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const offsets = visitWeekday === 3 ? [1, 4, 7, 10] : [1, 4, 6, 10];
  const dateAfter = (days: number) =>
    new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  return [
    {
      visitor_id: visitorId,
      step_key: "monday_message",
      due_date: dateAfter(offsets[0]),
    },
    {
      visitor_id: visitorId,
      step_key: "thursday_message",
      due_date: dateAfter(offsets[1]),
    },
    {
      visitor_id: visitorId,
      step_key: "next_service_invite",
      due_date: dateAfter(offsets[2]),
    },
    {
      visitor_id: visitorId,
      step_key: "following_week_contact",
      due_date: dateAfter(offsets[3]),
    },
  ];
}

async function getNotificationRecipients() {
  const recipients = new Map<string, { name: string; phone: string }>();
  for (const recipient of PASTORAL_NOTIFICATION_RECIPIENTS) recipients.set(recipient.phone, { ...recipient });

  const service = getSupabaseServiceClient();
  const { data: leadership, error: leadershipError } = await service
    .from("ministry_leaders")
    .select("member_id")
    .eq("ministry_key", "connect_consolidacao");
  if (leadershipError) throw leadershipError;

  const leaderIds = (leadership ?? []).map((item) => item.member_id);
  if (leaderIds.length) {
    const { data: profiles, error: profilesError } = await service
      .from("member_profiles")
      .select("full_name,phone")
      .in("user_id", leaderIds);
    if (profilesError) throw profilesError;
    for (const profile of profiles ?? []) {
      const phone = normalizeWhatsAppPhone(profile.phone ?? "");
      if (phone) recipients.set(phone, { name: profile.full_name || "Liderança do Connect", phone });
    }
  }

  return [...recipients.values()];
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
    const recipients = await getNotificationRecipients();
    const deliveries = await Promise.allSettled(recipients.map(async (recipient) => {
      const response = await fetch(
        `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: recipient.phone,
            type: "template",
            template: {
              name: WHATSAPP_TEMPLATE_NAME,
              language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
              components: [{ type: "body", parameters: [{ type: "text", text: visitorNotification(payload) }] }],
            },
          }),
          signal: AbortSignal.timeout(8000),
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (!response.ok || !result?.messages?.[0]?.id) {
        throw new Error(`WhatsApp recusou a notificação (${response.status}, ${result?.error?.code ?? "sem código"}).`);
      }
      return result.messages[0].id as string;
    }));
    const sent = deliveries.filter((item) => item.status === "fulfilled").length;
    const failed = deliveries.length - sent;
    console.info("WhatsApp visitor notifications completed", { recipients: recipients.length, sent, failed });
    deliveries.forEach((item) => { if (item.status === "rejected") console.error("WhatsApp visitor recipient notification failed", item.reason); });
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
    const service = getSupabaseServiceClient();
    const { data: visitor, error: visitorError } = await service
      .from("visitantes")
      .insert(payload)
      .select("id,data_visita")
      .single();

    if (visitorError || !visitor) {
      console.error("Supabase visitor insert failed", visitorError?.code);
      return NextResponse.json(
        { error: "Não foi possível salvar o cadastro." },
        { status: 502 },
      );
    }

    const { error: stepsError } = await service
      .from("visitor_followup_steps")
      .insert(followupSteps(visitor.id, visitor.data_visita));
    if (stepsError) {
      console.error("Visitor follow-up steps insert failed", {
        visitorId: visitor.id,
        errorCode: stepsError.code,
      });
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
