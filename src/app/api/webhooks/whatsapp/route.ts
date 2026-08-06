import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const configuredToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  const receivedToken = search.get("hub.verify_token")?.trim();
  const valid = search.get("hub.mode") === "subscribe" &&
    Boolean(configuredToken) && receivedToken === configuredToken;
  console.info("whatsapp_webhook_verification", {
    valid,
    mode: search.get("hub.mode"),
    tokenConfigured: Boolean(configuredToken),
    challengePresent: search.has("hub.challenge"),
  });
  return valid
    ? new NextResponse(search.get("hub.challenge") ?? "", { status: 200 })
    : new NextResponse("Verificação recusada", { status: 403 });
}

function validSignature(raw: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!secret || !signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!validSignature(raw, signature)) {
    console.warn("whatsapp_webhook_invalid_signature", {
      secretConfigured: Boolean(process.env.WHATSAPP_APP_SECRET?.trim()),
      signaturePresent: Boolean(signature),
      payloadBytes: Buffer.byteLength(raw),
    });
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let payload: { entry?: Array<{ changes?: Array<{ value?: Record<string, unknown> }> }> };
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    console.warn("whatsapp_webhook_invalid_json", { error: String(error) });
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  let receivedMessages = 0;
  let savedMessages = 0;
  let deliveryUpdates = 0;
  let processingFailed = false;

  for (const entry of payload.entry ?? []) for (const change of entry.changes ?? []) {
    const value = (change.value ?? {}) as {
      contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
      messages?: Array<Record<string, any>>;
      statuses?: Array<Record<string, any>>;
    };
    const names = new Map((value.contacts ?? []).map((contact: { wa_id?: string; profile?: { name?: string } }) => [contact.wa_id, contact.profile?.name]));
    for (const message of value.messages ?? []) {
      receivedMessages += 1;
      const phone = String(message.from ?? "").replace(/\D/g, "");
      if (!phone || !message.id) continue;
      const body = message.text?.body ?? message.button?.text ?? message.interactive?.button_reply?.title ?? `[${message.type ?? "mensagem"}]`;
      const { data: conversation, error } = await supabase.from("whatsapp_conversations").upsert({
        phone, contact_name: names.get(phone) ?? null, last_message_at: new Date(Number(message.timestamp) * 1000).toISOString(),
        last_message_preview: String(body).slice(0, 240), updated_at: new Date().toISOString(),
      }, { onConflict: "phone" }).select("id,unread_count").single();
      if (error || !conversation) {
        processingFailed = true;
        console.error("whatsapp_webhook_conversation_failed", {
          messageId: message.id,
          error: error?.message ?? "Conversa não retornada",
        });
        continue;
      }
      const { error: insertError } = await supabase.from("whatsapp_messages").insert({
        conversation_id: conversation.id, wa_message_id: message.id, direction: "inbound",
        message_type: message.type ?? "text", body, media_id: message.image?.id ?? message.audio?.id ?? message.document?.id ?? null,
        status: "received", sent_at: new Date(Number(message.timestamp) * 1000).toISOString(), raw_payload: message,
      });
      if (!insertError) {
        savedMessages += 1;
        const { error: unreadError } = await supabase.from("whatsapp_conversations").update({ unread_count: conversation.unread_count + 1 }).eq("id", conversation.id);
        if (unreadError) {
          processingFailed = true;
          console.error("whatsapp_webhook_unread_count_failed", { messageId: message.id, error: unreadError.message });
        }
      } else if (insertError.code !== "23505") {
        processingFailed = true;
        console.error("whatsapp_webhook_message_failed", { messageId: message.id, error: insertError.message });
      }
    }
    for (const delivery of value.statuses ?? []) {
      const status = ["sent", "delivered", "read", "failed"].includes(delivery.status) ? delivery.status : "sent";
      const { error } = await supabase.from("whatsapp_messages").update({ status, error_message: delivery.errors?.[0]?.title ?? null }).eq("wa_message_id", delivery.id);
      if (error) {
        processingFailed = true;
        console.error("whatsapp_webhook_delivery_failed", { messageId: delivery.id, error: error.message });
      } else {
        deliveryUpdates += 1;
      }
    }
  }

  console.info("whatsapp_webhook_processed", { receivedMessages, savedMessages, deliveryUpdates, processingFailed });
  if (processingFailed) {
    return NextResponse.json({ error: "Falha ao persistir o webhook" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
