import { NextRequest, NextResponse } from "next/server";
import { getNextSundayDate } from "@/lib/programs";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

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

async function getApprovedMember(request: NextRequest) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, applyAuthState, user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("full_name,phone,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    applyAuthState,
    user,
    profile:
      profile?.approval_status === "approved" && profile.full_name.trim()
        ? profile
        : null,
  };
}

export async function GET(request: NextRequest) {
  const { supabase, applyAuthState, user, profile } =
    await getApprovedMember(request);

  if (!user) {
    return applyAuthState(
      NextResponse.json({ authenticated: false }, { status: 401 }),
    );
  }

  if (!profile) {
    return applyAuthState(
      NextResponse.json(
        {
          authenticated: true,
          approved: false,
          error: "Seu acesso de membro ainda não está liberado.",
        },
        { status: 403 },
      ),
    );
  }

  const eventDate = getNextSundayDate();
  const { data, error } = await supabase
    .from("culto_checkins")
    .select("resposta")
    .eq("event_key", "domingo-casa")
    .eq("event_date", eventDate)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return applyAuthState(
      NextResponse.json(
        { error: "Não foi possível carregar sua resposta." },
        { status: 503 },
      ),
    );
  }

  return applyAuthState(
    NextResponse.json({
      authenticated: true,
      approved: true,
      memberName: profile.full_name,
      answer: data?.resposta ?? null,
      eventDate,
    }),
  );
}

export async function POST(request: NextRequest) {
  const { supabase, applyAuthState, user, profile } =
    await getApprovedMember(request);

  if (!user) {
    return applyAuthState(
      NextResponse.json(
        { error: "Entre na Área de Membro para responder." },
        { status: 401 },
      ),
    );
  }

  if (!profile) {
    return applyAuthState(
      NextResponse.json(
        { error: "Seu acesso de membro ainda não está liberado." },
        { status: 403 },
      ),
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return applyAuthState(
      NextResponse.json({ error: "Dados inválidos." }, { status: 400 }),
    );
  }

  const resposta = text(body.resposta, 20);
  const eventDate = text(body.eventDate, 10);
  const expectedDate = getNextSundayDate();

  if (!VALID_ANSWERS.has(resposta) || eventDate !== expectedDate) {
    return applyAuthState(
      NextResponse.json(
        { error: "Esta programação foi atualizada. Recarregue a página." },
        { status: 400 },
      ),
    );
  }

  const normalizedPhone =
    (profile.phone ?? "").replace(/\D/g, "").slice(0, 13) || null;
  const { error } = await supabase.from("culto_checkins").upsert(
    {
      event_key: "domingo-casa",
      event_date: eventDate,
      event_title: "Culto Domingo na Casa",
      user_id: user.id,
      nome: profile.full_name.trim(),
      telefone: normalizedPhone,
      resposta,
    },
    { onConflict: "event_key,event_date,user_id" },
  );

  if (error) {
    console.error("Falha ao registrar pré-check-in de membro.", error.code);
    return applyAuthState(
      NextResponse.json(
        { error: "Não foi possível salvar agora. Tente novamente." },
        { status: 503 },
      ),
    );
  }

  return applyAuthState(
    NextResponse.json({
      answer: resposta,
      message: "Sua resposta ficou registrada.",
    }),
  );
}
