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
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export default async function AdminPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: profile }, disciplerResult, leaderResult, connectMemberResult, pastoralTeamResult] = await Promise.all([
    supabase.from("member_profiles").select("full_name,is_admin,approval_status,can_manage_finance").eq("user_id", user.id).maybeSingle(),
    supabase.from("discipler_roles").select("member_id").eq("member_id", user.id).maybeSingle(),
    supabase.from("ministry_leaders").select("ministry_key").eq("member_id", user.id),
    supabase
      .from("ministry_members")
      .select("member_id")
      .eq("member_id", user.id)
      .eq("ministry_key", "connect_consolidacao")
      .maybeSingle(),
    supabase
      .from("member_group_memberships")
      .select("member_id")
      .eq("member_id", user.id)
      .eq("group_key", "equipe_pastoral")
      .maybeSingle(),
  ]);

  const isAdmin = Boolean(profile?.is_admin);
  const canManageFinance = Boolean(profile?.can_manage_finance);
  const isDiscipler = Boolean(disciplerResult.data);
  const ministryCount = leaderResult.data?.length ?? 0;
  const leadsConnect = Boolean(
    leaderResult.data?.some(({ ministry_key }) => ministry_key === "connect_consolidacao"),
  );
  const isConnectMember = Boolean(connectMemberResult.data);
  const isPastoralTeam = Boolean(pastoralTeamResult.data);
  const canManageVisitors = isAdmin || leadsConnect || isConnectMember;
  const isApproved = profile?.approval_status === "approved";

  if (!profile || (!isAdmin && (!isApproved || (!isDiscipler && !isPastoralTeam && ministryCount === 0 && !isConnectMember && !canManageFinance)))) {
    redirect("/familia");
  }

  let pendingServeRequests = 0;
  let overdueVisitorSteps = 0;
  if (ministryCount > 0) {
    const leaderKeys = (leaderResult.data ?? []).map(
      ({ ministry_key }) => ministry_key,
    );
    const service = getSupabaseServiceClient();
    const { count } = await service
      .from("ministry_membership_requests")
      .select("member_id", { count: "exact", head: true })
      .in("ministry_key", leaderKeys)
      .eq("status", "pending");
    pendingServeRequests = count ?? 0;
  }
  if (canManageVisitors) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const { count } = await supabase.from("visitor_followup_steps").select("id", { count: "exact", head: true }).lte("due_date", today).is("completed_at", null);
    overdueVisitorSteps = count ?? 0;
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
          {isDiscipler && <Module number="02" href="/admin/meus-discipulos" title="Meus discípulos" copy="Acompanhe somente as pessoas confiadas ao seu cuidado pessoal." action="Abrir meus discípulos" />}
          <Module number="A" href="/admin/agenda-pastoral" title="Agenda Pastoral" copy="Libere horários de Rilldy e Lisi e acompanhe as reservas dos discipuladores." action="Gerenciar agenda" />
          <Module number="03" href="/admin/membros" title="Membros" copy="Revise cadastros e controle o acesso à Área da Família." action="Gerenciar membros" />
          <Module number="G" href="/admin/membros/grupos" title="Grupos de membros" copy="Consulte voluntários, discipuladores, equipe pastoral e quem está sendo discipulado." action="Abrir grupos" />
          <Module number="04" href="/admin/lideranca/ministerios" title="Ministérios" copy="Organize líderes e participantes de todos os ministérios da Casa." action="Gerenciar ministérios" />
          <Module number="05" href="/admin/visitantes" title="Visitantes" copy="Consulte as fichas recebidas e os próximos passos de cada pessoa." action="Acessar visitantes" notice={overdueVisitorSteps > 0 ? `${overdueVisitorSteps} contatos pendentes` : undefined} />
          <Module number="06" href="/admin/pedidos-oracao" title="Pedidos de oração" copy="Consulte os pedidos e registre o andamento do cuidado pastoral." action="Acessar pedidos" />
          <Module number="07" href="/admin/whatsapp" title="WhatsApp" copy="Leia e responda às mensagens recebidas no número oficial." action="Acessar conversas" />
          <Module number="08" href="/admin/notificacoes" title="Notificações" copy="Envie avisos para toda a Área da Família e para os celulares autorizados." action="Enviar aviso" />
          <Module number="09" href="/admin/eventos" title="Eventos e Inscrições" copy="Crie eventos, acompanhe participantes, vagas e cada etapa das inscrições." action="Gerenciar eventos" />
          <Module number="10" href="/admin/financeiro" title="Financeiro" copy="Acompanhe contas, pagamentos, resumo mensal e entradas dos extratos." action="Abrir financeiro" />
          <Module number="11" href="/admin/presencas" title="Confirmações" copy="Veja quem confirmou presença nos cultos e eventos e quais membros já possuem um dispositivo identificado." action="Acompanhar presenças" />
        </>}

        {!isAdmin && isDiscipler && <Module number="01" href="/admin/meus-discipulos" title="Meus discípulos" copy="Acompanhe somente as pessoas confiadas ao seu discipulado." action="Abrir meus discípulos" />}
        {!isAdmin && (isDiscipler || isPastoralTeam) && <Module number={isDiscipler ? "02" : "01"} href="/familia/agenda-pastoral" title="Agenda Pastoral" copy="Escolha um horário disponível para seu discipulado com os pastores." action="Ver horários livres" />}
        {!isAdmin && ministryCount > 0 && <Module number={isDiscipler ? "03" : "01"} href="/admin/meu-ministerio" title={ministryCount === 1 ? "Meu ministério" : "Meus ministérios"} copy="Veja as pessoas que servem nas áreas sob sua liderança." action="Abrir minha equipe" notice={pendingServeRequests > 0 ? `${pendingServeRequests} ${pendingServeRequests === 1 ? "novo pedido" : "novos pedidos"} para analisar` : undefined} />}
        {!isAdmin && canManageVisitors && <Module number={isDiscipler && ministryCount > 0 ? "03" : isDiscipler || ministryCount > 0 ? "02" : "01"} href="/admin/visitantes" title="Visitantes" copy="Acolha as pessoas que preencheram o cadastro de visitante." action="Acessar visitantes" notice={overdueVisitorSteps > 0 ? `${overdueVisitorSteps} contatos pendentes` : undefined} />}
        {!isAdmin && canManageFinance && <Module number="F" href="/admin/financeiro" title="Financeiro" copy="Registre entradas de culto, contas, pagamentos e confira os resumos financeiros." action="Abrir financeiro" />}
      </section>
      <AdminCalendarTicker />
    </main>
  );
}

function Module({ number, href, title, copy, action, notice }: { number: string; href: string; title: string; copy: string; action: string; notice?: string }) {
  return <Link className="admin-module-link" href={href} data-has-notice={Boolean(notice)}><span>{number}</span>{notice ? <em>{notice}</em> : null}<h2>{title}</h2><p>{copy}</p><strong>{action} →</strong></Link>;
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
