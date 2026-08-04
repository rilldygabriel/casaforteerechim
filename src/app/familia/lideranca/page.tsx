import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MINISTRIES } from "@/app/familia/servir/ministries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
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

export default async function FamilyLeadershipPage() {
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
  }

  const memberById = new Map(teamMembers.map((member) => [member.user_id, member]));
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

      <section className="family-leadership-grid">
        {isDiscipler && (
          <article className="family-leadership-role-card is-featured">
            <span>Discipulado</span>
            <h2>Você é discipulador(a)</h2>
            <p>
              Seu acesso está liberado. Na próxima etapa, seus discípulos serão
              vinculados e aparecerão aqui.
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

      {leaderAssignments.length > 0 && (
        <section className="family-leadership-teams">
          <header>
            <span>Áreas sob meu cuidado</span>
            <h2>Meus ministérios</h2>
          </header>

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
