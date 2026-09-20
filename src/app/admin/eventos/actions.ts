"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EVENT_STATUS_VALUES, REGISTRATION_STATUS_VALUES, normalizePhone, slugifyEvent } from "@/lib/events";
import { getEventAdminScope } from "@/lib/event-admin-server";
import { deliverEventTicket } from "@/lib/event-ticket-delivery";
import { getSupabaseServerClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const scope = await getEventAdminScope(user.id);
  if (!scope.hasAccess) redirect("/admin");
  return { ...scope, userId: user.id };
}

function value(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }
function nullable(value: string) { return value || null; }
function moneyCents(input: string) { const normalized = input.replace(/\s/g, "").replace(/R\$/gi, "").replace(/\./g, "").replace(",", "."); const amount = Number(normalized || 0); return Number.isFinite(amount) ? Math.round(amount * 100) : -1; }
function back(message: string, tab = "eventos"): never { redirect(`/admin/eventos?tab=${tab}&mensagem=${encodeURIComponent(message)}`); }

export async function createManualTicket(formData: FormData) {
  const scope = await requireAdmin();
  if (!scope.manualTicketAccess) redirect("/admin/eventos?tab=inscricoes");

  const eventId = value(formData, "eventId");
  const fullName = value(formData, "fullName");
  const email = value(formData, "email").toLowerCase();
  const phone = value(formData, "phone");
  const normalizedPhone = normalizePhone(phone);
  const simpleQuantity = Number(value(formData, "simpleQuantity") || 0);
  const doubleQuantity = Number(value(formData, "doubleQuantity") || 0);
  if (!eventId || !scope.canManage(eventId)) redirect("/admin/eventos?tab=inscricoes");
  if (fullName.length < 3 || normalizedPhone.length < 10 || normalizedPhone.length > 13 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    back("Revise o nome e os dados de contato do participante.", "inscricoes");
  }
  if (![simpleQuantity, doubleQuantity].every((quantity) => Number.isInteger(quantity) && quantity >= 0 && quantity <= 100)) {
    back("As quantidades do pedido são inválidas.", "inscricoes");
  }

  const { data: event } = await scope.service.from("events")
    .select("id,title,slug,status,archived_at,capacity,registration_fee_cents")
    .eq("id", eventId).maybeSingle();
  if (!event || event.archived_at || event.status === "cancelled") back("Este evento não está disponível para venda.", "inscricoes");
  const isBurger = event.slug === "hamburguer-da-casa-20-09";
  const itemQuantity = isBurger ? simpleQuantity + doubleQuantity : 1;
  const amountCents = isBurger ? simpleQuantity * 2_000 + doubleQuantity * 3_000 : Number(event.registration_fee_cents);
  if (isBurger && (itemQuantity < 1 || itemQuantity > 100)) back("Escolha ao menos um item, com limite total de 100.", "inscricoes");
  if (amountCents <= 0) back("Este evento não possui valor configurado para venda.", "inscricoes");

  const { data: existing } = await scope.service.from("event_registrations").select("id")
    .eq("event_id", eventId).eq("phone_normalized", normalizedPhone).maybeSingle();
  if (existing) back("Este telefone já possui inscrição neste evento.", "inscricoes");
  if (event.capacity !== null) {
    const { data: active } = await scope.service.from("event_registrations")
      .select("simple_quantity,double_quantity,status").eq("event_id", eventId).is("archived_at", null);
    const reserved = (active ?? []).filter((item) => !["cancelled", "rejected", "withdrew"].includes(item.status))
      .reduce((sum, item) => sum + (isBurger ? Number(item.simple_quantity) + Number(item.double_quantity) : 1), 0);
    if (reserved + itemQuantity > event.capacity) back("Não há vagas suficientes para este pedido.", "inscricoes");
  }

  let registrationId = "";
  let paymentId = "";
  try {
    const { data: registration, error: registrationError } = await scope.service.from("event_registrations").insert({
      event_id: eventId,
      full_name: fullName,
      email: email || null,
      phone,
      phone_normalized: normalizedPhone,
      attendance_duration: "not_attending",
      notes: "Ingresso manual · pagamento em dinheiro",
      status: "confirmed",
      consent: true,
      simple_quantity: isBurger ? simpleQuantity : 0,
      double_quantity: isBurger ? doubleQuantity : 0,
      order_total_cents: amountCents,
    }).select("id").single();
    if (registrationError || !registration) throw registrationError ?? new Error("REGISTRATION_NOT_CREATED");
    registrationId = registration.id;

    const { data: payment, error: paymentError } = await scope.service.from("mercado_pago_payments").insert({
      purpose: "event",
      payment_provider: "manual",
      event_id: eventId,
      registration_id: registrationId,
      payer_name: fullName,
      payer_email: email || null,
      payer_phone: phone,
      amount_cents: amountCents,
      status: "approved",
      status_detail: "manual_cash",
      payment_method_id: "cash",
      payment_type_id: "cash",
      net_received_cents: amountCents,
      approved_at: new Date().toISOString(),
      created_by: scope.userId,
      whatsapp_notification_status: "skipped",
    }).select("id").single();
    if (paymentError || !payment) throw paymentError ?? new Error("PAYMENT_NOT_CREATED");
    paymentId = payment.id;

    const { error: ticketError } = await scope.service.from("event_tickets").insert({ event_id: eventId, registration_id: registrationId });
    if (ticketError) throw ticketError;
    const { error: financeError } = await scope.service.from("finance_income_entries").insert({
      transaction_date: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
      description: `Ingresso em dinheiro · ${event.title}`,
      amount_cents: amountCents,
      fingerprint: `manual_event_ticket|${paymentId}`,
      source: "manual",
      created_by: scope.userId,
      mercado_pago_payment_id: paymentId,
    });
    if (financeError) throw financeError;
  } catch (error) {
    if (paymentId) await scope.service.from("finance_income_entries").delete().eq("mercado_pago_payment_id", paymentId);
    if (registrationId) await scope.service.from("event_tickets").delete().eq("registration_id", registrationId);
    if (paymentId) await scope.service.from("mercado_pago_payments").delete().eq("id", paymentId);
    if (registrationId) await scope.service.from("event_registrations").delete().eq("id", registrationId);
    console.error("Falha ao cadastrar ingresso manual", error);
    back("Não foi possível cadastrar o ingresso manual.", "inscricoes");
  }

  let deliveryMessage = " O ingresso com QR foi emitido.";
  try {
    const delivery = await deliverEventTicket({ eventId, registrationId });
    if (delivery.email === "sent" || delivery.whatsapp === "sent") deliveryMessage = " O ingresso com QR também foi enviado ao participante.";
  } catch (error) {
    console.error("Falha ao entregar ingresso manual", error);
  }
  revalidatePath("/admin/eventos");
  back(`Ingresso em dinheiro cadastrado com sucesso.${deliveryMessage}`, "inscricoes");
}

