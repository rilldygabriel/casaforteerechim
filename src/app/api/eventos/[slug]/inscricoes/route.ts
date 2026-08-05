import { NextResponse } from "next/server";
import { eventRegistrationState, normalizePhone, validatePostEncounterRegistration, validateRegistration } from "@/lib/events";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const input = {
      fullName: String(body.fullName ?? "").trim(),
      phone: String(body.phone ?? "").trim(),
      attendanceDuration: String(body.attendanceDuration ?? ""),
      notes: String(body.notes ?? "").trim(),
      consent: body.consent === true,
      completedEncounter: String(body.completedEncounter ?? ""),
    };

    const service = getSupabaseServiceClient();
    const { data: event } = await service.from("events")
      .select("id,slug,registration_enabled,registration_status,registration_deadline,capacity,archived_at,is_public")
      .eq("slug", slug).maybeSingle();
    if (!event || event.archived_at || !event.is_public) return NextResponse.json({ error: "Este evento não está disponível." }, { status: 404 });
    const isPostEncounter = event.slug === "pos-encontro-agosto-2026";
    const validationError = isPostEncounter ? validatePostEncounterRegistration(input) : validateRegistration(input);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const { count } = await service.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).is("archived_at", null);
    const availability = eventRegistrationState({ ...event, registration_count: count ?? 0 });
    if (!availability.open) return NextResponse.json({ error: availability.label }, { status: 409 });

    const phoneNormalized = normalizePhone(input.phone);
    const { error } = await service.from("event_registrations").insert({
      event_id: event.id,
      full_name: input.fullName,
      phone: input.phone,
      phone_normalized: phoneNormalized,
      attendance_duration: isPostEncounter ? "not_attending" : input.attendanceDuration,
      notes: isPostEncounter ? "" : input.notes,
      consent: true,
      completed_encounter: isPostEncounter ? input.completedEncounter === "yes" : null,
      status: isPostEncounter ? input.completedEncounter === "yes" ? "confirmed" : "rejected" : "pending",
    });
    if (error?.code === "23505") return NextResponse.json({ error: "Já existe uma inscrição com este telefone para este evento." }, { status: 409 });
    if (error) throw error;
    if (isPostEncounter && input.completedEncounter === "no") return NextResponse.json({ accepted: false, message: "O Pós-Encontro é exclusivo para quem já participou do Encontro com Deus na Igreja Casa Forte. Sua resposta foi registrada, mas a inscrição não foi confirmada." }, { status: 201 });
    return NextResponse.json({ accepted: true, message: isPostEncounter ? "Inscrição confirmada para o Pós-Encontro!" : "Inscrição realizada com sucesso! Nossa equipe entrará em contato com você pelo WhatsApp para passar as próximas orientações." }, { status: 201 });
  } catch (error) {
    console.error("Falha ao registrar inscrição de evento.", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível enviar sua inscrição agora. Tente novamente." }, { status: 500 });
  }
}
