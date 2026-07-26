import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const hasCodeVerifier = request.cookies
    .getAll()
    .some(({ name }) => name.endsWith("-code-verifier"));
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next =
    requestedNext?.startsWith("/admin") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/admin";

  if (code) {
    const { supabase, applyAuthState } = getSupabaseRouteClient(request);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return applyAuthState(
        NextResponse.redirect(new URL(next, request.url)),
      );
    }

    console.error("Falha no callback administrativo do Supabase.", {
      errorCode: error.code,
      status: error.status,
      hasCode: true,
      hasCodeVerifier,
    });
  } else {
    console.error("Callback administrativo recebido sem código.", {
      hasCode: false,
      hasCodeVerifier,
    });
  }

  return NextResponse.redirect(
    new URL("/admin/login?erro=link-invalido", request.url),
  );
}
