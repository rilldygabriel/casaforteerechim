import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { eventRegistrationState, normalizePhone, validateEncounterRegistration, validatePostEncounterRegistration, validateRegistration } from "@/lib/events";
import { isPagBankConfigured } from "@/lib/pagbank";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = await request.json() as Record<string, unknown>;
    const input = { fullName: String(body.fullName ?? "").trim(), email: String(body.email ?? "").trim().toLowerCase(), phone: String(body.phone ?? "").trim(), attendanceDuration: String(body.attendanceDuration ?? ""), notes: String(body.notes ?? "").trim(), consent: body.consent === true, completedEncounter: String(body.completedEncounter ?? "") };
    const service = getSupabaseServiceClient();
    const { data: event } = await service.from("events").select("id,title,slug,registration_enabled,registration_status,registration_deadline,capacity,archived_at,is_public,registration_fee_cents").eq("slug", slug).maybeSingle();
    if (!event || event.archived_at || !event.is_public) return NextResponse.json({ error: "Este evento não está disponível." }, { status: 404 });
    const feeCents = Number(event.registration_fee_cents || 0);
    const isPostEncounter = event.slug === "pos-encontro-agosto-2026";
    const isEncounter = ["encontro-com-deus-mulheres-2026", "encontro-com-deus-homens-2026"].includes(event.slug);
    const validationError = isPostEncounter ? validatePostEncounterRegistration(input) : isEncounter ? validateEncounterRegistration(input) : validateRegistration(input);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    if (input.email && !EMAIL.test(input.email)) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    if (feeCents > 0 && !EMAIL.test(input.email)) return NextResponse.json({ error: "Informe seu e-mail para receber os dados do pagamento." }, { status: 400 });
    if (feeCents > 0 && !isPagBankConfigured()) return NextResponse.json({ error: "O pagamento PagBank deste evento está sendo ativado. Tente novamente em instantes." }, { status: 503 });

    const { count } = await service.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).is("archived_at", null);
    const availability = eventRegistrationState({ ...event, registration_count: count ?? 0 });
    if (!availability.open) return NextResponse.json({ error: availability.label }, { status: 409 });
    const phoneNormalized = normalizePhone(input.phone);
    const eligible = !isPostEncounter || input.completedEncounter === "yes";
    const initialStatus = !eligible ? "rejected" : feeCents > 0 ? "awaiting_payment" : isPostEncounter ? "confirmed" : "pending";
    const { data: registration, error } = await service.from("event_registrations").insert({ event_id: event.id, full_name: input.fullName, email: input.email || null, phone: input.phone, phone_normalized: phoneNormalized, attendance_duration: isPostEncounter || isEncounter ? "not_attending" : input.attendanceDuration, notes: isPostEncounter || isEncounter ? "" : input.notes, consent: true, completed_encounter: isPostEncounter ? eligible : null, status: initialStatus }).select("id").single();
    if (error?.code === "23505") {
      const { data: existing } = await service.from("event_registrations").select("id,status").eq("event_id", event.id).eq("phone_normalized", phoneNormalized).is("archived_at", null).maybeSingle();
      if (existing?.status === "awaiting_payment") {
        const { data: payment } = await service.from("mercado_pago_payments").select("id,amount_cents").eq("registration_id", existing.id).eq("payment_provider", "pagbank").maybeSingle();
        if (payment) return NextResponse.json({ accepted: true, paymentId: payment.id, amountCents: Number(payment.amount_cents), message: "Continue o pagamento para confirmar sua inscrição." });
      }
      return NextResponse.json({ error: "Já existe uma inscrição com este telefone para este evento." }, { status: 409 });
    }
    if (error || !registration) throw error || new Error("Inscrição não criada.");
    if (!eligible) return NextResponse.json({ accepted: false, message: "O Pós-Encontro é exclusivo para quem já participou do Encontro com Deus na Igreja Casa Forte. Sua resposta foi registrada, mas a inscrição não foi confirmada." }, { status: 201 });
    if (feeCents > 0) {
      const paymentId = randomUUID();
      try {
        const { error: paymentError } = await service.from("mercado_pago_payments").insert({ id: paymentId, purpose: "event", payment_provider: "pagbank", event_id: event.id, registration_id: registration.id, payer_name: input.fullName, payer_email: input.email, payer_phone: input.phone, amount_cents: feeCents });
        if (paymentError) throw paymentError;
        return NextResponse.json({ accepted: true, paymentId, amountCents: feeCents, message: "Inscrição reservada. Conclua o pagamento para confirmar." }, { status: 201 });
      } catch (checkoutError) {
        await service.from("mercado_pago_payments").delete().eq("registration_id", registration.id).eq("status", "created");
        await service.from("event_registrations").delete().eq("id", registration.id).eq("status", "awaiting_payment");
        throw checkoutError;
      }
    }
    return NextResponse.json({ accepted: true, message: isPostEncounter ? "Inscrição confirmada para o Pós-Encontro!" : "Inscrição realizada com sucesso! Nossa equipe entrará em contato com você pelo WhatsApp para passar as próximas orientações." }, { status: 201 });
  } catch (error) {
    console.error("event_registration_error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Não foi possível enviar sua inscrição agora. Tente novamente." }, { status: 500 });
  }
}
