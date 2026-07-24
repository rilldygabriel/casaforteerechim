import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://fjwkfpwraipxmcjlwssv.supabase.co";
const SUPABASE_KEY = "sb_publishable_OX9MFnLc_trBAs1dmjH0Gw_UDZOhl6r";

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

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Visitor integration unavailable", error);
    return NextResponse.json(
      { error: "Integração temporariamente indisponível." },
      { status: 503 },
    );
  }
}
