import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eventRegistrationState } from "@/lib/events";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import RegistrationForm from "./registration-form";

export const dynamic = "force-dynamic";

async function getEvent(slug: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("events").select("id,title,slug,description,category,start_date,end_date,start_time,end_time,location,image_url,status,registration_enabled,registration_status,registration_deadline,capacity,is_public").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const { count } = await getSupabaseServiceClient().from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", data.id).is("archived_at", null);
  return { ...data, registration_count: count ?? 0 };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const event = await getEvent((await params).slug);
  return event ? { title: event.title, description: event.description } : { title: "Evento não encontrado" };
}

function formatDate(date: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatTime(time: string | null) { if (!time) return "Horário a definir"; const [h, m] = time.split(":"); return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`; }

export default async function EventRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const event = await getEvent((await params).slug);
  if (!event || !event.is_public) notFound();
  const availability = eventRegistrationState(event);
  const remaining = event.capacity === null ? null : Math.max(event.capacity - event.registration_count, 0);
  return <main className="event-public-page">
    <header className="event-public-header"><Link href="/"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={180} height={70} priority /></Link><Link href="/calendario">Voltar ao calendário</Link></header>
    <section className="event-public-hero">
      <div><p className="home-kicker">{event.category} · {event.status === "confirmed" ? "Confirmado" : "A confirmar"}</p><h1>{event.title}</h1><p>{event.description}</p></div>
      <dl><div><dt>Data</dt><dd>{formatDate(event.start_date)}</dd></div><div><dt>Horário</dt><dd>{formatTime(event.start_time)}</dd></div><div><dt>Local</dt><dd>{event.location || "Igreja Casa Forte Erechim"}</dd></div><div><dt>Inscrições</dt><dd>{availability.label}{remaining !== null ? ` · ${remaining} vagas restantes` : ""}</dd></div></dl>
    </section>
    <section className="event-registration-layout"><div><p className="home-kicker">Seu próximo passo</p><h2>Faça sua inscrição</h2><p>Preencha os dados abaixo. Nossa equipe poderá entrar em contato pelo WhatsApp com as próximas orientações.</p></div><RegistrationForm slug={event.slug} enabled={availability.open} /></section>
  </main>;
}
