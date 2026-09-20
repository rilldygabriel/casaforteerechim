import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import EventAttendanceControl from "@/components/event-attendance-control";
import { eventRegistrationState } from "@/lib/events";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import RegistrationForm from "./registration-form";

export const dynamic = "force-dynamic";

const getEvent = cache(async (slug: string) => {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("events").select("id,title,slug,description,category,start_date,end_date,start_time,end_time,location,image_url,status,registration_enabled,registration_status,registration_deadline,capacity,is_public,registration_fee_cents").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const registrations = getSupabaseServiceClient().from("event_registrations");
  if (data.slug === "hamburguer-da-casa-20-09") {
    const { data: orders } = await registrations.select("simple_quantity,double_quantity,status").eq("event_id", data.id).is("archived_at", null);
    const units = (orders ?? []).filter((item) => !["cancelled", "rejected", "withdrew"].includes(item.status)).reduce((sum, item) => sum + Number(item.simple_quantity) + Number(item.double_quantity), 0);
    return { ...data, registration_count: units };
  }
  const { count } = await registrations.select("id", { count: "exact", head: true }).eq("event_id", data.id).is("archived_at", null).not("status", "in", "(cancelled,rejected,withdrew)");
  return { ...data, registration_count: count ?? 0 };
});

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
      images: event.image_url ? [{ url: event.image_url, alt: event.title }] : undefined,
    },
    twitter: { card: "summary_large_image", title: event.title, description,
      images: event.image_url ? [event.image_url] : undefined },
  };
}

function formatDate(date: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)); }
function formatDateRange(startDate: string, endDate: string | null) { return endDate && endDate !== startDate ? `${formatDate(startDate)} a ${formatDate(endDate)}` : formatDate(startDate); }
function formatTime(time: string | null) { if (!time) return "Horário a definir"; const [h, m] = time.split(":"); return m === "00" ? `${Number(h)}h` : `${Number(h)}h${m}`; }

export default async function EventRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const event = await getEvent((await params).slug);
  if (!event || !event.is_public) notFound();
  const isEncounter = ["encontro-com-deus-mulheres-2026", "encontro-com-deus-homens-2026"].includes(event.slug);
  const isBurger = event.slug === "hamburguer-da-casa-20-09";
  const availability = eventRegistrationState(event);
  const remaining = event.capacity === null ? null : Math.max(event.capacity - event.registration_count, 0);
  const burgerSoldOut = isBurger && event.capacity !== null && event.registration_count >= event.capacity;
  let burgerMember: { fullName: string; email: string; phone: string } | null = null;
  if (isBurger) {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await getSupabaseServiceClient().from("member_profiles").select("full_name,email,phone,approval_status,is_admin").eq("user_id", user.id).maybeSingle();
      if (profile && (profile.approval_status === "approved" || profile.is_admin === true)) {
        burgerMember = { fullName: String(profile.full_name || "Membro da Casa").trim(), email: String(profile.email || user.email || "").trim().toLowerCase(), phone: String(profile.phone || user.phone || "").trim() };
      }
    }
  }
  return <main className="event-public-page">
    <header className="event-public-header"><Link href="/"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={180} height={70} priority /></Link><Link href="/calendario">Voltar ao calendário</Link></header>
    {isBurger ? <section className="event-public-hero is-burger">
      {event.image_url ? <figure className="event-public-cover is-wide-banner"><Image src={event.image_url} alt={`Capa do evento ${event.title}`} fill priority sizes="(max-width: 850px) 100vw, 1180px" /></figure> : null}
      <div className="burger-event-quick"><strong>20/09 · após o culto</strong><span>{burgerSoldOut ? "Esgotado · 100/100" : `${remaining ?? 0} disponíveis`}</span></div>
    </section> : <section className="event-public-hero">
      <div><p className="home-kicker">{event.category} · {event.status === "confirmed" ? "Confirmado" : "A confirmar"}</p><h1>{event.title}</h1><p>{event.description}</p>{event.image_url ? <figure className="event-public-cover"><Image src={event.image_url} alt={`Capa do evento ${event.title}`} fill sizes="(max-width: 850px) 100vw, 55vw" /></figure> : null}</div>
      <div className="event-public-summary"><dl><div><dt>Data</dt><dd>{formatDateRange(event.start_date, event.end_date)}</dd></div><div><dt>Horário</dt><dd>{`${formatTime(event.start_time)}${event.end_time ? ` às ${formatTime(event.end_time)}` : ""}`}</dd></div><div><dt>Local</dt><dd>{event.location || "Igreja Casa Forte Erechim"}</dd></div><div><dt>Valor</dt><dd>{Number(event.registration_fee_cents) > 0 ? `${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(event.registration_fee_cents) / 100)}${isEncounter ? " · cartão em até 4x" : ""}` : "Gratuito"}</dd></div><div><dt>Inscrições</dt><dd>{availability.label}{remaining !== null ? ` · ${remaining} vagas restantes` : ""}</dd></div></dl><EventAttendanceControl event={{ id: `database-${event.id}`, title: event.title, startDate: event.start_date, endDate: event.end_date ?? undefined, startTime: event.start_time?.slice(0, 5) ?? undefined, category: "Eventos especiais", status: event.status === "cancelled" ? "cancelled" : event.status === "tentative" ? "tentative" : "confirmed" }} className="event-public-attendance" /></div>
    </section>}
    <section className={`event-registration-layout${isBurger ? " is-burger" : ""}`}>{!isBurger ? <div><p className="home-kicker">Inscrição agora</p><h2>Faça sua inscrição</h2><p>{event.slug === "pos-encontro-agosto-2026" ? "Informe seus dados e confirme se você já participou do Encontro com Deus na Casa." : isEncounter ? "Informe nome completo, e-mail e WhatsApp. Depois escolha Pix ou cartão Mercado Pago para confirmar sua vaga." : "Preencha os dados abaixo. Nossa equipe poderá entrar em contato pelo WhatsApp com as próximas orientações."}</p></div> : null}<RegistrationForm slug={event.slug} enabled={availability.open} closedLabel={burgerSoldOut ? "Hambúrgueres esgotados" : availability.label} feeCents={Number(event.registration_fee_cents)} variant={event.slug === "pos-encontro-agosto-2026" ? "post-encounter" : isEncounter ? "encounter" : isBurger ? "burger" : "standard"} mercadoPagoPublicKey={process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY?.trim() || ""} member={burgerMember} /></section>
  </main>;
}
