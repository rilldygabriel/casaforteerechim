import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

type RecoveryRequest = {
  email?: unknown;
};

export async function POST(request: NextRequest) {
  let body: RecoveryRequest;

  try {
    body = (await request.json()) as RecoveryRequest;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const redirectTo = new URL("/admin/callback", request.nextUrl.origin);
  redirectTo.searchParams.set("next", "/admin/redefinir-senha");

  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo.toString(),
  });

  if (error) {
    console.error("Falha ao solicitar recuperação administrativa.", {
      errorCode: error.code,
      status: error.status,
    });

    return NextResponse.json(
      { ok: false },
      { status: error.status === 429 ? 429 : 400 },
    );
  }

  return applyAuthState(NextResponse.json({ ok: true }));
}