export async function saveEvent(formData: FormData) {
  const id = value(formData, "eventId");
  const scope = await requireAdmin();
  if ((!id && !scope.globalAccess) || (id && !scope.canManage(id))) redirect("/admin/eventos");
  const service = scope.service;
  const title = value(formData, "title");
  const slug = slugifyEvent(value(formData, "slug") || title);
  const status = value(formData, "status");
  const startDate = value(formData, "startDate");
  if (title.length < 3 || !slug || !startDate || !EVENT_STATUS_VALUES.includes(status as typeof EVENT_STATUS_VALUES[number])) back("Revise os campos obrigatórios do evento.");
  const capacityText = value(formData, "capacity");
  const capacity = capacityText ? Number(capacityText) : null;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) back("O limite de vagas é inválido.");
  const registrationFeeCents = moneyCents(value(formData, "registrationFee"));
  if (registrationFeeCents < 0 || registrationFeeCents > 100_000_000) back("O valor da inscrição é inválido.");
  const payload = {
    title,
    slug,
    description: value(formData, "description"),
    category: value(formData, "category") || "Eventos especiais",
    start_date: startDate,
    end_date: nullable(value(formData, "endDate")),
    start_time: nullable(value(formData, "startTime")),
    end_time: nullable(value(formData, "endTime")),
    location: value(formData, "location"),
    image_url: nullable(value(formData, "imageUrl")),
    status,
    registration_enabled: formData.get("registrationEnabled") === "on",
    registration_status: formData.get("registrationOpen") === "on" ? "open" : "closed",
    registration_deadline: nullable(value(formData, "registrationDeadline")),
    capacity,
    registration_fee_cents: registrationFeeCents,
    is_public: formData.get("isPublic") === "on",
    is_featured: formData.get("isFeatured") === "on",
    updated_at: new Date().toISOString(),
  };
  const query = id ? service.from("events").update(payload).eq("id", id) : service.from("events").insert(payload);
  const { error } = await query;
  if (error?.code === "23505") back("Já existe um evento com este endereço.");
  if (error) back("Não foi possível salvar o evento.");
  revalidatePath("/calendario"); revalidatePath("/admin/eventos");
  back(id ? "Evento atualizado com sucesso." : "Evento criado com sucesso.");
}

