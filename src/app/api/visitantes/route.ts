import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Visitor integration unavailable", error);
    return NextResponse.json(
      { error: "Integração temporariamente indisponível." },
      { status: 503 },
    );
  }
}
