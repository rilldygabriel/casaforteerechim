import { NextRequest, NextResponse } from "next/server";
import { getVercelOidcToken } from "@vercel/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_MEMBER_REGISTRATION_URL =
  "https://fjwkfpwraipxmcjlwssv.supabase.co/functions/v1/register-member";
const VERCEL_TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const VERCEL_PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";
const WHATSAPP_GRAPH_API_VERSION =
  process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
const WHATSAPP_NOTIFICATION_TO = "5554992640253";
const WHATSAPP_TEMPLATE_NAME = "notificacao_site_casa_forte";
const WHATSAPP_TEMPLATE_LANGUAGE = "pt_BR";

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

function clean(value: unknown, max = 600) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function memberNotification(payload: {
  fullName: string;
  email: string;
  phone: string;
}) {
  return [
    "NOVO MEMBRO — ÁREA DA FAMÍLIA",
    `Nome: ${clean(payload.fullName, 160)}`,
    `WhatsApp: ${clean(payload.phone, 40)}`,
    `E-mail: ${clean(payload.email, 254)}`,
    "Cadastro concluído e convite enviado por e-mail.",
  ].join(" | ");
}

async function notifyWhatsApp(
  payload: {
    fullName: string;
    email: string;
    phone: string;
  },
  requestId: string,
) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("WhatsApp member notification skipped: token missing", {
      requestId,
    });
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: WHATSAPP_NOTIFICATION_TO,
          type: "template",
          template: {
            name: WHATSAPP_TEMPLATE_NAME,
            language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
            components: [
              {
                type: "body",
                parameters: [
                  {
                    type: "text",
                    text: memberNotification(payload),
                  },
                ],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("WhatsApp member notification failed", {
        requestId,
        status: response.status,
        errorCode: result?.error?.code,
      });
      return;
    }

    console.info("WhatsApp member notification sent", {
      requestId,
      messageId: result?.messages?.[0]?.id || "without-message-id",
    });
  } catch (error) {
    console.error("WhatsApp member notification unavailable", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
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

    if (response.status === 201) {
      await notifyWhatsApp({ fullName, email, phone }, requestId);
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
