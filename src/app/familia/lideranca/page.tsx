import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MINISTRIES } from "@/app/familia/servir/ministries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { releaseDisciple } from "./actions";
import "./leadership.css";

export const metadata: Metadata = {
  title: "Minha liderança",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type MinistryAssignment = {
  ministry_key: string;
  member_id?: string;
};

type TeamMember = {
  user_id: string;
  full_name: string;
};

type DiscipleRelationship = {
  id: string;
  disciple_id: string;
};

type DiscipleSession = {
  relationship_id: string;
  meeting_date: string;
};

function daysSince(date: string | undefined) {
  if (!date) return null;
  return Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(`${date}T12:00:00-03:00`).getTime()) / 86400000,
    ),
  );
}

export default async function FamilyLeadershipPage({
  searchParams,
}: {
  searchParams: Promise<{ sucesso?: string; erro?: string }>;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/familia/login");
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("full_name,is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !profile ||
    (!profile.is_admin && profile.approval_status !== "approved")
  ) {
    redirect("/familia");
  }

  const [disciplerResult, leaderResult, memberResult] = await Promise.all([
    supabase
      .from("discipler_roles")
      .select("member_id")
      .eq("member_id", user.id)
      .maybeSingle(),
    supabase
      .from("ministry_leaders")
      .select("ministry_key")
      .eq("member_id", user.id),
    supabase
      .from("ministry_members")
      .select("ministry_key")
      .eq("member_id", user.id),
  ]);

  const isDiscipler = Boolean(disciplerResult.data);
  const leaderAssignments = (leaderResult.data ?? []) as MinistryAssignment[];
  const memberAssignments = (memberResult.data ?? []) as MinistryAssignment[];
  const leaderKeys = leaderAssignments.map((assignment) => assignment.ministry_key);

  if (
    !profile.is_admin &&
    !isDiscipler &&
    leaderAssignments.length === 0 &&
    memberAssignments.length === 0
  ) {
    redirect("/familia");
  }

  let teamAssignments: MinistryAssignment[] = [];
  let teamMembers: TeamMember[] = [];
  let discipleRelationships: DiscipleRelationship[] = [];
  let discipleSessions: DiscipleSession[] = [];
  let discipleProfiles: TeamMember[] = [];
  let pendingServeRequestCount = 0;

  if (isDiscipler) {
    const { data: relationships } = await supabase
      .from("discipleship_relationships")
      .select("id,disciple_id")
      .eq("discipler_id", user.id)
      .is("ended_at", null)
      .order("created_at");
    discipleRelationships = (relationships ?? []) as DiscipleRelationship[];

    const relationshipIds = discipleRelationships.map((relationship) => relationship.id);
    const discipleIds = discipleRelationships.map((relationship) => relationship.disciple_id);

    if (relationshipIds.length > 0) {
      const { data: sessions } = await supabase
        .from("discipleship_sessions")
        .select("relationship_id,meeting_date")
        .in("relationship_id", relationshipIds)
        .order("meeting_date", { ascending: false });
      discipleSessions = (sessions ?? []) as DiscipleSession[];

      try {
        const serviceSupabase = getSupabaseServiceClient();
        const { data: profiles } = await serviceSupabase
          .from("member_profiles")
          .select("user_id,full_name")
          .in("user_id", discipleIds)
          .eq("approval_status", "approved");
        discipleProfiles = (profiles ?? []) as TeamMember[];
      } catch {
        discipleProfiles = [];
      }
    }
  }

  if (leaderKeys.length > 0) {
    const { data } = await supabase
      .from("ministry_members")
      .select("ministry_key,member_id")
      .in("ministry_key", leaderKeys);
    teamAssignments = (data ?? []) as MinistryAssignment[];

    const memberIds = Array.from(
      new Set(teamAssignments.map((assignment) => assignment.member_id).filter(Boolean)),
    ) as string[];

    if (memberIds.length > 0) {
      try {
        const serviceSupabase = getSupabaseServiceClient();
        const { data: profiles } = await serviceSupabase
          .from("member_profiles")
          .select("user_id,full_name")
          .in("user_id", memberIds)
          .eq("approval_status", "approved");
        teamMembers = (profiles ?? []) as TeamMember[];
      } catch {
        teamMembers = [];
      }
    }

    try {
      const serviceSupabase = getSupabaseServiceClient();
      const { count } = await serviceSupabase
        .from("ministry_membership_requests")
        .select("member_id", { count: "exact", head: true })
        .in("ministry_key", leaderKeys)
        .eq("status", "pending");
      pendingServeRequestCount = count ?? 0;
    } catch {
      pendingServeRequestCount = 0;
    }
  }

  const memberById = new Map(teamMembers.map((member) => [member.user_id, member]));
  const discipleById = new Map(
    discipleProfiles.map((member) => [member.user_id, member]),
  );
  const latestSessionByRelationship = new Map<string, string>();
  for (const session of discipleSessions) {
    if (!latestSessionByRelationship.has(session.relationship_id)) {
      latestSessionByRelationship.set(session.relationship_id, session.meeting_date);
    }
  }
  const ministryByKey = new Map(MINISTRIES.map((ministry) => [ministry.key, ministry]));

  return (
    <main className="inner-page family-leadership-page">
      <header className="inner-header">
        <Link href="/" aria-label="Voltar para o início">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={180}
            height={70}
            priority
          />
        </Link>
        <Link className="inner-back" href="/familia">
          Voltar à Área da Família
        </Link>
      </header>

      <section className="family-leadership-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Minha liderança
        </p>
        <h1>
          Olá, <strong>{profile.full_name || "Família"}.</strong>
        </h1>
        <p>
          Aqui estão as funções e equipes que a liderança da Casa confiou a
          você.
        </p>
      </section>

      {(params.sucesso || params.erro) && (
        <p className="family-leadership-feedback" data-kind={params.erro ? "error" : "success"} role="status">
          {params.erro ?? params.sucesso}
        </p>
      )}

      <section className="family-leadership-grid">
        {isDiscipler && (
          <article className="family-leadership-role-card is-featured">
            <span>Discipulado</span>
            <h2>Você é discipulador(a)</h2>
            <p>
              Seu acesso está liberado. Acompanhe seus discípulos, demandas e
              o tempo desde o último encontro.
            </p>
          </article>
        )}

        {memberAssignments.map((assignment) => {
          const ministry = ministryByKey.get(assignment.ministry_key);
          if (!ministry) return null;

          return (
            <article className="family-leadership-role-card" key={`member-${ministry.key}`}>
              <span>Onde sirvo</span>
              <h2>{ministry.label}</h2>
              <p>Você está cadastrado(a) como participante deste ministério.</p>
            </article>
          );
        })}
      </section>

      {isDiscipler && (
        <section className="family-discipleship-section">
          <header>
            <span>Pessoas sob meu cuidado</span>
            <h2>Meus discípulos</h2>
            <p>Abra uma pessoa para registrar um novo discipulado e consultar todo o histórico.</p>
          </header>
          <div>
            {discipleRelationships.length === 0 ? (
              <p className="family-discipleship-empty">A liderança ainda não vinculou discípulos à sua conta.</p>
            ) : discipleRelationships.map((relationship) => {
              const disciple = discipleById.get(relationship.disciple_id);
              const latestDate = latestSessionByRelationship.get(relationship.id);
              const elapsed = daysSince(latestDate);
              return (
                <article className="family-disciple-card" key={relationship.id} data-attention={elapsed === null || elapsed >= 30}>
                  <Link href={`/familia/lideranca/discipulos/${relationship.id}`}>
                    <span>Discípulo(a)</span>
                    <h3>{disciple?.full_name || "Membro da Família"}</h3>
                    <strong>
                      {elapsed === null
                        ? "Sem discipulado registrado"
                        : elapsed === 0
                          ? "Discipulado realizado hoje"
                          : `Último discipulado há ${elapsed} ${elapsed === 1 ? "dia" : "dias"}`}
                    </strong>
                    <small>Abrir acompanhamento →</small>
                  </Link>
                  <form action={releaseDisciple}>
                    <input type="hidden" name="relationshipId" value={relationship.id} />
                    <label>
                      <input type="checkbox" required />
                      Confirmo a liberação deste discípulo
                    </label>
                    <button type="submit">Liberar para novo discipulador</button>
                  </form>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {leaderAssignments.length > 0 && (
        <section className="family-leadership-teams">
          <header>
            <span>Áreas sob meu cuidado</span>
            <h2>Meus ministérios</h2>
          </header>

          {pendingServeRequestCount > 0 && (
            <Link
              className="family-leadership-request-alert"
              href="/admin/meu-ministerio"
            >
              <strong>{pendingServeRequestCount}</strong>
              <span>
                {pendingServeRequestCount === 1
                  ? "novo pedido para servir"
                  : "novos pedidos para servir"}
                <small>Toque para abrir e analisar agora →</small>
              </span>
            </Link>
          )}

          {leaderAssignments.map((assignment) => {
            const ministry = ministryByKey.get(assignment.ministry_key);
            if (!ministry) return null;
            const assignments = teamAssignments.filter(
              (teamAssignment) => teamAssignment.ministry_key === ministry.key,
            );

            return (
              <article key={`leader-${ministry.key}`}>
                <div>
                  <span>Líder de ministério</span>
                  <h3>{ministry.label}</h3>
                </div>
                <ul>
                  {assignments.length === 0 ? (
                    <li>Nenhum participante cadastrado ainda.</li>
                  ) : (
                    assignments.map((teamAssignment) => (
                      <li key={teamAssignment.member_id}>
                        {memberById.get(teamAssignment.member_id ?? "")?.full_name ??
                          "Membro da equipe"}
                      </li>
                    ))
                  )}
                </ul>
              </article>
            );
          })}
        </section>
      )}

      {profile.is_admin && (
        <Link className="family-leadership-admin-link" href="/admin/lideranca">
          Abrir classificação administrativa
        </Link>
      )}
    </main>
  );
}