export async function archiveEvent(formData: FormData) {
  const id = value(formData, "eventId");
  if (!id) back("Evento inválido.");
  const scope = await requireAdmin();
  if (!scope.canManage(id)) redirect("/admin/eventos");
  const service = scope.service;
  const { error } = await service.from("events").update({ archived_at: new Date().toISOString(), registration_status: "closed", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) back("Não foi possível arquivar o evento.");
  revalidatePath("/admin/eventos"); back("Evento arquivado.");
}

export async function saveRegistration(formData: FormData) {
  const id = value(formData, "registrationId");
  const fullName = value(formData, "fullName");
  const email = value(formData, "email").toLowerCase();
  const phone = value(formData, "phone");
  const status = value(formData, "status");
  if (!id || fullName.length < 3 || normalizePhone(phone).length < 10 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || !REGISTRATION_STATUS_VALUES.includes(status as typeof REGISTRATION_STATUS_VALUES[number])) back("Revise os dados do participante.", "inscricoes");
  const scope = await requireAdmin();
  const { data: registration } = await scope.service.from("event_registrations").select("event_id").eq("id", id).maybeSingle();
  if (!registration || !scope.canManage(registration.event_id)) redirect("/admin/eventos?tab=inscricoes");
  const service = scope.service;
  const { error } = await service.from("event_registrations").update({ full_name: fullName, email: email || null, phone, phone_normalized: normalizePhone(phone), attendance_duration: value(formData, "attendanceDuration"), notes: value(formData, "notes"), status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error?.code === "23505") back("Este telefone já está inscrito neste evento.", "inscricoes");
  if (error) back("Não foi possível atualizar a inscrição.", "inscricoes");
  revalidatePath("/admin/eventos"); back("Inscrição atualizada com sucesso.", "inscricoes");
}

export async function archiveRegistration(formData: FormData) {
  const id = value(formData, "registrationId");
  if (!id) back("Inscrição inválida.", "inscricoes");
  const scope = await requireAdmin();
  const { data: registration } = await scope.service.from("event_registrations").select("event_id").eq("id", id).maybeSingle();
  if (!registration || !scope.canManage(registration.event_id)) redirect("/admin/eventos?tab=inscricoes");
  const service = scope.service;
  const { error } = await service.from("event_registrations").update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) back("Não foi possível arquivar a inscrição.", "inscricoes");
  revalidatePath("/admin/eventos"); back("Inscrição arquivada.", "inscricoes");
}
