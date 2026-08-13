import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MINISTRIES } from "@/app/familia/servir/ministries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  addDiscipler,
  addMinistryAssignment,
  removeDiscipler,
  removeMinistryAssignment,
} from "./actions";
import "./leadership.css";

export const metadata: Metadata = {
  title: "Liderança e ministérios",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type MemberOption = {
  user_id: string;
  full_name: string;
  email: string;
};

type Assignment = {
  ministry_key: string;
  member_id: string;
};

export default async function LeadershipAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    aba?: string;
    sucesso?: string;
    erro?: string;
  }>;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin || profile.approval_status !== "approved") {
    redirect("/familia");
  }

  const params = await searchParams;
  const activeTab = params.aba === "ministerios" ? "ministerios" : "discipuladores";
  const [membersResult, disciplersResult, leadersResult, ministryMembersResult] =
    await Promise.all([
      supabase
        .from("member_profiles")
        .select("user_id,full_name,email")
        .eq("approval_status", "approved")
        .order("full_name"),
      supabase.from("discipler_roles").select("member_id"),
      supabase.from("ministry_leaders").select("ministry_key,member_id"),
      supabase.from("ministry_members").select("ministry_key,member_id"),
    ]);

  const members = (membersResult.data ?? []) as MemberOption[];
  const memberById = new Map(members.map((member) => [member.user_id, member]));
  const disciplerIds = new Set(
    (disciplersResult.data ?? []).map((assignment) => assignment.member_id),
  );
  const leaders = (leadersResult.data ?? []) as Assignment[];
  const ministryMembers = (ministryMembersResult.data ?? []) as Assignment[];

  return (
    <main className="admin-visitors-page leadership-admin-page">
      <header className="admin-section-header">
        <Link href="/admin" aria-label="Voltar ao início do painel">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={190}
            height={74}
            priority
          />
        </Link>
        <nav aria-label="Navegação administrativa">
          <Link href="/admin">Voltar ao painel</Link>
        </nav>
      </header>

      <section className="admin-visitors-hero leadership-admin-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Classificação da Família
        </p>
        <h1>Liderança</h1>
        <p>
          Defina discipuladores, líderes e participantes. Cada acesso é liberado
          automaticamente na conta que a pessoa já usa na Área da Família.
        </p>
      </section>

      <nav className="leadership-tabs" aria-label="Áreas de classificação">
        <Link
          href="/admin/lideranca?aba=discipuladores"
          aria-current={activeTab === "discipuladores" ? "page" : undefined}
        >
          Discipuladores
          <span>{disciplerIds.size}</span>
        </Link>
        <Link
          href="/admin/lideranca?aba=ministerios"
          aria-current={activeTab === "ministerios" ? "page" : undefined}
        >
          Ministérios
          <span>{MINISTRIES.length}</span>
        </Link>
      </nav>

      {(params.sucesso || params.erro) && (
        <p
          className="leadership-feedback"
          data-kind={params.erro ? "error" : "success"}
          role="status"
        >
          {params.erro ?? params.sucesso}
        </p>
      )}

      {activeTab === "discipuladores" ? (
        <section className="leadership-panel" aria-labelledby="discipler-title">
          <header>
            <div>
              <span>Área 01</span>
              <h2 id="discipler-title">Discipuladores</h2>
              <p>Essa função é independente de qualquer ministério.</p>
            </div>
            <form action={addDiscipler} className="leadership-add-form">
              <label htmlFor="discipler-member">Escolha uma pessoa</label>
              <div>
                <select id="discipler-member" name="memberId" required>
                  <option value="">Selecionar membro</option>
                  {members
                    .filter((member) => !disciplerIds.has(member.user_id))
                    .map((member) => (
                      <option value={member.user_id} key={member.user_id}>
                        {member.full_name || member.email}
                      </option>
                    ))}
                </select>
                <button type="submit">Salvar discipulador</button>
              </div>
            </form>
          </header>

          <div className="leadership-saved-list">
            {disciplerIds.size === 0 ? (
              <p className="leadership-empty">Nenhum discipulador classificado.</p>
            ) : (
              Array.from(disciplerIds).map((memberId) => {
                const member = memberById.get(memberId);
                if (!member) return null;

                return (
                  <article key={memberId}>
                    <div>
                      <strong>{member.full_name || member.email}</strong>
                      <small>Acesso de discipulador liberado</small>
                    </div>
                    <form action={removeDiscipler}>
                      <input type="hidden" name="memberId" value={memberId} />
                      <button type="submit">Remover função</button>
                    </form>
                  </article>
                );
              })
            )}
          </div>
        </section>
      ) : (
        <section className="leadership-ministries" aria-label="Ministérios da Casa">
          {MINISTRIES.map((ministry) => {
            const ministryLeaders = leaders.filter(
              (assignment) => assignment.ministry_key === ministry.key,
            );
            const participants = ministryMembers.filter(
              (assignment) => assignment.ministry_key === ministry.key,
            );

            return (
              <details className="leadership-ministry-card" key={ministry.key}>
                <summary>
                  <div>
                    <span>Ministério</span>
                    <h2>{ministry.label}</h2>
                  </div>
                  <strong>
                    {ministryLeaders.length} {ministryLeaders.length === 1 ? "líder" : "líderes"}
                    {" · "}
                    {participants.length} {participants.length === 1 ? "participante" : "participantes"}
                  </strong>
                </summary>

                <div className="leadership-ministry-content">
                  <form action={addMinistryAssignment} className="leadership-add-form">
                    <input type="hidden" name="ministryKey" value={ministry.key} />
                    <label htmlFor={`${ministry.key}-member`}>Adicionar pessoa</label>
                    <div>
                      <select id={`${ministry.key}-member`} name="memberId" required>
                        <option value="">Selecionar membro</option>
                        {members.map((member) => (
                          <option value={member.user_id} key={member.user_id}>
                            {member.full_name || member.email}
                          </option>
                        ))}
                      </select>
                      <select name="role" aria-label="Função no ministério" required>
                        <option value="member">Participante</option>
                        <option value="leader">Líder</option>
                      </select>
                      <button type="submit">Salvar função</button>
                    </div>
                  </form>

                  <AssignmentGroup
                    title="Liderança"
                    empty="Nenhum líder definido."
                    assignments={ministryLeaders}
                    memberById={memberById}
                    ministryKey={ministry.key}
                    role="leader"
                  />
                  <AssignmentGroup
                    title="Participantes"
                    empty="Nenhum participante definido."
                    assignments={participants}
                    memberById={memberById}
                    ministryKey={ministry.key}
                    role="member"
                  />
                </div>
              </details>
            );
          })}
        </section>
      )}
    </main>
  );
}

function AssignmentGroup({
  title,
  empty,
  assignments,
  memberById,
  ministryKey,
  role,
}: {
  title: string;
  empty: string;
  assignments: Assignment[];
  memberById: Map<string, MemberOption>;
  ministryKey: string;
  role: "leader" | "member";
}) {
  return (
    <section className="leadership-assignment-group">
      <h3>{title}</h3>
      {assignments.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <div>
          {assignments.map((assignment) => {
            const member = memberById.get(assignment.member_id);
            if (!member) return null;

            return (
              <article key={`${ministryKey}-${role}-${assignment.member_id}`}>
                <span>{member.full_name || member.email}</span>
                <form action={removeMinistryAssignment}>
                  <input type="hidden" name="memberId" value={assignment.member_id} />
                  <input type="hidden" name="ministryKey" value={ministryKey} />
                  <input type="hidden" name="role" value={role} />
                  <button type="submit" aria-label={`Remover ${member.full_name} de ${title}`}>
                    Remover
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
