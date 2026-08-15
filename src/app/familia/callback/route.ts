import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const providerError = request.nextUrl.searchParams.get("error");
  const providerErrorCode = request.nextUrl.searchParams.get("error_code");
  const providerErrorDescription =
    request.nextUrl.searchParams.get("error_description") ?? "";
  const hasCodeVerifier = request.cookies
    .getAll()
    .some(({ name }) => name.endsWith("-code-verifier"));
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
      hasCode: true,
      hasCodeVerifier,
    });
  } else {
    console.error("Callback da Área da Família recebido sem código.", {
      hasCode: false,
      hasCodeVerifier,
      providerError,
      providerErrorCode,
    });
  }

  const signupsDisabled = providerErrorDescription
    .toLocaleLowerCase("en-US")
    .includes("signups not allowed");
  const errorReason = signupsDisabled
    ? "cadastro-google-indisponivel"
    : providerError
      ? "google-nao-concluido"
      : "link-invalido";

  return NextResponse.redirect(
    new URL(`/familia/login?erro=${errorReason}`, request.url),
  );
}
