import { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getNextSundayDate } from "@/lib/programs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_ANSWERS = new Set(["presencial", "nao_vou", "live"]);

function text(value: unknown, max: number) {
  return typeof value === "string"
    ? value
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const nome = text(body.nome, 120);
  const telefone = text(body.telefone, 30).replace(/\D/g, "");
  const resposta = text(body.resposta, 20);
  const eventDate = text(body.eventDate, 10);
  const expectedDate = getNextSundayDate();

  if (nome.length < 3) {
    return NextResponse.json(
      { error: "Informe seu nome completo." },
      { status: 400 },
    );
  }

  if (telefone.length < 10 || telefone.length > 13) {
    return NextResponse.json(
      { error: "Informe um WhatsApp válido com DDD." },
      { status: 400 },
    );
  }

  if (!VALID_ANSWERS.has(resposta) || eventDate !== expectedDate) {
    return NextResponse.json(
      { error: "Esta programação foi atualizada. Recarregue a página." },
      { status: 400 },
    );
  }

  const { url, publishableKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/culto_checkins`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      event_key: "domingo-casa",
      event_date: eventDate,
      event_title: "Culto Domingo na Casa",
      nome,
      telefone,
      resposta,
    }),
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });

  if (response.status === 409) {
    return NextResponse.json(
      {
        error:
          "Este WhatsApp já respondeu para este culto. Se precisar alterar, fale com a liderança.",
      },
      { status: 409 },
    );
  }

  if (!response.ok) {
    console.error("Falha ao registrar pré-check-in.", response.status);
    return NextResponse.json(
      { error: "Não foi possível registrar agora. Tente novamente." },
      { status: 503 },
    );
  }

  return NextResponse.json({
    message:
      resposta === "presencial"
        ? "Presença confirmada. Esperamos você na Casa!"
        : resposta === "live"
          ? "Resposta registrada. Nos encontramos pela live!"
          : "Resposta registrada. Sentiremos sua falta!",
  });
}
