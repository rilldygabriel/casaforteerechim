import "server-only";

import { ensureEventTicket, eventTicketUrl } from "@/lib/event-tickets";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeWhatsappPhone, sendWhatsappNotification } from "@/lib/whatsapp";

const SENDER = "Igreja Casa Forte <no-reply@auth.casaforteerechim.app.br>";
const REAL_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DeliveryResult = "sent" | "failed" | "skipped" | "unavailable";

export type TicketDeliverySummary = {
  purchasers: number;
  ticketsIssued: number;
  email: Record<DeliveryResult, number>;
  whatsapp: Record<DeliveryResult, number>;
};

function emptyChannels(): Record<DeliveryResult, number> {
  return { sent: 0, failed: 0, skipped: 0, unavailable: 0 };
}

function deliverableEmail(value: string | null) {
  const email = String(value ?? "").trim().toLowerCase();
  if (!REAL_EMAIL.test(email)) return "";
  if (email.startsWith("hamburguer+") || email.endsWith("@membros.casaforteerechim.app.br")) return "";
  return email;
}

function deliverablePhone(value: string | null) {
  const phone = normalizeWhatsappPhone(value);
  return phone && !phone.startsWith("55000") ? phone : "";
}

function safeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}

async function sendEmail(input: { ticketId: string; email: string; name: string; simple: number; double: number; url: string }) {
  const firstName = safeHtml(input.name.split(" ")[0] || input.name);
  const order = `${input.simple} simples e ${input.double} duplos`;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `cf-event-ticket-${input.ticketId}`,
      },
      body: JSON.stringify({
        from: SENDER,
        to: [input.email],
        subject: "Seu ingresso — Hambúrguer da Casa",
        text: `Olá, ${input.name}. Seu pagamento foi confirmado. Pedido: ${order}. Abra seu ingresso e apresente o QR Code na retirada: ${input.url}`,
        html: `<div style="margin:0;padding:32px;background:#0b0d0b;color:#f7f7f2;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px;border:1px solid #303430;border-radius:24px;background:#111311"><p style="color:#fffe15;font-weight:800">IGREJA CASA FORTE</p><h1>Seu ingresso está pronto</h1><p style="color:#c7cac5;line-height:1.6">Olá, ${firstName}. Seu pagamento foi confirmado.</p><p style="font-size:18px"><strong>Pedido:</strong> ${order}</p><a href="${input.url}" style="display:inline-block;padding:16px 24px;border-radius:999px;background:#fffe15;color:#080908;font-weight:800;text-decoration:none">Abrir ingresso com QR Code</a><p style="color:#9ca19b;font-size:13px;line-height:1.5">Apresente o QR Code no momento da retirada. O ingresso pode ser utilizado somente uma vez.</p></div></div>`,
      }),
      signal: AbortSignal.timeout(15_000), cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !payload.id) throw new Error(payload.message || `Resend respondeu ${response.status}`);
    return "sent" as const;
  } catch {
    return "failed" as const;
  }
}

async function sendWhatsapp(input: { ticketId: string; phone: string; name: string; simple: number; double: number; url: string }) {
  const service = getSupabaseServiceClient();
  const firstName = input.name.split(" ")[0] || input.name;
  const message = `Olá, ${firstName}! Seu pagamento do Hambúrguer da Casa foi confirmado. Pedido: ${input.simple} simples e ${input.double} duplos. Abra o ingresso e apresente o QR Code na retirada: ${input.url}`;
  const { error: conversationError } = await service.from("whatsapp_conversations").upsert(
    { phone: input.phone, contact_name: input.name },
    { onConflict: "phone", ignoreDuplicates: false },
  );
  if (conversationError) return "failed" as const;
  const { data: conversation } = await service.from("whatsapp_conversations").select("id").eq("phone", input.phone).single();
  if (!conversation) return "failed" as const;
  const { data: existing } = await service.from("whatsapp_messages")
    .select("id,status").eq("conversation_id", conversation.id).eq("body", message).neq("status", "failed").maybeSingle();
  if (existing) return "skipped" as const;

  const placeholderId = `event-ticket:${input.ticketId}`;
  const { data: failed } = await service.from("whatsapp_messages").select("id").eq("wa_message_id", placeholderId).maybeSingle();
  let messageRowId = failed?.id;
  if (messageRowId) {
    await service.from("whatsapp_messages").update({ status: "sent", error_message: null, body: message }).eq("id", messageRowId);
  } else {
    const { data: reserved, error: reserveError } = await service.from("whatsapp_messages").insert({
      conversation_id: conversation.id,
      wa_message_id: placeholderId,
      direction: "outbound",
      message_type: "template",
      body: message,
      status: "sent",
      raw_payload: { campaign: "hamburger-event-ticket", state: "reserved" },
    }).select("id").single();
    if (reserveError || !reserved) return "failed" as const;
    messageRowId = reserved.id;
  }

  const result = await sendWhatsappNotification(input.phone, message);
  if (result.ok) {
    await service.from("whatsapp_messages").update({
      wa_message_id: result.messageId || placeholderId,
      raw_payload: { campaign: "hamburger-event-ticket", state: "accepted" },
    }).eq("id", messageRowId);
    await service.from("whatsapp_conversations").update({
      last_message_at: new Date().toISOString(), last_message_preview: message.slice(0, 180), updated_at: new Date().toISOString(),
    }).eq("id", conversation.id);
    return "sent" as const;
  }
  await service.from("whatsapp_messages").update({ status: "failed", error_message: result.error.slice(0, 300) }).eq("id", messageRowId);
  return "failed" as const;
}

export async function deliverHamburgerTickets(eventId: string): Promise<TicketDeliverySummary> {
  const service = getSupabaseServiceClient();
  const { data: registrations, error } = await service.from("event_registrations")
    .select("id,full_name,email,phone,phone_normalized,simple_quantity,double_quantity")
    .eq("event_id", eventId).eq("status", "confirmed").is("archived_at", null);
  if (error) throw error;

  const summary: TicketDeliverySummary = { purchasers: registrations?.length ?? 0, ticketsIssued: 0, email: emptyChannels(), whatsapp: emptyChannels() };
  for (const registration of registrations ?? []) {
    let { data: ticket, error: ticketError } = await service.from("event_tickets")
      .select("id,public_token,status").eq("registration_id", registration.id).maybeSingle();
    if (ticketError) continue;
    if (!ticket || ticket.status === "cancelled") {
      await ensureEventTicket({ eventId, registrationId: registration.id });
      const issued = await service.from("event_tickets").select("id,public_token,status").eq("registration_id", registration.id).single();
      ticket = issued.data;
      ticketError = issued.error;
    }
    if (ticketError || !ticket || ticket.status === "cancelled") continue;
    summary.ticketsIssued += 1;
    const email = deliverableEmail(registration.email);
    const phone = deliverablePhone(registration.phone_normalized || registration.phone);
    const common = { ticketId: ticket.id, name: registration.full_name, simple: Number(registration.simple_quantity), double: Number(registration.double_quantity), url: eventTicketUrl(ticket.public_token) };
    const [emailResult, whatsappResult] = await Promise.all([
      email ? sendEmail({ ...common, email }) : Promise.resolve("unavailable" as const),
      phone ? sendWhatsapp({ ...common, phone }) : Promise.resolve("unavailable" as const),
    ]);
    summary.email[emailResult] += 1;
    summary.whatsapp[whatsappResult] += 1;
  }
  return summary;
}
