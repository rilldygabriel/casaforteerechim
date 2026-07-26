import { NextRequest, NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_MEMBER_REGISTRATION_URL =
  "https://fjwkfpwraipxmcjlwssv.supabase.co/functions/v1/register-member";
const VERCEL_TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const VERCEL_PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";

type MemberApplicationPayload = {
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
};

function text(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ")
    : "";
}

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

async function fingerprint(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  const bytes = new TextEncoder().encode(`${ip}|${userAgent}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: NextRequest) {
  let body: MemberApplicationPayload;

  try {
    body = (await request.json()) as MemberApplicationPayload;
  } catch {
    return jsonResponse(false, 400);
  }

  const fullName = text(body.fullName);
  const email = text(body.email).toLowerCase();
  const phone = text(body.phone);
  const phoneDigits = phone.replace(/\D/g, "");

  const invalid =
    fullName.length < 3 ||
    fullName.length > 160 ||
    email.length < 5 ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    phone.length > 30 ||
    phoneDigits.length < 10 ||
    phoneDigits.length > 15;

  if (invalid) {
    return jsonResponse(false, 400);
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("Credencial segura de e-mail indisponível no cadastro.");
    return jsonResponse(false, 503);
  }

  const requestId = crypto.randomUUID();

  try {
    const oidcToken = await getVercelOidcToken({
      team: VERCEL_TEAM_ID,
      project: VERCEL_PROJECT_ID,
      expirationBufferMs: 10_000,
    });
    const response = await fetch(SUPABASE_MEMBER_REGISTRATION_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oidcToken}`,
        "Content-Type": "application/json",
        "x-request-id": requestId,
        "x-resend-api-key": resendApiKey,
      },
      body: JSON.stringify({
        fullName,
        email,
        phone,
        fingerprint: await fingerprint(request),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("Falha protegida no cadastro da Área da Família.", {
        requestId,
        status: response.status,
      });
      return jsonResponse(false, response.status === 429 ? 429 : 502);
    }

    return jsonResponse(true, response.status === 201 ? 201 : 200);
  } catch (error) {
    console.error("Integração protegida da Família indisponível.", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonResponse(false, 503);
  }
}
