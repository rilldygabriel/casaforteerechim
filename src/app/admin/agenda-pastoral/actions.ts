"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { formatDiscipleshipDate, sendWhatsappNotification } from "@/lib/whatsapp";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATH = "/admin/agenda-pastoral";

function finish(kind: "sucesso" | "erro", message: string): never {
  redirect(`${PATH}?${new URLSearchParams({ [kind]: message })}`);
}

async function session() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return { supabase, user };
}

function friendlyDatabaseError(message: string) {
  if (/somente discipuladores/i.test(message)) return "Somente discipuladores autorizados podem reservar.";
  if (/ja possui outra reserva/i.test(message)) return "Você já possui outra reserva nesse mesmo período.";
  if (/nao esta mais disponivel|acabou de ficar indisponivel|duplicate key/i.test(message)) return "Esse horário acabou de ser reservado ou não está mais disponível.";
  if (/horario ja possui|horario ja foi publicado/i.test(message)) return "Esse horário já está ocupado ou publicado.";
  if (/nao autorizado/i.test(message)) return "Você não possui permissão para realizar essa ação.";
  return "Não foi possível concluir agora. Atualize a página e tente novamente.";
}

export async function publishPastoralSlot(formData: FormData) {
  const { supabase } = await session();
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
  const { error } = await supabase.rpc("publish_pastoral_slot", {
    p_calendar_id: calendarId,
    p_host_name: hostName,
    p_starts_at: startsAt.toISOString(),
    p_ends_at: endsAt.toISOString(),
    p_location: location || null,
  });
  if (error) finish("erro", friendlyDatabaseError(error.message));
  revalidatePath(PATH);
  revalidatePath("/dashboard/agenda");
  finish("sucesso", "Horário publicado nos dois painéis.");
}

export async function togglePastoralCalendar(formData: FormData) {
  const { supabase } = await session();
  const calendarId = String(formData.get("calendarId") ?? "");
  const isActive = String(formData.get("isActive")) === "true";
  if (!UUID.test(calendarId)) finish("erro", "Agenda inválida.");
  const { error } = await supabase.rpc("configure_pastoral_calendar", {
    p_calendar_id: calendarId,
    p_title: "Agenda pastoral",
    p_is_active: isActive,
  });
  if (error) finish("erro", friendlyDatabaseError(error.message));
  revalidatePath(PATH);
  finish("sucesso", isActive ? "Reservas reabertas para os discipuladores." : "Novas reservas foram pausadas.");
}

export async function removePastoralSlot(formData: FormData) {
  const { supabase } = await session();
  const slotId = String(formData.get("slotId") ?? "");
  if (!UUID.test(slotId)) finish("erro", "Horário inválido.");
  const { data, error } = await supabase.rpc("cancel_pastoral_slot", { p_slot_id: slotId });
  if (error) finish("erro", friendlyDatabaseError(error.message));
  if (!data) finish("erro", "Esse horário já não estava disponível.");
  revalidatePath(PATH);
  revalidatePath("/dashboard/agenda");
  finish("sucesso", "Horário retirado da agenda pública.");
}

export async function cancelPastoralBooking(formData: FormData) {
  const { supabase } = await session();
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!UUID.test(bookingId)) finish("erro", "Reserva inválida.");
  const { data, error } = await supabase.rpc("cancel_pastoral_booking", { p_booking_id: bookingId });
  if (error) finish("erro", friendlyDatabaseError(error.message));
  if (!data) finish("erro", "Essa reserva já estava cancelada.");
  revalidatePath(PATH);
  revalidatePath("/dashboard/agenda");
  finish("sucesso", "Reserva e compromisso cancelados.");
}

export async function markPastoralBookingRead(formData: FormData) {
  const { supabase } = await session();
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!UUID.test(bookingId)) finish("erro", "Reserva inválida.");
  const { error } = await supabase.rpc("mark_pastoral_booking_read", { p_booking_id: bookingId });
  if (error) finish("erro", friendlyDatabaseError(error.message));
  revalidatePath(PATH);
  finish("sucesso", "Notificação marcada como vista.");
}

export async function bookPastoralSlot(formData: FormData) {
  const { supabase, user } = await session();
  const slotId = String(formData.get("slotId") ?? "");
  if (!UUID.test(slotId)) finish("erro", "Horário inválido.");

  const { data, error } = await supabase.rpc("book_pastoral_slot", { p_slot_id: slotId });
  const booking = Array.isArray(data) ? data[0] : data;
  if (error || !booking) finish("erro", friendlyDatabaseError(error?.message ?? ""));

  const when = formatDiscipleshipDate(booking.starts_at);
  after(async () => {
    const service = getSupabaseServiceClient();
    const { data: agendaMembers } = await service.from("agenda_members")
      .select("user_id")
      .eq("calendar_id", booking.calendar_id)
      .in("role", ["owner", "editor"]);
    const pastoralRecipientIds = [...new Set([
      booking.calendar_owner_id,
      ...(agendaMembers ?? []).map((member) => member.user_id),
    ])];
    const { data: people } = await service.from("member_profiles")
      .select("user_id,full_name,phone")
      .in("user_id", [...new Set([user.id, ...pastoralRecipientIds])]);
    const requester = people?.find((person) => person.user_id === user.id);
    const ownerMessage = `${requester?.full_name || booking.requester_name} reservou um discipulado com ${booking.host_name} para ${when}. Abra a Agenda Pastoral para ver os detalhes.`;
    const requesterMessage = `Seu discipulado com ${booking.host_name} foi confirmado para ${when}. O horário já está reservado na Agenda Pastoral.`;
    await Promise.all([
      ...pastoralRecipientIds.map((recipientId) => sendWhatsappNotification(
        people?.find((person) => person.user_id === recipientId)?.phone,
        ownerMessage,
      )),
      sendWhatsappNotification(requester?.phone, requesterMessage),
    ]);
  });

  revalidatePath(PATH);
  revalidatePath("/dashboard/agenda");
  finish("sucesso", `Discipulado confirmado para ${when}.`);
}
