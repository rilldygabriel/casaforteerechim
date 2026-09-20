import "server-only";

import { ensureEventTicket, eventTicketUrl } from "@/lib/event-tickets";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { normalizeWhatsappPhone, sendWhatsappNotification } from "@/lib/whatsapp";

const SENDER = "Igreja Casa Forte <no-reply@auth.casaforteerechim.app.br>";
const REAL_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Channel = "email" | "whatsapp";
type DeliveryResult = "sent" | "failed" | "skipped" | "unavailable";

export type TicketDeliverySummary = {
  purchasers: number;
  ticketsIssued: number;
  email: Record<DeliveryResult, number>;
  whatsapp: Record<DeliveryResult, number>;
};

export type EventTicketDelivery = {
  ticketUrl: string;
  email: DeliveryResult;
  whatsapp: DeliveryResult;
  emailSent: boolean;
  whatsappSent: boolean;
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

async function reserveDelivery(ticketId: string, channel: Channel, recipient: string) {
  const { data, error } = await getSupabaseServiceClient().rpc("claim_event_ticket_delivery", {
    p_ticket_id: ticketId,
    p_channel: channel,
    p_recipient: recipient,
  });
  if (error) throw error;
  return typeof data === "string" ? data : "";
}

async function finishDelivery(id: string, status: "sent" | "failed", providerMessageId?: string, errorMessage?: string) {
  const { error } = await getSupabaseServiceClient().from("event_ticket_deliveries").update({
    status,
    provider_message_id: providerMessageId || null,
    error_message: errorMessage?.slice(0, 500) || null,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) console.error("event_ticket_delivery_audit_error", error.message);
}

async function deliveryState(ticketId: string) {
  const { data } = await getSupabaseServiceClient().from("event_ticket_deliveries")
    .select("channel,status").eq("ticket_id", ticketId);
  return {
    emailSent: data?.some((item) => item.channel === "email" && item.status === "sent") ?? false,
    whatsappSent: data?.some((item) => item.channel === "whatsapp" && item.status === "sent") ?? false,
  };
}

async function resolveContacts(registration: { email: string | null; phone: string | null; phone_normalized: string | null }) {
  let email = deliverableEmail(registration.email);
  let phone = deliverablePhone(registration.phone_normalized || registration.phone);
  if (email && phone) return { email, phone };

  const { data: profiles } = await getSupabaseServiceClient().from("member_profiles").select("email,phone")
    .or("approval_status.eq.approved,is_admin.eq.true");
  for (const profile of profiles ?? []) {
    const profileEmail = deliverableEmail(profile.email);
    const profilePhone = deliverablePhone(profile.phone);
    const sameEmail = Boolean(email && profileEmail === email);
    const samePhone = Boolean(phone && profilePhone === phone);
    if (!sameEmail && !samePhone) continue;
    email ||= profileEmail;
    phone ||= profilePhone;
    if (email && phone) break;
  }
  return { email, phone };
}

async function sendEmail(input: { ticketId: string; email: string; name: string; eventTitle: string; details: string; url: string }) {
  const deliveryId = await reserveDelivery(input.ticketId, "email", input.email);
  if (!deliveryId) return "skipped" as const;
  const firstName = safeHtml(input.name.split(" ")[0] || input.name);
  const eventTitle = safeHtml(input.eventTitle);
  const details = safeHtml(input.details);
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
        subject: `Seu ingresso — ${input.eventTitle}`,
        text: `Olá, ${input.name}. Seu pagamento foi confirmado para ${input.eventTitle}. ${input.details}. Abra seu ingresso e apresente o QR Code: ${input.url}`,
        html: `<div style="margin:0;padding:32px;background:#0b0d0b;color:#f7f7f2;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:32px;border:1px solid #303430;border-radius:24px;background:#111311"><p style="color:#fffe15;font-weight:800">IGREJA CASA FORTE</p><h1>Seu ingresso está pronto</h1><p style="color:#c7cac5;line-height:1.6">Olá, ${firstName}. Seu pagamento para <strong>${eventTitle}</strong> foi confirmado.</p><p style="font-size:18px"><strong>${details}</strong></p><a href="${input.url}" style="display:inline-block;padding:16px 24px;border-radius:999px;background:#fffe15;color:#080908;font-weight:800;text-decoration:none">Abrir ingresso com QR Code</a><p style="color:#9ca19b;font-size:13px;line-height:1.5">Apresente o QR Code no evento. O ingresso pode ser utilizado somente uma vez.</p></div></div>`,
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (!response.ok || !payload.id) throw new Error(payload.message || `Resend respondeu ${response.status}`);
    await finishDelivery(deliveryId, "sent", payload.id);
    return "sent" as const;
  } catch (error) {
    await finishDelivery(deliveryId, "failed", undefined, error instanceof Error ? error.message : "Falha no e-mail");
    return "failed" as const;
  }
}

async function sendWhatsapp(input: { ticketId: string; phone: string; name: string; eventTitle: string; details: string; url: string }) {
  const deliveryId = await reserveDelivery(input.ticketId, "whatsapp", input.phone);
  if (!deliveryId) return "skipped" as const;
  const service = getSupabaseServiceClient();
  const firstName = input.name.split(" ")[0] || input.name;
  const message = input.details.startsWith("Pedido:")
    ? `Olá, ${firstName}! Seu pagamento do ${input.eventTitle} foi confirmado. ${input.details}. Abra o ingresso e apresente o QR Code na retirada: ${input.url}`
    : `Olá, ${firstName}! Seu pagamento para ${input.eventTitle} foi confirmado. ${input.details}. Abra o ingresso e apresente o QR Code: ${input.url}`;
  const { error: conversationError } = await service.from("whatsapp_conversations").upsert(
    { phone: input.phone, contact_name: input.name },
    { onConflict: "phone", ignoreDuplicates: false },
  );
  if (conversationError) {
    await finishDelivery(deliveryId, "failed", undefined, conversationError.message);
    return "failed" as const;
  }
  const { data: conversation } = await service.from("whatsapp_conversations").select("id").eq("phone", input.phone).single();
  if (!conversation) {
    await finishDelivery(deliveryId, "failed", undefined, "Conversa não encontrada");
    return "failed" as const;
  }

  const { data: existing } = await service.from("whatsapp_messages")
    .select("wa_message_id").eq("conversation_id", conversation.id).eq("body", message).neq("status", "failed").maybeSingle();
  if (existing) {
    await finishDelivery(deliveryId, "sent", existing.wa_message_id);
    return "skipped" as const;
  }

  const placeholderId = `event-ticket:${input.ticketId}`;
  const { data: reserved, error: reserveError } = await service.from("whatsapp_messages").upsert({
    conversation_id: conversation.id,
    wa_message_id: placeholderId,
    direction: "outbound",
    message_type: "template",
    body: message,
    status: "sent",
    error_message: null,
    raw_payload: { campaign: "event-ticket", state: "reserved" },
  }, { onConflict: "wa_message_id" }).select("id").single();
  if (reserveError || !reserved) {
    await finishDelivery(deliveryId, "failed", undefined, reserveError?.message || "Não foi possível reservar a mensagem");
    return "failed" as const;
  }

  const result = await sendWhatsappNotification(input.phone, message);
  if (result.ok) {
    await service.from("whatsapp_messages").update({
      wa_message_id: result.messageId || placeholderId,
      raw_payload: { campaign: "event-ticket", state: "accepted" },
    }).eq("id", reserved.id);
    await service.from("whatsapp_conversations").update({
      last_message_at: new Date().toISOString(), last_message_preview: message.slice(0, 180), updated_at: new Date().toISOString(),
    }).eq("id", conversation.id);
    await finishDelivery(deliveryId, "sent", result.messageId);
    return "sent" as const;
  }
  await service.from("whatsapp_messages").update({ status: "failed", error_message: result.error.slice(0, 300) }).eq("id", reserved.id);
  await finishDelivery(deliveryId, "failed", undefined, result.error);
  return "failed" as const;
}

export async function deliverEventTicket(input: { eventId: string; registrationId: string }): Promise<EventTicketDelivery> {
  const service = getSupabaseServiceClient();
  const [{ data: event }, { data: registration }] = await Promise.all([
    service.from("events").select("title").eq("id", input.eventId).maybeSingle(),
    service.from("event_registrations").select("full_name,email,phone,phone_normalized,simple_quantity,double_quantity,status,archived_at").eq("id", input.registrationId).maybeSingle(),
  ]);
  if (!event || !registration || registration.archived_at || registration.status !== "confirmed") throw new Error("Inscrição confirmada não encontrada.");

  const issued = await ensureEventTicket(input);
  const { data: ticket, error: ticketError } = await service.from("event_tickets")
    .select("id,public_token,status").eq("registration_id", input.registrationId).single();
  if (ticketError || !ticket || ticket.status === "cancelled") throw new Error("Ingresso não disponível.");
  const contacts = await resolveContacts(registration);
  const simple = Number(registration.simple_quantity);
  const double = Number(registration.double_quantity);
  const details = simple + double > 0 ? `Pedido: ${simple} simples e ${double} duplos` : `Evento: ${event.title}`;
  const common = { ticketId: ticket.id, name: registration.full_name, eventTitle: event.title, details, url: issued.url };
  const [email, whatsapp] = await Promise.all([
    contacts.email ? sendEmail({ ...common, email: contacts.email }) : Promise.resolve("unavailable" as const),
    contacts.phone ? sendWhatsapp({ ...common, phone: contacts.phone }) : Promise.resolve("unavailable" as const),
  ]);
  const state = await deliveryState(ticket.id);
  return { ticketUrl: issued.url, email, whatsapp, ...state };
}

export async function getEventTicketDeliveryState(registrationId: string) {
  const service = getSupabaseServiceClient();
  const { data: ticket } = await service.from("event_tickets").select("id,public_token").eq("registration_id", registrationId).maybeSingle();
  if (!ticket) return { ticketUrl: undefined, emailSent: false, whatsappSent: false };
  return { ticketUrl: eventTicketUrl(ticket.public_token), ...(await deliveryState(ticket.id)) };
}

export async function deliverHamburgerTickets(eventId: string): Promise<TicketDeliverySummary> {
  const service = getSupabaseServiceClient();
  const { data: registrations, error } = await service.from("event_registrations").select("id")
    .eq("event_id", eventId).eq("status", "confirmed").is("archived_at", null);
  if (error) throw error;

  const summary: TicketDeliverySummary = { purchasers: registrations?.length ?? 0, ticketsIssued: 0, email: emptyChannels(), whatsapp: emptyChannels() };
  for (const registration of registrations ?? []) {
    try {
      const delivery = await deliverEventTicket({ eventId, registrationId: registration.id });
      summary.ticketsIssued += 1;
      summary.email[delivery.email] += 1;
      summary.whatsapp[delivery.whatsapp] += 1;
    } catch {
      summary.email.failed += 1;
      summary.whatsapp.failed += 1;
    }
  }
  return summary;
}
