import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const valid = search.get("hub.mode") === "subscribe" &&
    search.get("hub.verify_token") === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  return valid && process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
    ? new NextResponse(search.get("hub.challenge") ?? "", { status: 200 })
    : new NextResponse("Verificação recusada", { status: 403 });
}

function validSignature(raw: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  const payload = JSON.parse(raw);
  const supabase = getSupabaseServiceClient();
  for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
    const value = change.value ?? {};
    const names = new Map((value.contacts ?? []).map((contact: { wa_id?: string; profile?: { name?: string } }) => [contact.wa_id, contact.profile?.name]));
    for (const message of value.messages ?? []) {
      const phone = String(message.from ?? "").replace(/\D/g, "");
      if (!phone || !message.id) continue;
      const body = message.text?.body ?? message.button?.text ?? message.interactive?.button_reply?.title ?? `[${message.type ?? "mensagem"}]`;
      const { data: conversation, error } = await supabase.from("whatsapp_conversations").upsert({
        phone, contact_name: names.get(phone) ?? null, last_message_at: new Date(Number(message.timestamp) * 1000).toISOString(),
        last_message_preview: String(body).slice(0, 240), updated_at: new Date().toISOString(),
      }, { onConflict: "phone" }).select("id,unread_count").single();
      if (error || !conversation) continue;
      const { error: insertError } = await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id, wa_message_id: message.id, direction: "inbound",
        message_type: message.type ?? "text", body, media_id: message.image?.id ?? message.audio?.id ?? message.document?.id ?? null,
        status: "received", sent_at: new Date(Number(message.timestamp) * 1000).toISOString(), raw_payload: message,
      });
      if (!insertError) await supabase.from("whatsapp_conversations").update({ unread_count: conversation.unread_count + 1 }).eq("id", conversation.id);
    }
    for (const delivery of value.statuses ?? []) {
      const status = ["sent", "delivered", "read", "failed"].includes(delivery.status) ? delivery.status : "sent";
      await supabase.from("whatsapp_messages").update({ status, error_message: delivery.errors?.[0]?.title ?? null }).eq("wa_message_id", delivery.id);
    }
  }
  return NextResponse.json({ received: true });
}
