import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_ORIGIN = "https://www.casaforteerechim.app.br";
const SENDER = "Igreja Casa Forte <no-reply@auth.casaforteerechim.app.br>";
const COOLDOWN_MS = 60_000;
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
const WHATSAPP_TEMPLATE = process.env.WHATSAPP_MEMBER_INVITE_TEMPLATE_NAME || "acesso_area_familia";

function response(status = 200) {
  return NextResponse.json({ ok: status < 400 }, { status, headers: { "Cache-Control": "no-store, max-age=0" } });
}

function normalizePhone(value: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits : "";
}

async function sendEmail(email: string, fullName: string, inviteUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY ausente");
  const safeName = fullName.replace(/[<>&"']/g, "");
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `cf-member-self-resend-${crypto.randomUUID()}`,
    },
    body: JSON.stringify({
      from: SENDER,
      to: [email],
      subject: "Novo link da Área da Família — Igreja Casa Forte",
      text: `Olá, ${safeName}. Use este novo link para criar sua senha: ${inviteUrl}\n\nIgreja Casa Forte`,
      html: `<div style="margin:0;padding:32px;background:#0b0d0b;color:#f7f7f2;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px;border:1px solid #303430;border-radius:24px;background:#111311"><p style="color:#fffe15;font-weight:800">IGREJA CASA FORTE</p><h1>Novo link de acesso</h1><p style="color:#c7cac5;line-height:1.6">Olá, ${safeName}. Clique abaixo para criar sua senha da Área da Família.</p><a href="${inviteUrl}" style="display:inline-block;padding:16px 24px;border-radius:999px;background:#fffe15;color:#080908;font-weight:800;text-decoration:none">Criar minha senha</a></div></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!result.ok) throw new Error(`Resend respondeu ${result.status}`);
}

async function sendWhatsApp(phone: string | null, fullName: string, inviteUrl: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipient = normalizePhone(phone);
  if (!accessToken || !recipient) return;
  const result = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "template",
      template: {
        name: WHATSAPP_TEMPLATE,
        language: { code: "pt_BR" },
        components: [{ type: "body", parameters: [
          { type: "text", text: fullName.split(" ")[0] || fullName },
          { type: "text", text: inviteUrl },
        ] }],
      },
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!result.ok) console.error("member_self_resend_whatsapp_failed", { status: result.status });
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const body = await request.json().catch(() => ({})) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return response(400);

  const service = getSupabaseServiceClient();
  const { data: application, error: lookupError } = await service.from("member_applications")
    .select("id,auth_user_id,full_name,email,phone,status,updated_at")
    .eq("email", email)
    .maybeSingle();
  if (lookupError) {
    console.error("member_self_resend_lookup_failed", { requestId, code: lookupError.code });
    return response(503);
  }
  if (!application?.auth_user_id || application.status === "rejected") return response();

  const cutoff = new Date(Date.now() - COOLDOWN_MS).toISOString();
  const { data: claim, error: claimError } = await service.from("member_applications")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", application.id)
    .lt("updated_at", cutoff)
    .select("id")
    .maybeSingle();
  if (claimError) {
    console.error("member_self_resend_claim_failed", { requestId, code: claimError.code });
    return response(503);
  }
  if (!claim) return response(429);

  const { data: linkData, error: linkError } = await service.auth.admin.generateLink({ type: "recovery", email });
  const token = linkData?.properties?.hashed_token;
  if (linkError || !token || linkData.user?.id !== application.auth_user_id) {
    console.error("member_self_resend_link_failed", { requestId, code: linkError?.code });
    return response(503);
  }

  const inviteUrl = `${SITE_ORIGIN}/familia/aceitar-convite#token_hash=${encodeURIComponent(token)}&type=recovery`;
  try {
    await sendEmail(email, application.full_name, inviteUrl);
    await sendWhatsApp(application.phone, application.full_name, inviteUrl);
    console.info("member_self_resend_sent", { requestId, applicationId: application.id });
    return response();
  } catch (error) {
    console.error("member_self_resend_failed", { requestId, error: error instanceof Error ? error.message : "unknown" });
    return response(503);
  }
}
