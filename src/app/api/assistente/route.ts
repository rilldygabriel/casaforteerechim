import { createHmac } from "node:crypto";
import { streamText } from "ai";
import { NextResponse } from "next/server";

import { CHURCH_EVENTS, getSaoPauloDateKey } from "@/lib/calendar-events";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "openai/gpt-5.6-terra";

function clientKey(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) throw new Error("Limite de uso não configurado.");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "sem-ip";
  const agent = request.headers.get("user-agent") || "sem-agente";
  return createHmac("sha256", secret).update(`${ip}|${agent}`).digest("hex");
}

export async function POST(request: Request) {
  let input: { question?: unknown; history?: unknown };
  try { input = await request.json(); }
  catch { return NextResponse.json({ error: "Mensagem inválida." }, { status: 400 }); }
  const question = String(input.question ?? "").trim();
  if (question.length < 2 || question.length > 500) {
    return NextResponse.json({ error: "Escreva uma pergunta de até 500 caracteres." }, { status: 400 });
  }
  const key = clientKey(request);
  const service = getSupabaseServiceClient();
  const hourAgo = new Date(Date.now() - 60 * 60_000).toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [{ count: hourly }, { count: daily }] = await Promise.all([
    service.from("assistant_generations").select("id", { count: "exact", head: true }).eq("client_key", key).gte("created_at", hourAgo),
    service.from("assistant_generations").select("id", { count: "exact", head: true }).eq("client_key", key).gte("created_at", dayAgo),
  ]);
  if ((hourly ?? 0) >= 8 || (daily ?? 0) >= 25) {
    return NextResponse.json({ error: "Você chegou ao limite temporário de perguntas. Tente novamente mais tarde." }, { status: 429 });
  }
  const { data: generation, error: reservationError } = await service.from("assistant_generations")
    .insert({ client_key: key, question, model: MODEL, status: "pending" }).select("id").single();
  if (reservationError || !generation) return NextResponse.json({ error: "Assistente temporariamente indisponível." }, { status: 503 });
  const generationId = generation.id as number;
  try {
    const [{ data: knowledge, error: knowledgeError }, { data: dynamicEvents, error: eventError }] = await Promise.all([
      service.from("assistant_knowledge").select("question,answer,source_url")
        .eq("published", true).order("sort_order").limit(60),
      service.from("events").select("title,description,start_date,start_time,location,slug,registration_enabled,registration_status")
        .eq("is_public", true).eq("status", "confirmed").gte("start_date", getSaoPauloDateKey())
        .order("start_date").limit(15),
    ]);
    if (knowledgeError || eventError) throw new Error("base_indisponivel");
    const today = getSaoPauloDateKey();
    const calendar = CHURCH_EVENTS.filter((item) => item.status === "confirmed" &&
      !item.internal && (item.endDate ?? item.startDate) >= today).slice(0, 15)
      .map((item) => ({ titulo: item.title, data: item.startDate, horario: item.startTime ?? null,
        local: item.location ?? null, inscricao: item.registrationSlug ? `/eventos/${item.registrationSlug}` : null }));
    const history = Array.isArray(input.history) ? input.history.slice(-4)
      .filter((item) => item && typeof item === "object" && ["user", "assistant"].includes(String(item.role)))
      .map((item) => ({ papel: item.role, texto: String(item.text ?? "").slice(0, 350) })) : [];
    const result = streamText({
      model: MODEL,
      maxOutputTokens: 380,
      system: [
        "Você é a IA da Igreja Casa Forte Erechim. Responda de forma acolhedora, concisa e objetiva em português brasileiro; geralmente em até três frases.",
        "Use APENAS a base pública e os eventos fornecidos. Se não houver informação suficiente, diga que não sabe e indique o contato da Casa.",
        "Não invente datas, valores, disponibilidade, pessoas, aprovação ou ensinamentos oficiais da igreja.",
        "Nunca consulte, peça nem revele dados privados de membros, discipulados ou financeiro.",
        "Este chat público não executa alterações administrativas. Pedidos de editar o site precisam ir ao assistente privado do pastor.",
        "Se citar uma página, use somente os caminhos/URLs da base. Nunca diga que algo foi publicado sem prova.",
      ].join("\n"),
      prompt: JSON.stringify({ hoje: today, base: knowledge, calendario: calendar, eventos: dynamicEvents,
        historico: history, pergunta: question }),
      onFinish: async ({ text, usage }) => {
        const answer = text.trim().slice(0, 1800) || "Não encontrei essa informação na base da Casa. Fale conosco pelo botão do site.";
        await service.from("assistant_generations").update({ answer, status: "completed", usage,
          completed_at: new Date().toISOString() }).eq("id", generationId);
      },
      onError: async ({ error }) => {
        const code = error instanceof Error ? error.message.slice(0, 80) : "erro_stream";
        await service.from("assistant_generations").update({ status: "failed", error_code: code,
          completed_at: new Date().toISOString() }).eq("id", generationId);
        console.error("site_assistant_stream_failed", { id: generationId, code });
      },
    });
    return result.toTextStreamResponse({ headers: { "Cache-Control": "no-store", "X-Assistant-Generation-Id": String(generationId) } });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : "erro";
    await service.from("assistant_generations").update({ status: "failed", error_code: code,
      completed_at: new Date().toISOString() }).eq("id", generationId);
    console.error("site_assistant_failed", { id: generationId, code });
    return NextResponse.json({ error: "Não consegui responder agora. Tente novamente em alguns minutos." }, { status: 503 });
  }
}
