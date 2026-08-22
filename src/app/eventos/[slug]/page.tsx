import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import EventAttendanceControl from "@/components/event-attendance-control";
import { eventRegistrationState } from "@/lib/events";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import RegistrationForm from "./registration-form";

export const dynamic = "force-dynamic";

async function getEvent(slug: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("events").select("id,title,slug,description,category,start_date,end_date,start_time,end_time,location,image_url,status,registration_enabled,registration_status,registration_deadline,capacity,is_public,registration_fee_cents").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const { count } = await getSupabaseServiceClient().from("event_registrations").select("id", { count: "exact", head: true }).eq("event_id", data.id).is("archived_at", null);
  return { ...data, registration_count: count ?? 0 };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const event = await getEvent((await params).slug);
  if (!event) return { title: "Evento não encontrado" };
  const description = event.slug === "pos-encontro-agosto-2026"
    ? "Pós-Encontro · 15 de agosto de 2026 · das 16h às 21h. Faça sua inscrição."
    : event.description;
  return {
    title: event.title,
    description,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      title: `${event.title} | Igreja Casa Forte Erechim`,
      description,
      url: `/eventos/${event.slug}`,
      siteName: "Igreja Casa Forte Erechim",
    },
    twitter: { card: "summary_large_image", title: event.title, description },
  };
}

function formatDate(date: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatDateRange(startDate: string, endDate: string | null) { return endDate && endDate !== startDate ? `${formatDate(startDate)} a ${formatDate(endDate)}` : formatDate(startDate); }
function formatTime(time: string | null) { if (!time) return "Horário a definir"; const [h, m] = time.split(":"); return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`; }

export default async function EventRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const event = await getEvent((await params).slug);
  if (!event || !event.is_public) notFound();
  const isEncounter = ["encontro-com-deus-mulheres-2026", "encontro-com-deus-homens-2026"].includes(event.slug);
  const availability = eventRegistrationState(event);
  const remaining = event.capacity === null ? null : Math.max(event.capacity - event.registration_count, 0);
  return <main className="event-public-page">
    <header className="event-public-header"><Link href="/"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={180} height={70} priority /></Link><Link href="/calendario">Voltar ao calendário</Link></header>
    <section className="event-public-hero">
      <div><p className="home-kicker">{event.category} · {event.status === "confirmed" ? "Confirmado" : "A confirmar"}</p><h1>{event.title}</h1><p>{event.description}</p></div>
      <div className="event-public-summary"><dl><div><dt>Data</dt><dd>{formatDateRange(event.start_date, event.end_date)}</dd></div><div><dt>Horário</dt><dd>{formatTime(event.start_time)}{event.end_time ? ` às ${formatTime(event.end_time)}` : ""}</dd></div><div><dt>Local</dt><dd>{event.location || "Igreja Casa Forte Erechim"}</dd></div><div><dt>Valor</dt><dd>{Number(event.registration_fee_cents) > 0 ? `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(event.registration_fee_cents) / 100)}${isEncounter ? " · cartão em até 4x" : ""}` : "Gratuito"}</dd></div><div><dt>Inscrições</dt><dd>{availability.label}{remaining !== null ? ` · ${remaining} vagas restantes` : ""}</dd></div></dl><EventAttendanceControl event={{ id: `database-${event.id}`, title: event.title, startDate: event.start_date, endDate: event.end_date ?? undefined, startTime: event.start_time?.slice(0, 5) ?? undefined, category: "Eventos especiais", status: event.status === "cancelled" ? "cancelled" : event.status === "tentative" ? "tentative" : "confirmed" }} className="event-public-attendance" /></div>
    </section>
    <section className="event-registration-layout"><div><p className="home-kicker">Inscrição agora</p><h2>Faça sua inscrição</h2><p>{event.slug === "pos-encontro-agosto-2026" ? "Informe seus dados e confirme se você já participou do Encontro com Deus na Casa." : isEncounter ? "Informe nome completo, e-mail e WhatsApp. Depois escolha Pix ou cartão para confirmar sua vaga." : "Preencha os dados abaixo. Nossa equipe poderá entrar em contato pelo WhatsApp com as próximas orientações."}</p></div><RegistrationForm slug={event.slug} enabled={availability.open} feeCents={Number(event.registration_fee_cents)} variant={event.slug === "pos-encontro-agosto-2026" ? "post-encounter" : isEncounter ? "encounter" : "standard"} publicKey={process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || ""} /></section>
  </main>;
}
