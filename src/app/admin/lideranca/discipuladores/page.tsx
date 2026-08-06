import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  addDisciple,
  addDiscipler,
  removeDisciple,
  removeDiscipler,
  setDisciplerAvailability,
} from "../actions";
import { getLeadershipAdmin, type MemberOption } from "../shared";
import "../leadership.css";

export const metadata: Metadata = {
  title: "Discipuladores",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Relationship = {
  id: string;
  discipler_id: string;
  disciple_id: string;
};

type Session = {
  relationship_id: string;
  meeting_date: string;
};

function daysSince(date: string | undefined) {
  if (!date) return null;
  const today = new Date();
  const meeting = new Date(`${date}T12:00:00-03:00`);
  return Math.max(0, Math.floor((today.getTime() - meeting.getTime()) / 86400000));
}

function followUpLabel(date: string | undefined) {
  const days = daysSince(date);
  if (days === null) return "Ainda sem discipulado registrado";
  if (days === 0) return "Discipulado realizado hoje";
  if (days === 1) return "Último discipulado há 1 dia";
  return `Último discipulado há ${days} dias`;
}

export default async function DisciplersPage({
  searchParams,
}: {
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
}) {
  const supabase = await getLeadershipAdmin();
  const params = await searchParams;
  const [membersResult, disciplersResult, relationshipsResult, sessionsResult] =
    await Promise.all([
      supabase
        .from("member_profiles")
        .select("user_id,full_name,email")
        .eq("approval_status", "approved")
        .order("full_name"),
      supabase.from("discipler_roles").select("member_id,available_for_member_choice"),
      supabase
        .from("discipleship_relationships")
        .select("id,discipler_id,disciple_id")
        .is("ended_at", null)
        .order("created_at"),
      supabase
        .from("discipleship_sessions")
        .select("relationship_id,meeting_date")
        .order("meeting_date", { ascending: false }),
    ]);

  const members = (membersResult.data ?? []) as MemberOption[];
  const memberById = new Map(members.map((member) => [member.user_id, member]));
  const disciplerIds = (disciplersResult.data ?? []).map((item) => item.member_id);
  const availableDisciplerIds = new Set(
    (disciplersResult.data ?? [])
      .filter((item) => item.available_for_member_choice)
      .map((item) => item.member_id),
  );
  const relationships = (relationshipsResult.data ?? []) as Relationship[];
  const sessions = (sessionsResult.data ?? []) as Session[];
  const assignedDiscipleIds = new Set(relationships.map((item) => item.disciple_id));
  const latestSessionByRelationship = new Map<string, string>();
  for (const session of sessions) {
    if (!latestSessionByRelationship.has(session.relationship_id)) {
      latestSessionByRelationship.set(session.relationship_id, session.meeting_date);
    }
  }

  return (
    <main className="admin-visitors-page leadership-admin-page">
      <header className="admin-section-header">
        <Link href="/admin" aria-label="Voltar ao início do painel">
          <Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority />
        </Link>
        <nav aria-label="Navegação administrativa"><Link href="/admin">Voltar ao painel</Link></nav>
      </header>

      <section className="admin-visitors-hero leadership-admin-hero">
        <p className="section-eyebrow"><span aria-hidden="true" />Cuidado pastoral</p>
        <h1>Discipuladores</h1>
        <p>Cadastre os discípulos de cada pessoa e acompanhe quando aconteceu o último discipulado.</p>
      </section>

      <nav className="leadership-tabs" aria-label="Áreas de classificação">
        <Link href="/admin/lideranca/discipuladores" aria-current="page">Discipuladores <span>{disciplerIds.length}</span></Link>
        <Link href="/admin/lideranca/ministerios">Ministérios</Link>
      </nav>

      {(params.sucesso || params.erro) && (
        <p className="leadership-feedback" data-kind={params.erro ? "error" : "success"} role="status">
          {params.erro ?? params.sucesso}
        </p>
      )}

      <section className="leadership-panel" aria-labelledby="discipler-title">
        <header>
          <div><span>Nova função</span><h2 id="discipler-title">Cadastrar discipulador</h2><p>Depois, abra a pessoa abaixo para vincular seus discípulos.</p></div>
          <form action={addDiscipler} className="leadership-add-form">
            <label htmlFor="discipler-member">Escolha uma pessoa</label>
            <div>
              <select id="discipler-member" name="memberId" required>
                <option value="">Selecionar membro</option>
                {members.filter((member) => !disciplerIds.includes(member.user_id)).map((member) => (
                  <option value={member.user_id} key={member.user_id}>{member.full_name || member.email}</option>
                ))}
              </select>
              <button type="submit">Salvar discipulador</button>
            </div>
          </form>
        </header>
      </section>

      <section className="discipler-management-list" aria-label="Discipuladores cadastrados">
        {disciplerIds.length === 0 ? (
          <p className="leadership-empty">Nenhum discipulador classificado.</p>
        ) : disciplerIds.map((disciplerId) => {
          const discipler = memberById.get(disciplerId);
          if (!discipler) return null;
          const disciples = relationships.filter((item) => item.discipler_id === disciplerId);

          return (
            <details className="discipler-management-card" key={disciplerId} open={disciplerIds.length === 1}>
              <summary>
                <div><span>Discipulador(a)</span><h2>{discipler.full_name || discipler.email}</h2></div>
                <strong>
                  {availableDisciplerIds.has(disciplerId) ? "Disponível aos membros · " : ""}
                  {disciples.length} {disciples.length === 1 ? "discípulo" : "discípulos"}
                </strong>
              </summary>
              <div className="discipler-management-content">
                <div className="discipler-management-tools">
                  <Link href={`/admin/membros/${disciplerId}`}>Abrir ficha do discipulador</Link>
                  <form action={setDisciplerAvailability}>
                    <input type="hidden" name="memberId" value={disciplerId} />
                    <input type="hidden" name="available" value={availableDisciplerIds.has(disciplerId) ? "false" : "true"} />
                    <button type="submit">
                      {availableDisciplerIds.has(disciplerId) ? "Retirar da escolha dos membros" : "Disponibilizar para novos discípulos"}
                    </button>
                  </form>
                  <form action={removeDiscipler}><input type="hidden" name="memberId" value={disciplerId} /><button type="submit">Remover função</button></form>
                </div>

                <form action={addDisciple} className="leadership-add-form discipler-add-disciple">
                  <input type="hidden" name="disciplerId" value={disciplerId} />
                  <label htmlFor={`disciple-${disciplerId}`}>Cadastrar discípulo desta pessoa</label>
                  <div>
                    <select id={`disciple-${disciplerId}`} name="discipleId" required>
                      <option value="">Selecionar membro</option>
                      {members.filter((member) => member.user_id !== disciplerId && !assignedDiscipleIds.has(member.user_id)).map((member) => (
                        <option value={member.user_id} key={member.user_id}>{member.full_name || member.email}</option>
                      ))}
                    </select>
                    <button type="submit">Cadastrar discípulo</button>
                  </div>
                </form>

                <div className="disciple-admin-grid">
                  {disciples.length === 0 ? <p className="leadership-empty">Nenhum discípulo cadastrado para esta pessoa.</p> : disciples.map((relationship) => {
                    const disciple = memberById.get(relationship.disciple_id);
                    if (!disciple) return null;
                    const latestDate = latestSessionByRelationship.get(relationship.id);
                    const elapsed = daysSince(latestDate);
                    return (
                      <article className="disciple-admin-card" key={relationship.id} data-attention={elapsed === null || elapsed >= 30}>
                        <div><span>Discípulo(a)</span><h3>{disciple.full_name || disciple.email}</h3><p>{followUpLabel(latestDate)}</p></div>
                        <div className="disciple-admin-actions">
                          <Link href={`/familia/lideranca/discipulos/${relationship.id}`}>Abrir acompanhamento</Link>
                          <Link href={`/admin/membros/${relationship.disciple_id}`}>Ver ficha</Link>
                          <form action={removeDisciple}><input type="hidden" name="relationshipId" value={relationship.id} /><button type="submit">Remover vínculo</button></form>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </details>
          );
        })}
      </section>
    </main>
  );
}
