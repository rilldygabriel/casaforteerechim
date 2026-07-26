import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next =
    requestedNext?.startsWith("/familia") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/familia";

  if (code) {
    const { supabase, applyAuthState } = getSupabaseRouteClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return applyAuthState(
        NextResponse.redirect(new URL(next, request.url)),
      );
    }

    console.error("Falha no callback da Área da Família.", {
      errorCode: error.code,
      status: error.status,
    });
  }

  return NextResponse.redirect(
    new URL("/familia/login?erro=link-invalido", request.url),
  );
}
