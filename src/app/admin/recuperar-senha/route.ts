import { NextRequest, NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";

type RecoveryRequest = {
  email?: unknown;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_EMAIL = "ragrilldy@gmail.com";
const SITE_ORIGIN = "https://www.casaforteerechim.app.br";
const SUPABASE_RECOVERY_URL =
  "https://fjwkfpwraipxmcjlwssv.supabase.co/functions/v1/admin-password-recovery";
const VERCEL_TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const VERCEL_PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";

function jsonResponse(ok: boolean, status: number) {
  return NextResponse.json(
    { ok },
    {
      status,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  let body: RecoveryRequest;

  try {
    body = (await request.json()) as RecoveryRequest;
  } catch {
    return jsonResponse(false, 400);
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return jsonResponse(false, 400);
  }

  if (request.headers.get("origin") !== SITE_ORIGIN) {
    return jsonResponse(false, 403);
  }

  // Resposta neutra para não revelar quais endereços possuem acesso.
  if (email !== ADMIN_EMAIL) {
    return jsonResponse(true, 200);
  }

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error("Recuperação administrativa sem credencial de e-mail.");
    return jsonResponse(false, 502);
  }

  const requestId = crypto.randomUUID();

  try {
    const oidcToken = await getVercelOidcToken({
      team: VERCEL_TEAM_ID,
      project: VERCEL_PROJECT_ID,
      expirationBufferMs: 10_000,
    });

    const response = await fetch(SUPABASE_RECOVERY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oidcToken}`,
        "Content-Type": "application/json",
        "x-request-id": requestId,
        "x-resend-api-key": resendApiKey,
      },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });

    if (response.status === 429) {
      return jsonResponse(false, 429);
    }

    if (!response.ok) {
      console.error("Falha protegida na recuperação administrativa.", {
        requestId,
        status: response.status,
      });
      return jsonResponse(false, 502);
    }

    return jsonResponse(true, 200);
  } catch (error) {
    console.error("Falha ao iniciar recuperação administrativa.", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonResponse(false, 502);
  }
}
