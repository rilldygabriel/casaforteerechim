import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://fjwkfpwraipxmcjlwssv.supabase.co";
const SUPABASE_KEY = "sb_publishable_OX9MFnLc_trBAs1dmjH0Gw_UDZOhl6r";

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

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Prayer integration unavailable", error);
    return NextResponse.json(
      { error: "Integração temporariamente indisponível." },
      { status: 503 },
    );
  }
}
