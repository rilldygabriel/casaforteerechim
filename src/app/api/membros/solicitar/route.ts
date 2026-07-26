import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://fjwkfpwraipxmcjlwssv.supabase.co";
const SUPABASE_KEY = "sb_publishable_OX9MFnLc_trBAs1dmjH0Gw_UDZOhl6r";

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

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/member_applications`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
        }),
        cache: "no-store",
      },
    );

    // Resposta neutra em duplicidade para não revelar solicitações existentes.
    if (response.status === 409) {
      return jsonResponse(true, 200);
    }

    if (!response.ok) {
      console.error("Falha ao registrar solicitação da Área da Família.", {
        status: response.status,
      });
      return jsonResponse(false, 502);
    }

    return jsonResponse(true, 201);
  } catch (error) {
    console.error("Integração de solicitações da Família indisponível.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return jsonResponse(false, 503);
  }
}
