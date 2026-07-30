import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

const VALID_STATUS = new Set(["pendente", "presente", "ausente"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return applyAuthState(
      NextResponse.json({ error: "Sessão expirada." }, { status: 401 }),
    );
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return applyAuthState(
      NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 }),
    );
  }

  const { id } = await context.params;
  const checkinId = Number(id);
  const body = (await request.json()) as { status?: unknown };
  const status = typeof body.status === "string" ? body.status : "";

  if (!Number.isInteger(checkinId) || !VALID_STATUS.has(status)) {
    return applyAuthState(
      NextResponse.json({ error: "Dados inválidos." }, { status: 400 }),
    );
  }

  const { error } = await supabase
    .from("culto_checkins")
    .update({
      presenca_status: status,
      presenca_registrada_em:
        status === "pendente" ? null : new Date().toISOString(),
    })
    .eq("id", checkinId);

  if (error) {
    return applyAuthState(
      NextResponse.json(
        { error: "Não foi possível registrar a presença." },
        { status: 503 },
      ),
    );
  }

  return applyAuthState(NextResponse.json({ status }));
}
