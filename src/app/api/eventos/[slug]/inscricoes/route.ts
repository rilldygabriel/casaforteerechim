import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eventRegistrationState, normalizePhone, validateEncounterRegistration, validateHamburgerRegistration, validatePostEncounterRegistration, validateRegistration } from "@/lib/events";
import { isMercadoPagoBrickConfigured } from "@/lib/mercado-pago";
import { getSupabaseRouteClient } from "@/lib/supabase/route";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function internalMemberPhone(userId: string) {
  const digits = [...createHash("sha256").update(userId).digest().subarray(0, 8)].map((value) => String(value % 10)).join("");
  return `000${digits}`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const respond = (body: Record<string, unknown>, init?: ResponseInit) => applyAuthState(NextResponse.json(body, init));
  try {
    const { slug } = await params;
    const body = await request.json() as Record<string, unknown>;
    const input = { fullName: String(body.fullName ?? "").trim(), email: String(body.email ?? "").trim().toLowerCase(), phone: String(body.phone ?? "").trim(), attendanceDuration: String(body.attendanceDuration ?? ""), notes: String(body.notes ?? "").trim(), consent: body.consent === true, completedEncounter: String(body.completedEncounter ?? ""), simpleQuantity: Number(body.simpleQuantity ?? 0), doubleQuantity: Number(body.doubleQuantity ?? 0) };
    const service = getSupabaseServiceClient();
    const { data: event } = await service.from("events").select("id,title,slug,registration_enabled,registration_status,registration_deadline,capacity,archived_at,is_public,registration_fee_cents").eq("slug", slug).maybeSingle();
    if (!event || event.archived_at || !event.is_public) return respond({ error: "Este evento não está disponível." }, { status: 404 });
    const eventId = event.id;
    const feeCents = Number(event.registration_fee_cents || 0);
    const isPostEncounter = event.slug === "pos-encontro-agosto-2026";
    const isEncounter = ["encontro-com-deus-mulheres-2026", "encontro-com-deus-homens-2026"].includes(event.slug);
    const isBurger = event.slug === "hamburguer-da-casa-20-09";
    let isMember = false;
    if (isBurger) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await service.from("member_profiles").select("full_name,email,phone,approval_status,is_admin").eq("user_id", user.id).maybeSingle();
        if (profile && (profile.approval_status === "approved" || profile.is_admin === true)) {
          isMember = true;
          input.email = String(profile.email || user.email || `${user.id}@membros.casaforteerechim.app.br`).trim().toLowerCase();
          const profilePhone = normalizePhone(String(profile.phone || user.phone || ""));
          input.phone = profilePhone.length >= 10 && profilePhone.length <= 11 ? profilePhone : internalMemberPhone(user.id);
          input.consent = true;
        }
      }
    }

    const validationError = isPostEncounter ? validatePostEncounterRegistration(input) : isEncounter ? validateEncounterRegistration(input) : isBurger ? validateHamburgerRegistration({ fullName: input.fullName, phone: input.phone, simpleQuantity: input.simpleQuantity, doubleQuantity: input.doubleQuantity, isMember }) : validateRegistration(input);
    if (validationError) return respond({ error: validationError }, { status: 400 });

    if (isBurger && !isMember) {
      const guestPhone = normalizePhone(input.phone);
      input.email = `hamburguer+${guestPhone}@casaforteerechim.app.br`;
      input.consent = true;
    }

    if (input.email && !EMAIL.test(input.email)) return respond({ error: "Informe um e-mail válido." }, { status: 400 });
    if (feeCents > 0 && !EMAIL.test(input.email)) return respond({ error: "Não foi possível identificar sua conta para o pagamento." }, { status: 400 });
    if (feeCents > 0 && !isMercadoPagoBrickConfigured()) return respond({ error: "O pagamento Mercado Pago deste evento está sendo ativado. Tente novamente em instantes." }, { status: 503 });

    const phoneNormalized = normalizePhone(input.phone);
    const eligible = !isPostEncounter || input.completedEncounter === "yes";
    const initialStatus = !eligible ? "rejected" : feeCents > 0 ? "awaiting_payment" : isPostEncounter ? "confirmed" : "pending";

    async function existingPaymentResponse() {
      const { data: existing } = await service.from("event_registrations").select("id,status").eq("event_id", eventId).eq("phone_normalized", phoneNormalized).is("archived_at", null).maybeSingle();
      if (existing?.status === "awaiting_payment") {
        const { data: payment } = await service.from("mercado_pago_payments").select("id,amount_cents,payment_provider,provider_payment_id,provider_order_id,payer_name,payer_email").eq("registration_id", existing.id).in("status", ["created", "pending", "in_process"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (payment?.payment_provider === "mercado_pago") return respond({ accepted: true, paymentId: payment.id, amountCents: Number(payment.amount_cents), payerName: payment.payer_name, payerEmail: payment.payer_email, message: "Continue o pagamento para confirmar sua inscrição." });
        if (payment?.payment_provider === "pagbank" && !payment.provider_payment_id && !payment.provider_order_id) {
          const { error: switchError } = await service.from("mercado_pago_payments").update({ payment_provider: "mercado_pago", updated_at: new Date().toISOString() }).eq("id", payment.id).eq("payment_provider", "pagbank");
          if (switchError) throw switchError;
          return respond({ accepted: true, paymentId: payment.id, amountCents: Number(payment.amount_cents), payerName: payment.payer_name, payerEmail: payment.payer_email, message: "Continue o pagamento para confirmar sua inscrição." });
        }
      }
      return null;
    }

    let registration: { id: string } | null = null;
    let amountCents = feeCents;

    if (isBurger) {
      const { data, error } = await service.rpc("create_hamburger_registration", {
        p_event_slug: event.slug,
        p_full_name: input.fullName,
        p_email: input.email,
        p_phone: input.phone,
        p_phone_normalized: phoneNormalized,
        p_simple_quantity: input.simpleQuantity,
        p_double_quantity: input.doubleQuantity,
      });
      if (error?.code === "23505") {
        const existing = await existingPaymentResponse();
        if (existing) return existing;
        return respond({ error: "Já existe uma reserva com este telefone para o Hambúrguer da Casa." }, { status: 409 });
      }
      if (error?.message?.includes("CAPACITY_EXCEEDED")) return respond({ error: "Não há unidades suficientes disponíveis para este pedido. Diminua a quantidade e tente novamente." }, { status: 409 });
      if (error?.message?.includes("REGISTRATION_CLOSED")) return respond({ error: "As reservas estão encerradas." }, { status: 409 });
      const created = Array.isArray(data) ? data[0] : data;
      if (error || !created?.registration_id) throw error || new Error("Reserva não criada.");
      registration = { id: String(created.registration_id) };
      amountCents = Number(created.total_amount_cents);
    } else {
      const { count } = await service.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).is("archived_at", null);
      const availability = eventRegistrationState({ ...event, registration_count: count ?? 0 });
      if (!availability.open) return respond({ error: availability.label }, { status: 409 });
      const { data, error } = await service.from("event_registrations").insert({ event_id: event.id, full_name: input.fullName, email: input.email || null, phone: input.phone, phone_normalized: phoneNormalized, attendance_duration: isPostEncounter || isEncounter ? "not_attending" : input.attendanceDuration, notes: isPostEncounter || isEncounter ? "" : input.notes, consent: true, completed_encounter: isPostEncounter ? eligible : null, status: initialStatus }).select("id").single();
      if (error?.code === "23505") {
        const existing = await existingPaymentResponse();
        if (existing) return existing;
        return respond({ error: "Já existe uma inscrição com este telefone para este evento." }, { status: 409 });
      }
      if (error || !data) throw error || new Error("Inscrição não criada.");
      registration = data;
    }

    if (!eligible) return respond({ accepted: false, message: "O Pós-Encontro é exclusivo para quem já participou do Encontro com Deus na Igreja Casa Forte. Sua resposta foi registrada, mas a inscrição não foi confirmada." }, { status: 201 });
    if (amountCents > 0) {
      const paymentId = randomUUID();
      try {
        const { error: paymentError } = await service.from("mercado_pago_payments").insert({ id: paymentId, purpose: "event", payment_provider: "mercado_pago", event_id: event.id, registration_id: registration.id, payer_name: input.fullName, payer_email: input.email, payer_phone: input.phone, amount_cents: amountCents });
        if (paymentError) throw paymentError;
        return respond({ accepted: true, paymentId, amountCents, payerName: input.fullName, payerEmail: input.email, message: isBurger ? "Pedido reservado. Conclua o pagamento para confirmar." : "Inscrição reservada. Conclua o pagamento para confirmar." }, { status: 201 });
      } catch (checkoutError) {
        await service.from("mercado_pago_payments").delete().eq("registration_id", registration.id).eq("status", "created");
        await service.from("event_registrations").delete().eq("id", registration.id).eq("status", "awaiting_payment");
        throw checkoutError;
      }
    }
    return respond({ accepted: true, message: isPostEncounter ? "Inscrição confirmada para o Pós-Encontro!" : "Inscrição realizada com sucesso! Nossa equipe entrará em contato com você pelo WhatsApp para passar as próximas orientações." }, { status: 201 });
  } catch (error) {
    console.error("event_registration_error", error instanceof Error ? error.message : "unknown");
    return respond({ error: "Não foi possível enviar sua inscrição agora. Tente novamente." }, { status: 500 });
  }
}
