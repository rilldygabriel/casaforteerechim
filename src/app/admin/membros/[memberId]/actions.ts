"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export type WhatsAppResetState = {
  kind: "idle" | "success" | "error";
  message: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SITE_ORIGIN = "https://www.casaforteerechim.app.br";

function whatsappRecipient(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return digits;
  return null;
}

export async function sendPasswordResetWhatsApp(
  _previousState: WhatsAppResetState,
  formData: FormData,
): Promise<WhatsAppResetState> {
  const memberId = String(formData.get("memberId") ?? "");
  if (!UUID_PATTERN.test(memberId)) return { kind: "error", message: "Membro inválido." };

  const sessionClient = await getSupabaseServerClient();
  const { data: { user } } = await sessionClient.auth.getUser();
  if (!user) return { kind: "error", message: "Sua sessão expirou." };
  const { data: admin } = await sessionClient.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!admin?.is_admin || admin.approval_status !== "approved") return { kind: "error", message: "Ação não autorizada." };

  const service = getSupabaseServiceClient();
  const { data: member } = await service.from("member_profiles").select("email,phone,full_name,approval_status").eq("user_id", memberId).maybeSingle();
  if (!member?.email || member.approval_status !== "approved") return { kind: "error", message: "Esta conta ainda não pode redefinir a senha." };
  const recipient = whatsappRecipient(member.phone ?? "");
  if (!recipient) return { kind: "error", message: "Cadastre um WhatsApp válido para esta pessoa." };

  const { data, error } = await service.auth.admin.generateLink({ type: "recovery", email: member.email });
  const token = data?.properties?.hashed_token;
  if (error || !token) return { kind: "error", message: "Não foi possível gerar o link agora." };
  const resetUrl = `${SITE_ORIGIN}/familia/aceitar-convite#token_hash=${encodeURIComponent(token)}&type=recovery`;

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
  if (!accessToken) return { kind: "error", message: "O WhatsApp oficial não está configurado." };
  const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0"}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipient,
      type: "template",
      template: {
        name: process.env.WHATSAPP_MEMBER_INVITE_TEMPLATE_NAME || "acesso_area_familia",
        language: { code: "pt_BR" },
        components: [{ type: "body", parameters: [
          { type: "text", text: (member.full_name || "Membro").split(" ")[0] },
          { type: "text", text: resetUrl },
        ] }],
      },
    }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  const result = await response.json();
  if (!response.ok || !result?.messages?.[0]?.id) return { kind: "error", message: "O WhatsApp recusou o envio. Tente por e-mail." };
  return { kind: "success", message: "Link de redefinição enviado pelo WhatsApp." };
}
