import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSaoPauloDateKey } from "@/lib/calendar-events";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Confirmações de presença | Painel administrativo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Member = { user_id: string; full_name: string | null; email: string; phone: string | null };
type Confirmation = { id: string; event_key: string; event_title: string; event_date: string; event_time: string | null; user_id: string; created_at: string };
type Subscription = { user_id: string; user_agent: string | null; created_at: string; updated_at: string; last_success_at: string | null; failure_count: number };

function displayName(member: Member | undefined) {
  return member?.full_name?.trim() || member?.email || "Membro";
}

function platform(userAgent: string | null) {
  const value = userAgent?.toLowerCase() ?? "";
  if (value.includes("iphone") || value.includes("ipad")) return "iPhone / iPad";
  if (value.includes("android")) return "Android";
  if (value.includes("macintosh") || value.includes("mac os")) return "Mac";
  if (value.includes("windows")) return "Windows";
  return "Outro dispositivo";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export default async function AttendanceAdminPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("member_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/admin");

  const service = getSupabaseServiceClient();
  const [confirmationResult, memberResult, subscriptionResult] = await Promise.all([
    service.from("event_attendance_confirmations").select("id,event_key,event_title,event_date,event_time,user_id,created_at").eq("status", "confirmed").order("event_date", { ascending: true }).order("event_time", { ascending: true }),
    service.from("member_profiles").select("user_id,full_name,email,phone").or("approval_status.eq.approved,approved_at.not.is.null").order("full_name"),
    service.from("web_push_subscriptions").select("user_id,user_agent,created_at,updated_at,last_success_at,failure_count"),
  ]);

  const confirmations = (confirmationResult.data ?? []) as Confirmation[];
  const members = (memberResult.data ?? []) as Member[];
  const subscriptions = (subscriptionResult.data ?? []) as Subscription[];
  const memberById = new Map(members.map((member) => [member.user_id, member]));
  const today = getSaoPauloDateKey();

  const grouped = new Map<string, Confirmation[]>();
  for (const confirmation of confirmations) {
    const key = `${confirmation.event_key}:${confirmation.event_date}`;
    grouped.set(key, [...(grouped.get(key) ?? []), confirmation]);
  }
  const eventGroups = [...grouped.values()].sort((first, second) => {
    const firstUpcoming = first[0].event_date >= today ? 0 : 1;
    const secondUpcoming = second[0].event_date >= today ? 0 : 1;
    return firstUpcoming - secondUpcoming || first[0].event_date.localeCompare(second[0].event_date);
  });

  const deviceByMember = new Map<string, { platforms: Set<string>; lastActivity: string; subscriptions: number }>();
  for (const subscription of subscriptions) {
    const activity = subscription.last_success_at || subscription.updated_at || subscription.created_at;
    const current = deviceByMember.get(subscription.user_id);
    if (!current) {
      deviceByMember.set(subscription.user_id, { platforms: new Set([platform(subscription.user_agent)]), lastActivity: activity, subscriptions: 1 });
      continue;
    }
    current.platforms.add(platform(subscription.user_agent));
    current.subscriptions += 1;
    if (activity > current.lastActivity) current.lastActivity = activity;
  }
  const withDevice = members.filter((member) => deviceByMember.has(member.user_id));
  const withoutDevice = members.filter((member) => !deviceByMember.has(member.user_id));
  const upcomingConfirmations = confirmations.filter((item) => item.event_date >= today).length;

  return (
    <main className="admin-attendance-page">
      <header className="admin-section-header">
        <Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link>
        <nav><Link href="/admin">Voltar ao painel</Link><Link href="/calendario">Abrir calendário</Link></nav>
      </header>

      <section className="admin-attendance-hero">
        <p className="section-eyebrow"><span aria-hidden="true" />Cultos e eventos</p>
        <h1>Confirmações de presença</h1>
        <p>Acompanhe quem pretende participar e veja quais membros já possuem um aparelho identificado para receber notificações.</p>
      </section>

      <section className="admin-attendance-summary" aria-label="Resumo das confirmações e dispositivos">
        <article><span>01</span><strong>{upcomingConfirmations}</strong><p>presenças confirmadas nos próximos eventos</p></article>
        <article><span>02</span><strong>{withDevice.length}</strong><p>membros com dispositivo identificado</p></article>
        <article><span>03</span><strong>{withoutDevice.length}</strong><p>membros sem dispositivo identificado</p></article>
      </section>

      <section className="admin-attendance-events" aria-labelledby="attendance-events-title">
        <div className="admin-attendance-heading"><div><p className="home-kicker">Quem confirmou</p><h2 id="attendance-events-title">Presenças por programação</h2></div><p>Os eventos futuros aparecem primeiro. A confirmação pode ser alterada pelo próprio membro.</p></div>
        {eventGroups.length ? <div className="admin-attendance-event-grid">{eventGroups.map((items) => {
          const event = items[0];
          return <article key={`${event.event_key}-${event.event_date}`} data-past={event.event_date < today}>
            <header><div><span>{event.event_date < today ? "Evento realizado" : "Próxima programação"}</span><h3>{event.event_title}</h3><p>{formatDate(event.event_date)}{event.event_time ? ` · ${event.event_time.slice(0, 5)}` : ""}</p></div><strong>{items.length}<small>{items.length === 1 ? " pessoa" : " pessoas"}</small></strong></header>
            <ul>{items.sort((a, b) => displayName(memberById.get(a.user_id)).localeCompare(displayName(memberById.get(b.user_id)), "pt-BR")).map((item) => {
              const member = memberById.get(item.user_id);
              return <li key={item.id}><Link href={`/admin/membros/${item.user_id}`}>{displayName(member)}</Link><span>{member?.phone || member?.email || "Cadastro da Família"}</span></li>;
            })}</ul>
          </article>;
        })}</div> : <p className="admin-attendance-empty">Ainda não há confirmações de presença.</p>}
      </section>

      <section className="admin-device-audit" aria-labelledby="device-audit-title">
        <div className="admin-attendance-heading"><div><p className="home-kicker">Aplicativo e notificações</p><h2 id="device-audit-title">Dispositivos dos membros</h2></div><p>“Identificado” significa que o membro abriu o app/site neste aparelho e autorizou o registro de notificações. Apple e Google não fornecem uma lista nominal de downloads.</p></div>
        <div className="admin-device-columns">
          <details open><summary><span>Com dispositivo identificado</span><strong>{withDevice.length}</strong></summary><ul>{withDevice.map((member) => {
            const device = deviceByMember.get(member.user_id)!;
            return <li key={member.user_id}><Link href={`/admin/membros/${member.user_id}`}>{displayName(member)}</Link><span>{[...device.platforms].join(" + ")} · atividade {formatDateTime(device.lastActivity)}</span></li>;
          })}</ul></details>
          <details><summary><span>Sem dispositivo identificado</span><strong>{withoutDevice.length}</strong></summary><ul>{withoutDevice.map((member) => <li key={member.user_id}><Link href={`/admin/membros/${member.user_id}`}>{displayName(member)}</Link><span>{member.phone || member.email}</span></li>)}</ul></details>
        </div>
      </section>
    </main>
  );
}
