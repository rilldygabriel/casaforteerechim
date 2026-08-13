"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

async function authorizedAdmin() {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;
  const { data } = await client.from("member_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  return data?.is_admin === true;
}

export async function sendWhatsAppReply(formData: FormData) {
  if (!(await authorizedAdmin())) throw new Error("Acesso não autorizado");
  const conversationId = Number(formData.get("conversationId"));
  const text = String(formData.get("message") ?? "").trim().slice(0, 4000);
  if (!Number.isSafeInteger(conversationId) || !text) return;
  const supabase = getSupabaseServiceClient();
  const { data: conversation } = await supabase.from("whatsapp_conversations").select("id,phone").eq("id", conversationId).single();
  if (!conversation) return;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
  if (!token) throw new Error("WhatsApp não configurado");
  const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0"}/${phoneNumberId}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: conversation.phone, type: "text", text: { body: text } }),
  });
  const result = await response.json();
  if (!response.ok || !result.messages?.[0]?.id) throw new Error("Não foi possível enviar a mensagem");
  await supabase.from("whatsapp_messages").insert({ conversation_id: conversation.id, wa_message_id: result.messages[0].id, direction: "outbound", message_type: "text", body: text, status: "sent" });
  await supabase.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString(), last_message_preview: text, unread_count: 0, updated_at: new Date().toISOString() }).eq("id", conversation.id);
  revalidatePath("/admin/whatsapp");
}
