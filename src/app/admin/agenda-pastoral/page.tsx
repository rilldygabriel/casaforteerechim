import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { DiscipleshipSubmitButton } from "@/app/familia/meus-discipulados/submit-button";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  bookPastoralSlot,
  cancelPastoralBooking,
  markPastoralBookingRead,
  publishPastoralSlot,
  removePastoralSlot,
  togglePastoralCalendar,
  updatePastoralSlot,
} from "./actions";
import "./pastoral-agenda.css";

export const metadata: Metadata = { title: "Agenda Pastoral", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ sucesso?: string; erro?: string }>;
type Slot = { id: string; source_calendar_id: string; host_name: string; location: string | null; starts_at: string; ends_at: string; status: "available" | "booked" | "cancelled" };
type Booking = { id: string; slot_id: string; requester_name: string; requester_phone: string | null; selected_host_name: string; status: "confirmed" | "cancelled"; booked_at: string; read_at: string | null };

function formatSlotDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function localDateTime(hoursAhead = 24) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}T${value.hour}:00`;
}

function slotDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const item = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${item.year}-${item.month}-${item.day}T${item.hour}:${item.minute}`;
}

function normalizedHostName(value: string) {
  if (value === "Pr. Rilldy") return "Rilldy";
  if (value === "Pra. Lize") return "Lisi";
  if (value === "Pr. Rilldy e Pra. Lize") return "Rilldy e Lisi";
  return value;
}

