import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { addDiscipleshipSession } from "../../actions";
import "./discipleship.css";

export const metadata: Metadata = {
  title: "Acompanhamento de discipulado",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Session = {
  id: string;
  meeting_date: string;
  main_demands: string | null;
  notes: string | null;
  created_at: string;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function daysSince(date: string | undefined) {
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(`${date}T12:00:00-03:00`).getTime()) / 86400000));
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export default async function DiscipleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ relationshipId: string }>;
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
}) {
  const { relationshipId } = await params;
  if (!UUID_PATTERN.test(relationshipId)) notFound();

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/familia/login");

  const [{ data: profile }, { data: relationship }, { data: sessionRows }, query] = await Promise.all([
    supabase.from("member_profiles").select("full_name,is_admin,approval_status").eq("user_id", user.id).maybeSingle(),
    supabase.from("discipleship_relationships").select("id,discipler_id,disciple_id").eq("id", relationshipId).maybeSingle(),
    supabase.from("discipleship_sessions").select("id,meeting_date,main_demands,notes,created_at").eq("relationship_id", relationshipId).order("meeting_date", { ascending: false }).order("created_at", { ascending: false }),
    searchParams,
  ]);

  if (!profile || (!profile.is_admin && profile.approval_status !== "approved")) redirect("/familia");
  if (!relationship) notFound();

  const service = getSupabaseServiceClient();
  const { data: people } = await service
    .from("member_profiles")
    .select("user_id,full_name,email,phone,photo_url")
    .in("user_id", [relationship.discipler_id, relationship.disciple_id]);
  const disciple = people?.find((person) => person.user_id === relationship.disciple_id);
  const discipler = people?.find((person) => person.user_id === relationship.discipler_id);
  if (!disciple) notFound();

  let signedPhotoUrl: string | null = null;
  if (disciple.photo_url) {
    const { data } = await service.storage.from("member-profile-photos").createSignedUrl(disciple.photo_url, 15 * 60);
    signedPhotoUrl = data?.signedUrl ?? null;
  }

  const sessions = (sessionRows ?? []) as Session[];
  const latestDate = sessions[0]?.meeting_date;
  const elapsed = daysSince(latestDate);
  const backHref = profile.is_admin ? "/admin/lideranca/discipuladores" : "/familia/lideranca";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  return (
    <main className="inner-page discipleship-detail-page">
      <header className="inner-header">
        <Link href="/"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={180} height={70} priority /></Link>
        <Link className="inner-back" href={backHref}>Voltar aos discipulados</Link>
      </header>

      <section className="discipleship-detail-hero">
        <div className="discipleship-photo">
          {signedPhotoUrl ? <Image src={signedPhotoUrl} alt={`Foto de ${disciple.full_name}`} fill sizes="150px" unoptimized /> : <span>{initials(disciple.full_name || disciple.email)}</span>}
        </div>
        <div>
          <p className="section-eyebrow"><span aria-hidden="true" />Acompanhamento pastoral</p>
          <h1>{disciple.full_name || disciple.email}</h1>
          <p>Discipulador(a): <strong>{discipler?.full_name || "Não informado"}</strong></p>
          {profile.is_admin && <Link className="discipleship-profile-link" href={`/admin/membros/${disciple.user_id}`}>Abrir ficha técnica completa</Link>}
        </div>
      </section>

      <section className="discipleship-counter" data-attention={elapsed === null || elapsed >= 30}>
        <span>Tempo desde o último discipulado</span>
        <strong>{elapsed === null ? "Sem registro" : elapsed === 0 ? "Hoje" : `${elapsed} ${elapsed === 1 ? "dia" : "dias"}`}</strong>
        <p>{latestDate ? `Último encontro em ${formatDate(latestDate)}.` : "Cadastre abaixo o primeiro encontro de discipulado."}</p>
      </section>

      {(query.sucesso || query.erro) && <p className="discipleship-feedback" data-kind={query.erro ? "error" : "success"} role="status">{query.erro ?? query.sucesso}</p>}

      <section className="discipleship-workspace">
        <form action={addDiscipleshipSession} className="discipleship-session-form">
          <input type="hidden" name="relationshipId" value={relationshipId} />
          <header><span>Novo registro</span><h2>Registrar discipulado</h2><p>Anote a data, as demandas principais e as observações importantes deste encontro.</p></header>
          <label>Data do discipulado<input type="date" name="meetingDate" max={today} defaultValue={today} required /></label>
          <label>Principais demandas<textarea name="mainDemands" rows={5} maxLength={4000} placeholder="Ex.: família, vida espiritual, decisões, saúde emocional…" /></label>
          <label>Observações do discipulador<textarea name="notes" rows={7} maxLength={8000} placeholder="Registre aqui o acompanhamento, combinados e pontos importantes para o próximo encontro." /></label>
          <button type="submit">Salvar acompanhamento</button>
        </form>

        <section className="discipleship-history" aria-labelledby="history-title">
          <header><span>Histórico privado</span><h2 id="history-title">Encontros anteriores</h2></header>
          {sessions.length === 0 ? <p className="discipleship-empty">Nenhum discipulado registrado ainda.</p> : sessions.map((session) => (
            <article key={session.id}>
              <time dateTime={session.meeting_date}>{formatDate(session.meeting_date)}</time>
              {session.main_demands && <div><strong>Principais demandas</strong><p>{session.main_demands}</p></div>}
              {session.notes && <div><strong>Observações</strong><p>{session.notes}</p></div>}
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
