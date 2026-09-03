import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { bookPastoralSlot } from "@/app/admin/agenda-pastoral/actions";
import { DiscipleshipSubmitButton } from "@/app/familia/meus-discipulados/submit-button";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import "@/app/admin/agenda-pastoral/pastoral-agenda.css";

export const metadata: Metadata = {
  title: "Marcar discipulado com os pastores",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ sucesso?: string; erro?: string }>;
type Slot = {
  id: string;
  host_name: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  status: "available" | "booked" | "cancelled";
};
type Booking = {
  id: string;
  slot_id: string;
  selected_host_name: string;
  status: "confirmed" | "cancelled";
};

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

function normalizedHostName(value: string) {
  if (value === "Pr. Rilldy") return "Rilldy";
  if (value === "Pra. Lize") return "Lisi";
  if (value === "Pr. Rilldy e Pra. Lize") return "Rilldy e Lisi";
  return value;
}

export default async function FamilyPastoralAgendaPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/familia/login?next=/familia/agenda-pastoral");

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from("member_profiles")
      .select("approval_status,is_admin")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("member_group_memberships")
      .select("group_key")
      .eq("member_id", user.id)
      .in("group_key", ["discipulador", "equipe_pastoral"]),
  ]);

  const canReserve = Boolean(
    (profile?.approval_status === "approved" || profile?.is_admin) && memberships?.length,
  );
  if (!canReserve) redirect("/familia");

  const now = new Date().toISOString();
  const [{ data: setting }, { data: slotsData }, { data: bookingsData }] = await Promise.all([
    supabase
      .from("pastoral_calendar_settings")
      .select("is_active")
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("pastoral_availability_slots")
      .select("id,host_name,location,starts_at,ends_at,status")
      .gt("ends_at", now)
      .in("status", ["available", "booked"])
      .order("starts_at"),
    supabase
      .from("pastoral_bookings")
      .select("id,slot_id,selected_host_name,status")
      .eq("requester_id", user.id)
      .eq("status", "confirmed")
      .order("booked_at"),
  ]);

  const slots = (slotsData ?? []) as Slot[];
  const bookings = (bookingsData ?? []) as Booking[];
  const availableSlots = setting?.is_active === false
    ? []
    : slots.filter((slot) => slot.status === "available");
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));

  return (
    <main className="pastoral-agenda-page">
      <header className="admin-section-header">
        <Link href="/familia" aria-label="Voltar à Área da Família">
          <Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority />
        </Link>
        <nav aria-label="Navegação da Área da Família">
          <Link href="/familia">Voltar à Família</Link>
        </nav>
      </header>

      <section className="pastoral-agenda-hero">
        <p className="section-eyebrow"><span aria-hidden="true" />Agenda Pastoral</p>
        <h1>Quero marcar meu discipulado com os pastores</h1>
        <p>Escolha um horário liberado por Rilldy e Lisi e confirme sua presença diretamente aqui.</p>
        <div><strong>{availableSlots.length}</strong><span>horários disponíveis</span></div>
      </section>

      {params.sucesso ? <p className="pastoral-agenda-message is-success">{params.sucesso}</p> : null}
      {params.erro ? <p className="pastoral-agenda-message is-error">{params.erro}</p> : null}

      <section className="pastoral-agenda-section">
        <header><div><span>Escolha o melhor momento</span><h2>Horários disponíveis</h2></div><strong>{availableSlots.length}</strong></header>
        {availableSlots.length ? (
          <div className="pastoral-slot-grid">
            {availableSlots.map((slot) => {
              const hostName = normalizedHostName(slot.host_name);
              return (
                <article className="pastoral-slot-card" key={slot.id}>
                  <span>Disponível para confirmar</span>
                  <h3>{hostName}</h3>
                  <time dateTime={slot.starts_at}>{formatSlotDate(slot.starts_at)}</time>
                  <p>{slot.location || "Local a confirmar"}</p>
                  <form action={bookPastoralSlot} className="pastoral-booking-form">
                    <input type="hidden" name="returnTo" value="/familia/agenda-pastoral" />
                    <input type="hidden" name="slotId" value={slot.id} />
                    {hostName === "Rilldy e Lisi" ? (
                      <label>
                        Com quem deseja fazer?
                        <select name="selectedHostName" defaultValue="Rilldy e Lisi" required>
                          <option value="Rilldy e Lisi">Com os dois</option>
                          <option value="Rilldy">Somente Rilldy</option>
                          <option value="Lisi">Somente Lisi</option>
                        </select>
                      </label>
                    ) : (
                      <input type="hidden" name="selectedHostName" value={hostName} />
                    )}
                    <DiscipleshipSubmitButton pendingLabel="Confirmando…">
                      Aceitar este horário
                    </DiscipleshipSubmitButton>
                  </form>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="pastoral-agenda-empty">
            {setting?.is_active === false
              ? "As reservas estão pausadas no momento. Assim que a agenda for reaberta, os horários aparecerão aqui."
              : "Nenhum horário foi liberado no momento. Volte em breve para conferir novas opções."}
          </p>
        )}
      </section>

      {bookings.length ? (
        <section className="pastoral-agenda-section">
          <header><div><span>Seus próximos encontros</span><h2>Horários confirmados</h2></div><strong>{bookings.length}</strong></header>
          <div className="pastoral-booking-list">
            {bookings.map((booking) => {
              const slot = slotById.get(booking.slot_id);
              if (!slot) return null;
              return (
                <article key={booking.id}>
                  <div>
                    <span>Confirmado</span>
                    <h3>{booking.selected_host_name}</h3>
                    <time dateTime={slot.starts_at}>{formatSlotDate(slot.starts_at)}</time>
                    {slot.location ? <p>{slot.location}</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </main>
  );
}