export default async function PastoralAgendaPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: profile }, { data: disciplerRole }, { data: pastoralTeamMembership }] = await Promise.all([
    supabase.from("member_profiles").select("full_name,is_admin,approval_status").eq("user_id", user.id).maybeSingle(),
    supabase.from("discipler_roles").select("member_id").eq("member_id", user.id).maybeSingle(),
    supabase.from("member_group_memberships").select("member_id").eq("member_id", user.id).eq("group_key", "equipe_pastoral").maybeSingle(),
  ]);
  const isAdmin = Boolean(profile?.is_admin);
  const isDiscipler = Boolean(disciplerRole) && (profile?.approval_status === "approved" || isAdmin);
  const isPastoralTeam = Boolean(pastoralTeamMembership) && (profile?.approval_status === "approved" || isAdmin);
  const canReserve = isDiscipler || isPastoralTeam;
  if (!isAdmin && !canReserve) redirect("/admin");

  const agendaClient = isAdmin ? getSupabaseServiceClient() : supabase;
  const { data: setting } = await agendaClient.from("pastoral_calendar_settings")
    .select("source_calendar_id,title,is_active").order("created_at").limit(1).maybeSingle();
  const calendar = setting ? { id: setting.source_calendar_id } : null;
  const canManage = Boolean(isAdmin && calendar);
  const { data: slotsData } = await agendaClient.from("pastoral_availability_slots")
      .select("id,source_calendar_id,host_name,location,starts_at,ends_at,status")
      .gt("ends_at", new Date().toISOString())
      .in("status", ["available", "booked"])
      .order("starts_at");
  const slots = (slotsData ?? []) as Slot[];
  const slotIds = slots.map((slot) => slot.id);
  const { data: bookingsData } = slotIds.length
    ? await agendaClient.from("pastoral_bookings").select("id,slot_id,requester_name,requester_phone,selected_host_name,status,booked_at,read_at").in("slot_id", slotIds).eq("status", "confirmed").order("booked_at", { ascending: false })
    : { data: [] };
  const bookings = (bookingsData ?? []) as Booking[];
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const availableSlots = slots.filter((slot) => slot.status === "available");
  const bookedSlotIds = new Set(bookings.map((booking) => booking.slot_id));
  const bookedSlots = slots.filter((slot) => bookedSlotIds.has(slot.id));
  const unread = bookings.filter((booking) => !booking.read_at).length;

  return <main className="pastoral-agenda-page">
    <header className="admin-section-header"><Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link><nav><Link href="/admin">Voltar ao painel</Link><Link href="/familia">Área da Família</Link></nav></header>

    <section className="pastoral-agenda-hero"><p className="section-eyebrow"><span aria-hidden="true" />Agenda integrada</p><h1>Agenda Pastoral</h1><p>{canManage ? "Libere e edite os horários de Rilldy e Lisi e acompanhe cada reserva recebida." : "Escolha um dos horários liberados pelos pastores para seu discipulado."}</p><div><strong>{availableSlots.length}</strong><span>horários livres</span><strong>{bookedSlots.length}</strong><span>reservados</span></div></section>

    {params.sucesso ? <p className="pastoral-agenda-message is-success">{params.sucesso}</p> : null}
    {params.erro ? <p className="pastoral-agenda-message is-error">{params.erro}</p> : null}

    {isAdmin && !calendar ? <section className="pastoral-agenda-empty"><h2>Publique o primeiro horário</h2><p>Abra a aba Horários no painel Rio de Gabriel e ative a Agenda Pastoral. Somente a disponibilidade escolhida será compartilhada com a Casa Forte.</p></section> : null}

    {canManage && calendar ? <section className="pastoral-agenda-management">
      <form action={publishPastoralSlot} className="pastoral-agenda-form">
        <input type="hidden" name="calendarId" value={calendar.id} />
          <span>Disponibilidade pastoral</span><h2>Liberar novo horário</h2><p>O cartão ficará visível para discipuladores e para a equipe pastoral.</p>
        <div className="pastoral-agenda-fields">
          <label>Quem estará disponível?<select name="hostName" defaultValue="Rilldy" required><option value="Rilldy">Somente Rilldy</option><option value="Lisi">Somente Lisi</option><option value="Rilldy e Lisi">Rilldy e Lisi</option></select></label>
          <label>Local<input name="location" placeholder="Igreja, gabinete ou online" maxLength={200} /></label>
          <label>Início<input name="startsAt" type="datetime-local" defaultValue={localDateTime(24)} required /></label>
          <label>Fim<input name="endsAt" type="datetime-local" defaultValue={localDateTime(25)} required /></label>
        </div>
        <DiscipleshipSubmitButton pendingLabel="Publicando…">Publicar horário livre</DiscipleshipSubmitButton>
      </form>
      <aside className="pastoral-agenda-status"><span>Controle de acesso</span><h2>{setting?.is_active === false ? "Reservas pausadas" : "Discipuladores e equipe pastoral"}</h2><p>Compromissos particulares nunca aparecem aqui. A Casa Forte lê somente os horários publicados.</p><form action={togglePastoralCalendar}><input type="hidden" name="calendarId" value={calendar.id} /><input type="hidden" name="isActive" value={setting?.is_active === false ? "true" : "false"} /><DiscipleshipSubmitButton pendingLabel="Atualizando…">{setting?.is_active === false ? "Reabrir reservas" : "Pausar novas reservas"}</DiscipleshipSubmitButton></form>{unread > 0 ? <strong>{unread} nova{unread === 1 ? " reserva" : "s reservas"}</strong> : null}</aside>
    </section> : null}

    <section className="pastoral-agenda-section"><header><div><span>Escolha o melhor momento</span><h2>Horários livres</h2></div><strong>{availableSlots.length}</strong></header>{availableSlots.length ? <div className="pastoral-slot-grid">{availableSlots.map((slot) => { const hostName = normalizedHostName(slot.host_name); return <article className="pastoral-slot-card" key={slot.id}><span>Horário livre</span><h3>{hostName}</h3><time dateTime={slot.starts_at}>{formatSlotDate(slot.starts_at)}</time>{slot.location ? <p>{slot.location}</p> : <p>Local a confirmar</p>}{canReserve ? <form action={bookPastoralSlot} className="pastoral-booking-form"><input type="hidden" name="slotId" value={slot.id} />{hostName === "Rilldy e Lisi" ? <label>Com quem deseja fazer?<select name="selectedHostName" defaultValue="Rilldy e Lisi" required><option value="Rilldy e Lisi">Com os dois</option><option value="Rilldy">Somente Rilldy</option><option value="Lisi">Somente Lisi</option></select></label> : <input type="hidden" name="selectedHostName" value={hostName} />}<DiscipleshipSubmitButton pendingLabel="Reservando…">Reservar discipulado</DiscipleshipSubmitButton></form> : null}{canManage ? <div className="pastoral-slot-manage"><details><summary>Editar horário</summary><form action={updatePastoralSlot} className="pastoral-slot-edit"><input type="hidden" name="calendarId" value={calendar?.id} /><input type="hidden" name="slotId" value={slot.id} /><label>Responsável<select name="hostName" defaultValue={hostName} required><option value="Rilldy">Rilldy</option><option value="Lisi">Lisi</option><option value="Rilldy e Lisi">Rilldy e Lisi</option></select></label><label>Local<input name="location" defaultValue={slot.location || ""} maxLength={200} /></label><label>Início<input name="startsAt" type="datetime-local" defaultValue={slotDateTime(slot.starts_at)} required /></label><label>Fim<input name="endsAt" type="datetime-local" defaultValue={slotDateTime(slot.ends_at)} required /></label><DiscipleshipSubmitButton pendingLabel="Salvando…">Salvar alterações</DiscipleshipSubmitButton></form></details><form action={removePastoralSlot}><input type="hidden" name="slotId" value={slot.id} /><DiscipleshipSubmitButton pendingLabel="Excluindo…">Excluir horário</DiscipleshipSubmitButton></form></div> : null}</article>; })}</div> : <p className="pastoral-agenda-empty">Nenhum horário livre foi publicado no momento.</p>}</section>

    {canReserve && !canManage && bookings.length ? <section className="pastoral-agenda-section"><header><div><span>Seus próximos encontros</span><h2>Minhas reservas</h2></div><strong>{bookings.length}</strong></header><div className="pastoral-booking-list">{bookings.map((booking) => { const slot = slotById.get(booking.slot_id); if (!slot) return null; return <article key={booking.id}><div><span>Confirmado</span><h3>{booking.selected_host_name}</h3><time dateTime={slot.starts_at}>{formatSlotDate(slot.starts_at)}</time>{slot.location ? <p>{slot.location}</p> : null}</div></article>; })}</div></section> : null}

    {canManage && bookings.length ? <section className="pastoral-agenda-section" data-highlight={unread > 0}><header><div><span>Notificações</span><h2>Reservas recebidas</h2></div><strong>{bookings.length}</strong></header><div className="pastoral-booking-list">{bookings.map((booking) => { const slot = slotById.get(booking.slot_id); if (!slot) return null; return <article key={`manage-${booking.id}`} data-unread={!booking.read_at}><div><span>{booking.read_at ? "Reserva vista" : "Nova reserva"}</span><h3>{booking.requester_name}</h3><time dateTime={slot.starts_at}>{formatSlotDate(slot.starts_at)} · {booking.selected_host_name}</time>{booking.requester_phone ? <p>WhatsApp cadastrado: {booking.requester_phone}</p> : null}</div><div className="pastoral-booking-actions">{!booking.read_at ? <form action={markPastoralBookingRead}><input type="hidden" name="bookingId" value={booking.id} /><DiscipleshipSubmitButton pendingLabel="Salvando…">Marcar vista</DiscipleshipSubmitButton></form> : null}<form action={cancelPastoralBooking}><input type="hidden" name="bookingId" value={booking.id} /><DiscipleshipSubmitButton pendingLabel="Cancelando…">Cancelar reserva</DiscipleshipSubmitButton></form></div></article>; })}</div></section> : null}
  </main>;
}
