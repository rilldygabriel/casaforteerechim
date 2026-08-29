import { timingSafeEqual } from "node:crypto";

import { getSupabaseServiceClient } from "@/lib/supabase/service";

const HOSTS = new Set(["Pr. Rilldy", "Pra. Lize", "Pr. Rilldy e Pra. Lize"]);

export function authorizePastoralIntegration(request: Request) {
  const expected = process.env.PASTORAL_AGENDA_INTEGRATION_SECRET;
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export async function pastoralSnapshot(sourceCalendarId: string) {
  const service = getSupabaseServiceClient();
  const [{ data: setting, error: settingError }, { data: slots, error: slotsError }] = await Promise.all([
    service.from("pastoral_calendar_settings").select("source_calendar_id,title,is_active").eq("source_calendar_id", sourceCalendarId).maybeSingle(),
    service.from("pastoral_availability_slots").select("id,source_calendar_id,host_name,location,starts_at,ends_at,status").eq("source_calendar_id", sourceCalendarId).order("starts_at"),
  ]);
  if (settingError || slotsError) throw new Error("Não foi possível carregar a agenda pastoral.");
  const slotIds = (slots ?? []).map((slot) => slot.id);
  const { data: bookings, error: bookingError } = slotIds.length
    ? await service.from("pastoral_bookings").select("id,slot_id,requester_name,requester_phone,status,booked_at,read_at,source_event_id").in("slot_id", slotIds).order("booked_at", { ascending: false })
    : { data: [], error: null };
  if (bookingError) throw new Error("Não foi possível carregar as reservas.");
  return { setting, slots: slots ?? [], bookings: bookings ?? [] };
}

export async function configurePastoralAgenda(sourceCalendarId: string, title: string, isActive: boolean) {
  const service = getSupabaseServiceClient();
  const { error } = await service.from("pastoral_calendar_settings").upsert({
    source_calendar_id: sourceCalendarId,
    title,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }, { onConflict: "source_calendar_id" });
  if (error) throw error;
}

export async function createPastoralSlot(input: { sourceCalendarId: string; hostName: string; location: string | null; startsAt: string; endsAt: string }) {
  if (!HOSTS.has(input.hostName)) throw new Error("Responsável pastoral inválido.");
  const service = getSupabaseServiceClient();
  await configurePastoralAgenda(input.sourceCalendarId, "Agenda pastoral", true);
  const { data: conflict } = await service.from("pastoral_availability_slots").select("id").eq("source_calendar_id", input.sourceCalendarId).in("status", ["available", "booked"]).lt("starts_at", input.endsAt).gt("ends_at", input.startsAt).limit(1);
  if (conflict?.length) throw new Error("Esse horário já foi publicado.");
  const { data, error } = await service.from("pastoral_availability_slots").insert({
    source_calendar_id: input.sourceCalendarId,
    host_name: input.hostName,
    location: input.location,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
  }).select("id").single();
  if (error) throw error;
  return data;
}

export async function cancelPastoralSlotById(slotId: string) {
  const service = getSupabaseServiceClient();
  const { data, error } = await service.from("pastoral_availability_slots").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", slotId).eq("status", "available").select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function cancelPastoralBookingById(bookingId: string) {
  const service = getSupabaseServiceClient();
  const { data: booking, error } = await service.from("pastoral_bookings").select("id,slot_id,source_event_id").eq("id", bookingId).eq("status", "confirmed").maybeSingle();
  if (error) throw error;
  if (!booking) return null;
  const now = new Date().toISOString();
  const [{ error: bookingError }, { error: slotError }] = await Promise.all([
    service.from("pastoral_bookings").update({ status: "cancelled", cancelled_at: now, cancelled_by: null }).eq("id", bookingId),
    service.from("pastoral_availability_slots").update({ status: "available", updated_at: now }).eq("id", booking.slot_id),
  ]);
  if (bookingError || slotError) throw bookingError ?? slotError;
  return booking;
}

export async function markPastoralBookingReadById(bookingId: string) {
  const { error } = await getSupabaseServiceClient().from("pastoral_bookings").update({ read_at: new Date().toISOString() }).eq("id", bookingId);
  if (error) throw error;
}

export async function personalAgendaAction(action: "check-conflict" | "booking-created" | "booking-cancelled", input: Record<string, unknown>) {
  const baseUrl = process.env.PASTORAL_AGENDA_PERSONAL_URL;
  const secret = process.env.PASTORAL_AGENDA_INTEGRATION_SECRET;
  if (!baseUrl || !secret) throw new Error("A integração com o Rio de Gabriel ainda não foi configurada.");
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/internal/pastoral-agenda`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ action, ...input }), cache: "no-store",
  });
  const value = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "O Rio de Gabriel não respondeu.");
  return value;
}
