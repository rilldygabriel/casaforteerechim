"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { cancelPastoralBookingById, cancelPastoralSlotById, configurePastoralAgenda, createPastoralSlot, markPastoralBookingReadById, personalAgendaAction, updatePastoralSlotById } from "@/lib/pastoral-agenda";
import { formatDiscipleshipDate, sendWhatsappNotification } from "@/lib/whatsapp";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATH = "/admin/agenda-pastoral";
const FAMILY_PATH = "/familia/agenda-pastoral";

function finish(kind: "sucesso" | "erro", message: string): never {
  redirect(`${PATH}?${new URLSearchParams({ [kind]: message })}`);
}

async function session(loginPath = "/admin/login") {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(loginPath);
  return { supabase, user };
}

async function adminSession() {
  const value = await session();
  const { data: profile } = await value.supabase.from("member_profiles").select("is_admin").eq("user_id", value.user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/admin");
  return value;
}

function friendlyDatabaseError(message: string) {
  if (/somente discipuladores/i.test(message)) return "Somente discipuladores e integrantes da equipe pastoral autorizados podem reservar.";
  if (/ja possui outra reserva/i.test(message)) return "Você já possui outra reserva nesse mesmo período.";
  if (/nao esta mais disponivel|acabou de ficar indisponivel|duplicate key/i.test(message)) return "Esse horário acabou de ser reservado ou não está mais disponível.";
  if (/horario ja possui|horario ja foi publicado/i.test(message)) return "Esse horário já está ocupado ou publicado.";
  if (/nao autorizado/i.test(message)) return "Você não possui permissão para realizar essa ação.";
  if (/escolha pastoral invalida|responsavel nao esta disponivel/i.test(message)) return "Escolha Rilldy, Lisi ou os dois para esse horário.";
  return "Não foi possível concluir agora. Atualize a página e tente novamente.";
}

export async function publishPastoralSlot(formData: FormData) {
  await adminSession();
  const calendarId = String(formData.get("calendarId") ?? "");
  const hostName = String(formData.get("hostName") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAt = new Date(`${String(formData.get("startsAt") ?? "")}:00-03:00`);
  const endsAt = new Date(`${String(formData.get("endsAt") ?? "")}:00-03:00`);
  if (!UUID.test(calendarId) || hostName.length < 2 || hostName.length > 100 || location.length > 200) {
    finish("erro", "Confira o responsável e o local.");
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt <= new Date() || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 4 * 60 * 60 * 1000) {
    finish("erro", "Escolha um período futuro de até quatro horas.");
  }
  try {
    const check = await personalAgendaAction("check-conflict", { calendarId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    if (check.conflict) throw new Error("horario ja possui compromisso privado");
    await createPastoralSlot({ sourceCalendarId: calendarId, hostName, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), location: location || null });
  }
  catch (error) { finish("erro", friendlyDatabaseError(error instanceof Error ? error.message : "")); }
  revalidatePath(PATH);
  revalidatePath("/dashboard/agenda");
  finish("sucesso", "Horário publicado nos dois painéis.");
}

export async function updatePastoralSlot(formData: FormData) {
  await adminSession();
  const calendarId = String(formData.get("calendarId") ?? "");
  const slotId = String(formData.get("slotId") ?? "");
  const hostName = String(formData.get("hostName") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const startsAt = new Date(`${String(formData.get("startsAt") ?? "")}:00-03:00`);
  const endsAt = new Date(`${String(formData.get("endsAt") ?? "")}:00-03:00`);
  if (!UUID.test(calendarId) || !UUID.test(slotId) || hostName.length < 2 || hostName.length > 100 || location.length > 200) finish("erro", "Confira o responsável e o local.");
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || startsAt <= new Date() || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 4 * 60 * 60 * 1000) finish("erro", "Escolha um período futuro de até quatro horas.");
  try {
    const check = await personalAgendaAction("check-conflict", { calendarId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    if (check.conflict) throw new Error("horario ja possui compromisso privado");
    await updatePastoralSlotById(slotId, { sourceCalendarId: calendarId, hostName, location: location || null, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
  } catch (error) { finish("erro", friendlyDatabaseError(error instanceof Error ? error.message : "")); }
  revalidatePath(PATH);
  revalidatePath("/dashboard/agenda");
  finish("sucesso", "Horário atualizado nos dois painéis.");
}

export async function togglePastoralCalendar(formData: FormData) {
  await adminSession();
  const calendarId = String(formData.get("calendarId") ?? "");
  const isActive = String(formData.get("isActive")) === "true";
  if (!UUID.test(calendarId)) finish("erro", "Agenda inválida.");
  try { await configurePastoralAgenda(calendarId, "Agenda pastoral", isActive); }
  catch (error) { finish("erro", friendlyDatabaseError(error instanceof Error ? error.message : "")); }
  revalidatePath(PATH);
  finish("sucesso", isActive ? "Reservas reabertas para os discipuladores." : "Novas reservas foram pausadas.");
}

export async function removePastoralSlot(formData: FormData) {
  await adminSession();
  const slotId = String(formData.get("slotId") ?? "");
  if (!UUID.test(slotId)) finish("erro", "Horário inválido.");
  try { if (!await cancelPastoralSlotById(slotId)) finish("erro", "Esse horário já não estava disponível."); }
  catch (error) { finish("erro", friendlyDatabaseError(error instanceof Error ? error.message : "")); }
  revalidatePath(PATH);
  revalidatePath("/dashboard/agenda");
  finish("sucesso", "Horário retirado da agenda pública.");
}

export async function cancelPastoralBooking(formData: FormData) {
  await adminSession();
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!UUID.test(bookingId)) finish("erro", "Reserva inválida.");
  try {
    const booking = await cancelPastoralBookingById(bookingId);
    if (!booking) finish("erro", "Essa reserva já estava cancelada.");
    if (booking.source_event_id) await personalAgendaAction("booking-cancelled", { eventId: booking.source_event_id });
  }
  catch (error) { finish("erro", friendlyDatabaseError(error instanceof Error ? error.message : "")); }
  revalidatePath(PATH);
  revalidatePath("/dashboard/agenda");
  finish("sucesso", "Reserva e compromisso cancelados.");
}

export async function markPastoralBookingRead(formData: FormData) {
  await adminSession();
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!UUID.test(bookingId)) finish("erro", "Reserva inválida.");
  try { await markPastoralBookingReadById(bookingId); }
  catch (error) { finish("erro", friendlyDatabaseError(error instanceof Error ? error.message : "")); }
  revalidatePath(PATH);
  finish("sucesso", "Notificação marcada como vista.");
}

export async function bookPastoralSlot(formData: FormData) {
  const returnPath = String(formData.get("returnTo") ?? "") === FAMILY_PATH ? FAMILY_PATH : PATH;
  const { supabase, user } = await session(
    returnPath === FAMILY_PATH ? `/familia/login?next=${encodeURIComponent(FAMILY_PATH)}` : "/admin/login",
  );
  const bookFinish = (kind: "sucesso" | "erro", message: string): never => {
    redirect(`${returnPath}?${new URLSearchParams({ [kind]: message })}`);
  };
  const slotId = String(formData.get("slotId") ?? "");
  const selectedHostName = String(formData.get("selectedHostName") ?? "").trim();
  if (!UUID.test(slotId)) bookFinish("erro", "Horário inválido.");
  if (selectedHostName && !["Rilldy", "Lisi", "Rilldy e Lisi"].includes(selectedHostName)) bookFinish("erro", "Escolha pastoral inválida.");

  const { data, error } = await supabase.rpc("book_pastoral_slot", { p_slot_id: slotId, p_selected_host_name: selectedHostName || null });
  const booking = Array.isArray(data) ? data[0] : data;
  if (error || !booking) bookFinish("erro", friendlyDatabaseError(error?.message ?? ""));

  const when = formatDiscipleshipDate(booking.starts_at);
  after(async () => {
    const service = getSupabaseServiceClient();
    const [{ data: requester }, { data: pastors }, synced] = await Promise.all([
      service.from("member_profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle(),
      service.from("member_profiles")
        .select("full_name,phone")
        .in("full_name", ["Pastor Rilldy", "Lisi Gabriel", "Pastora Lisi"]),
      personalAgendaAction("booking-created", {
        calendarId: booking.source_calendar_id,
        requesterName: booking.requester_name,
        requesterPhone: booking.requester_phone,
        hostName: booking.host_name,
        startsAt: booking.starts_at,
        endsAt: booking.ends_at,
        location: booking.location,
      }).catch((): Record<string, unknown> => ({})),
    ]);
    if (typeof synced.eventId === "string") await service.from("pastoral_bookings").update({ source_event_id: synced.eventId }).eq("id", booking.booking_id);
    const requesterMessage = `Seu discipulado com ${booking.host_name} foi confirmado para ${when}. O horário já está reservado na Agenda Pastoral.`;
    const pastoralMessage = `Agenda pastoral confirmada 🙏 ${booking.requester_name} marcou discipulado com ${booking.host_name} para ${when}.`;
    const pastoralPhones = [...new Set((pastors ?? [])
      .filter((person) => ["Pastor Rilldy", "Lisi Gabriel", "Pastora Lisi"].includes(person.full_name ?? ""))
      .map((person) => person.phone)
      .filter((phone): phone is string => Boolean(phone)))];
    await Promise.allSettled([
      sendWhatsappNotification(requester?.phone, requesterMessage),
      ...pastoralPhones.map((phone) => sendWhatsappNotification(phone, pastoralMessage)),
    ]);
  });

  revalidatePath(PATH);
  revalidatePath(FAMILY_PATH);
  revalidatePath("/dashboard/agenda");
  bookFinish("sucesso", `Discipulado confirmado para ${when}.`);
}
