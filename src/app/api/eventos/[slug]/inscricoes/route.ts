import { NextResponse } from "next/server";
import { eventRegistrationState, normalizePhone, validateRegistration } from "@/lib/events";
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
    };
    const validationError = validateRegistration(input);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

    const service = getSupabaseServiceClient();
    const { data: event } = await service.from("events")
      .select("id,registration_enabled,registration_status,registration_deadline,capacity,archived_at,is_public")
      .eq("slug", slug).maybeSingle();
    if (!event || event.archived_at || !event.is_public) return NextResponse.json({ error: "Este evento não está disponível." }, { status: 404 });

    const { count } = await service.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).is("archived_at", null);
    const availability = eventRegistrationState({ ...event, registration_count: count ?? 0 });
    if (!availability.open) return NextResponse.json({ error: availability.label }, { status: 409 });

    const phoneNormalized = normalizePhone(input.phone);
    const { error } = await service.from("event_registrations").insert({
      event_id: event.id,
      full_name: input.fullName,
      phone: input.phone,
      phone_normalized: phoneNormalized,
      attendance_duration: input.attendanceDuration,
      notes: input.notes,
      consent: true,
    });
    if (error?.code === "23505") return NextResponse.json({ error: "Já existe uma inscrição com este telefone para este evento." }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ message: "Inscrição realizada com sucesso! Nossa equipe entrará em contato com você pelo WhatsApp para passar as próximas orientações." }, { status: 201 });
  } catch (error) {
    console.error("Falha ao registrar inscrição de evento.", { errorName: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Não foi possível enviar sua inscrição agora. Tente novamente." }, { status: 500 });
  }
}
