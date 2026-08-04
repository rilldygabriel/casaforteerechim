import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CHURCH_EVENTS,
  formatEventDate,
  formatEventWeekday,
  getSaoPauloDateKey,
} from "@/lib/calendar-events";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: profile }, disciplerResult, leaderResult] = await Promise.all([
    supabase.from("member_profiles").select("full_name,is_admin,approval_status").eq("user_id", user.id).maybeSingle(),
    supabase.from("discipler_roles").select("member_id").eq("member_id", user.id).maybeSingle(),
    supabase.from("ministry_leaders").select("ministry_key").eq("member_id", user.id),
  ]);

  const isAdmin = Boolean(profile?.is_admin);
  const isDiscipler = Boolean(disciplerResult.data);
  const ministryCount = leaderResult.data?.length ?? 0;
  const isApproved = profile?.approval_status === "approved";

  if (!profile || (!isAdmin && (!isApproved || (!isDiscipler && ministryCount === 0)))) {
    redirect("/familia");
  }

  async function signOut() {
    "use server";
    const serverSupabase = await getSupabaseServerClient();
    await serverSupabase.auth.signOut({ scope: "local" });
    redirect("/familia/login");
  }

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard-header">
        <Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority />
        <div className="admin-dashboard-actions">
          <Link href="/familia">Área da Família</Link>
          <form action={signOut}><button type="submit">Sair com segurança</button></form>
        </div>
      </header>

      <section className="admin-dashboard-hero">
        <p className="section-eyebrow"><span aria-hidden="true" />{isAdmin ? "Painel administrativo" : "Meu painel de liderança"}</p>
        <h1>Olá, {profile.full_name || "Família"}.</h1>
        <p>{isAdmin ? "Você possui a visão administrativa completa da Casa." : "Aqui aparecem somente as áreas e pessoas confiadas à sua liderança."}</p>
      </section>

      <section className="admin-dashboard-grid" aria-label="Módulos do painel">
        {isAdmin && <>
          <Module number="01" href="/admin/lideranca/discipuladores" title="Discipuladores" copy="Classifique discipuladores e acompanhe todos os discípulos." action="Gerenciar discipuladores" />
          <Module number="02" href="/admin/membros" title="Membros" copy="Revise cadastros e controle o acesso à Área da Família." action="Gerenciar membros" />
          <Module number="03" href="/admin/lideranca/ministerios" title="Ministérios" copy="Organize líderes e participantes de todos os ministérios da Casa." action="Gerenciar ministérios" />
          <Module number="04" href="/admin/visitantes" title="Visitantes" copy="Consulte as fichas recebidas e os próximos passos de cada pessoa." action="Acessar visitantes" />
          <Module number="05" href="/admin/pedidos-oracao" title="Pedidos de oração" copy="Consulte os pedidos e registre o andamento do cuidado pastoral." action="Acessar pedidos" />
          <Module number="06" href="/admin/whatsapp" title="WhatsApp" copy="Leia e responda às mensagens recebidas no número oficial." action="Acessar conversas" />
        </>}

        {!isAdmin && isDiscipler && <Module number="01" href="/admin/meus-discipulos" title="Meus discípulos" copy="Acompanhe somente as pessoas confiadas ao seu discipulado." action="Abrir meus discípulos" />}
        {!isAdmin && ministryCount > 0 && <Module number={isDiscipler ? "02" : "01"} href="/admin/meu-ministerio" title={ministryCount === 1 ? "Meu ministério" : "Meus ministérios"} copy="Veja as pessoas que servem nas áreas sob sua liderança." action="Abrir minha equipe" />}
      </section>
      <AdminCalendarTicker />
    </main>
  );
}

function Module({ number, href, title, copy, action }: { number: string; href: string; title: string; copy: string; action: string }) {
  return <Link className="admin-module-link" href={href}><span>{number}</span><h2>{title}</h2><p>{copy}</p><strong>{action} →</strong></Link>;
}

function AdminCalendarTicker() {
  const today = getSaoPauloDateKey();
  const events = CHURCH_EVENTS.filter(
    (event) => event.status !== "cancelled" && (event.endDate ?? event.startDate) >= today,
  ).slice(0, 14);

  return (
    <footer className="admin-calendar-footer">
      <div className="admin-calendar-footer-heading">
        <div><span>Calendário dinâmico</span><h2>Próximos eventos da Casa</h2></div>
        <Link href="/calendario">Abrir calendário completo →</Link>
      </div>
      <div className="admin-calendar-marquee" aria-label="Próximos eventos em movimento">
        <div className="admin-calendar-track">
          <CalendarEventGroup events={events} />
          <CalendarEventGroup events={events} hidden />
        </div>
      </div>
    </footer>
  );
}

function CalendarEventGroup({ events, hidden = false }: { events: typeof CHURCH_EVENTS; hidden?: boolean }) {
  return <div className="admin-calendar-group" aria-hidden={hidden || undefined}>{events.map((event) => (
    <article key={`${hidden ? "copy-" : ""}${event.id}`}>
      <time dateTime={event.startDate}>{formatEventWeekday(event.startDate, "short")} · {formatEventDate(event.startDate, { day: "2-digit", month: "short" })}</time>
      <strong>{event.title}</strong>
      <span>{event.startTime ? `${event.startTime} · ` : ""}{event.category}</span>
    </article>
  ))}</div>;
}
