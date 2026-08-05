import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { eventRegistrationState } from "@/lib/events";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = {
  title: "Inscrições",
  description: "Veja os próximos eventos da Igreja Casa Forte Erechim e faça sua inscrição.",
  alternates: { canonical: "/eventos" },
};
export const dynamic = "force-dynamic";

type PublicEvent = {
  id: string; title: string; slug: string; description: string; category: string; start_date: string;
  start_time: string | null; end_time: string | null; location: string; registration_enabled: boolean;
  registration_status: string; registration_deadline: string | null; capacity: number | null;
};

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function eventDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return {
    day: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", timeZone: "UTC" }).format(date),
    month: new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(date),
    weekday: new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(date),
    full: new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(date),
  };
}

function eventTime(value: string | null) {
  if (!value) return "Horário a definir";
  const [hour, minute] = value.split(":");
  return minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
}

export default async function EventsPage() {
  const service = getSupabaseServiceClient();
  const { data } = await service.from("events")
    .select("id,title,slug,description,category,start_date,start_time,end_time,location,registration_enabled,registration_status,registration_deadline,capacity")
    .is("archived_at", null).eq("is_public", true).eq("registration_enabled", true).neq("status", "cancelled")
    .gte("start_date", todayInSaoPaulo()).order("start_date", { ascending: true });
  const events = (data ?? []) as PublicEvent[];
  const counts = await Promise.all(events.map(async (event) => {
    const { count } = await service.from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", event.id).is("archived_at", null);
    return [event.id, count ?? 0] as const;
  }));
  const registrationCounts = new Map(counts);

  return <main className="public-events-page">
    <header className="public-events-header"><Link href="/" aria-label="Casa Forte — início"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link><Link href="/">Voltar ao site</Link></header>
    <section className="public-events-hero"><p className="home-kicker">Próximos passos</p><h1>Eventos e<br /><strong>inscrições.</strong></h1><p>Escolha um evento, confira todas as informações e faça sua inscrição.</p></section>
    <section className="public-events-grid" aria-label="Eventos com inscrição">
      {events.map((event) => {
        const date = eventDate(event.start_date);
        const state = eventRegistrationState({ ...event, registration_count: registrationCounts.get(event.id) ?? 0 });
        const time = event.end_time ? `${eventTime(event.start_time)} às ${eventTime(event.end_time)}` : eventTime(event.start_time);
        return <article className="public-event-card" key={event.id}>
          <div className="public-event-card-date" aria-label={date.full}><span>{date.weekday}</span><strong>{date.day}</strong><span>{date.month}</span></div>
          <div className="public-event-card-copy"><div><span>{event.category}</span><span data-open={state.open}>{state.label}</span></div><h2>{event.title}</h2><p>{event.description}</p><dl><div><dt>Horário</dt><dd>{time}</dd></div><div><dt>Local</dt><dd>{event.location || "Igreja Casa Forte Erechim"}</dd></div></dl><Link data-open={state.open} href={`/eventos/${event.slug}`}>{state.open ? "Fazer minha inscrição" : "Ver informações"}<span aria-hidden="true">→</span></Link></div>
        </article>;
      })}
      {events.length === 0 ? <div className="public-events-empty"><h2>Novas inscrições em breve</h2><p>Assim que um novo evento abrir inscrições, ele aparecerá aqui.</p><Link href="/calendario">Ver calendário da Casa</Link></div> : null}
    </section>
  </main>;
}
