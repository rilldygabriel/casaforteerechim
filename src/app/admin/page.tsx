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

type AppSubscription = {
  user_id: string;
  user_agent: string | null;
};

function subscriptionPlatform(userAgent: string | null) {
  const value = userAgent?.toLowerCase() ?? "";
  if (/iphone|ipad|ipod/.test(value)) return "ios";
  if (value.includes("android")) return "android";
  return null;
}

export default async function AdminPage() {
  const supabase = await getSupabaseServerClient();
  const service = getSupabaseServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: profile }, disciplerResult, leaderResult, connectMemberResult, pastoralTeamResult, eventAssignmentsResult] = await Promise.all([
    supabase.from("member_profiles").select("full_name,is_admin,approval_status,can_manage_finance,can_manage_events").eq("user_id", user.id).maybeSingle(),
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
    service.from("event_admin_members").select("event_id").eq("user_id", user.id),
  ]);

  const isAdmin = Boolean(profile?.is_admin);
  const canManageFinance = Boolean(profile?.can_manage_finance);
  const canManageEvents = Boolean(profile?.can_manage_events || eventAssignmentsResult.data?.length);
  const isDiscipler = Boolean(disciplerResult.data);
  const ministryCount = leaderResult.data?.length ?? 0;
  const leadsConnect = Boolean(
    leaderResult.data?.some(({ ministry_key }) => ministry_key === "connect_consolidacao"),
  );
  const isConnectMember = Boolean(connectMemberResult.data);
  const isPastoralTeam = Boolean(pastoralTeamResult.data);
  const canManageVisitors = isAdmin || leadsConnect || isConnectMember;
  const isApproved = profile?.approval_status === "approved";

  if (!profile || (!isAdmin && (!isApproved || (!isDiscipler && !isPastoralTeam && ministryCount === 0 && !isConnectMember && !canManageFinance && !canManageEvents)))) {
    redirect("/familia");
  }

  let pendingServeRequests = 0;
  let overdueVisitorSteps = 0;
  let iosDownloadCount = 0;
  let androidDownloadCount = 0;
  let iosActiveMembers = 0;
  let androidActiveMembers = 0;

  if (isAdmin) {
    const [iosDownloads, androidDownloads, subscriptionResult] = await Promise.all([
      service.from("app_download_events").select("id", { count: "exact", head: true }).eq("platform", "ios"),
      service.from("app_download_events").select("id", { count: "exact", head: true }).eq("platform", "android"),
      service.from("web_push_subscriptions").select("user_id,user_agent").lt("failure_count", 3),
    ]);
    iosDownloadCount = iosDownloads.count ?? 0;
    androidDownloadCount = androidDownloads.count ?? 0;

    const iosMembers = new Set<string>();
    const androidMembers = new Set<string>();
    for (const subscription of (subscriptionResult.data ?? []) as AppSubscription[]) {
      const platform = subscriptionPlatform(subscription.user_agent);
      if (platform === "ios") iosMembers.add(subscription.user_id);
      if (platform === "android") androidMembers.add(subscription.user_id);
    }
    iosActiveMembers = iosMembers.size;
    androidActiveMembers = androidMembers.size;
  }
  if (ministryCount > 0) {
    const leaderKeys = (leaderResult.data ?? []).map(
      ({ ministry_key }) => ministry_key,
    );
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

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard-header">
        <Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority />
        <div className="admin-dashboard-actions">
          <Link href="/familia">Área da Família</Link>
        </div>
      </header>

      <section className="admin-dashboard-hero">
        <p className="section-eyebrow"><span aria-hidden="true" />{isAdmin ? "Painel administrativo" : "Meu painel de liderança"}</p>
        <h1>Olá, {profile.full_name || "Família"}.</h1>
        <p>{isAdmin ? "Você possui a visão administrativa completa da Casa." : "Aqui aparecem somente as áreas e pessoas confiadas à sua liderança."}</p>
      </section>

      {isAdmin && <section className="admin-app-metrics" aria-labelledby="admin-app-metrics-title">
        <header>
          <div>
            <span>Aplicativos da Casa</span>
            <h2 id="admin-app-metrics-title">Downloads e uso</h2>
          </div>
          <Link href="/admin/presencas#device-audit-title">Ver membros identificados →</Link>
        </header>
        <div className="admin-app-metrics-grid">
          <article data-platform="ios">
            <div><AppleMark /><span>iPhone · iOS</span></div>
            <dl>
              <div><dt>Downloads iniciados</dt><dd>{iosDownloadCount}</dd></div>
              <div><dt>Já usam o app</dt><dd>{iosActiveMembers}</dd></div>
            </dl>
          </article>
          <article data-platform="android">
            <div><AndroidMark /><span>Android</span></div>
            <dl>
              <div><dt>Downloads iniciados</dt><dd>{androidDownloadCount}</dd></div>
              <div><dt>Já usam o app</dt><dd>{androidActiveMembers}</dd></div>
            </dl>
          </article>
        </div>
        <p>Os downloads iniciados contam aparelhos únicos que abriram as lojas pelos botões oficiais do site desde 20/09/2026. “Já usam” mostra membros com aparelho identificado e notificações ativas.</p>
      </section>}

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
          <Module number="IA" href="/admin/assistente" title="IA da Casa" copy="Ensine respostas verificadas e controle o que a assistente pode dizer no site." action="Ensinar a IA" />
          <Module number="09" href="/admin/eventos" title="Eventos e Inscrições" copy="Crie eventos, acompanhe participantes, vagas e cada etapa das inscrições." action="Gerenciar eventos" />
          <Module number="10" href="/admin/financeiro" title="Financeiro" copy="Acompanhe contas, pagamentos, resumo mensal e entradas dos extratos." action="Abrir financeiro" />
          <Module number="11" href="/admin/presencas" title="Confirmações" copy="Veja quem confirmou presença nos cultos e eventos e quais membros já possuem um dispositivo identificado." action="Acompanhar presenças" />
        </>}

        {!isAdmin && isDiscipler && <Module number="01" href="/admin/meus-discipulos" title="Meus discípulos" copy="Acompanhe somente as pessoas confiadas ao seu discipulado." action="Abrir meus discípulos" />}
        {!isAdmin && (isDiscipler || isPastoralTeam) && <Module number={isDiscipler ? "02" : "01"} href="/familia/agenda-pastoral" title="Agenda Pastoral" copy="Escolha um horário disponível para seu discipulado com os pastores." action="Ver horários livres" />}
        {!isAdmin && ministryCount > 0 && <Module number={isDiscipler ? "03" : "01"} href="/admin/meu-ministerio" title={ministryCount === 1 ? "Meu ministério" : "Meus ministérios"} copy="Veja as pessoas que servem nas áreas sob sua liderança." action="Abrir minha equipe" notice={pendingServeRequests > 0 ? `${pendingServeRequests} ${pendingServeRequests === 1 ? "novo pedido" : "novos pedidos"} para analisar` : undefined} />}
        {!isAdmin && canManageVisitors && <Module number={isDiscipler && ministryCount > 0 ? "03" : isDiscipler || ministryCount > 0 ? "02" : "01"} href="/admin/visitantes" title="Visitantes" copy="Acolha as pessoas que preencheram o cadastro de visitante." action="Acessar visitantes" notice={overdueVisitorSteps > 0 ? `${overdueVisitorSteps} contatos pendentes` : undefined} />}
        {!isAdmin && canManageFinance && <Module number="F" href="/admin/financeiro" title="Financeiro" copy="Registre entradas de culto, contas, pagamentos e confira os resumos financeiros." action="Abrir financeiro" />}
        {!isAdmin && canManageEvents && <Module number="E" href="/admin/eventos" title="Eventos e Inscrições" copy="Crie e edite eventos, acompanhe inscrições e organize os participantes." action="Gerenciar eventos" />}
      </section>
      <AdminCalendarTicker />
    </main>
  );
}

function AppleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.7 12.8c0-2.1 1.7-3.2 1.8-3.3a4.1 4.1 0 0 0-3.2-1.7c-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-3-.8a4.4 4.4 0 0 0-3.7 2.3c-1.6 2.8-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3.1-.7 1.4 0 1.9.7 3.1.7 1.3 0 2.1-1.1 2.8-2.2.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.8-1.1-2.8-3.6ZM14.4 6.4c.6-.8 1-1.9.9-3-.9 0-2 .6-2.7 1.3-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.8-1.2Z" fill="currentColor" /></svg>;
}

function AndroidMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7.2 8.2-1.5-2.6.9-.5 1.6 2.7a9 9 0 0 1 7.6 0l1.6-2.7.9.5-1.5 2.6A7 7 0 0 1 20 13H4a7 7 0 0 1 3.2-4.8ZM8.5 11a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6Zm7 0a.8.8 0 1 0 0-1.6.8.8 0 0 0 0 1.6ZM4 14h16v5.2c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8V14Z" fill="currentColor" /></svg>;
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
