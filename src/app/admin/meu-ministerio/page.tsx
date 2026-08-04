import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MINISTRIES } from "@/app/familia/servir/ministries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { reviewServeRequest } from "./actions";
import "../role-panel.css";

export const metadata: Metadata = {
  title: "Meu ministério",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function formatRequestDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(date));
}

export default async function MyMinistryPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const [{ data: profile }, { data: leaderRows }] = await Promise.all([
    supabase
      .from("member_profiles")
      .select("is_admin,approval_status")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("ministry_leaders")
      .select("ministry_key")
      .eq("member_id", user.id),
  ]);
  if (
    !profile ||
    (!profile.is_admin && profile.approval_status !== "approved")
  ) {
    redirect("/familia");
  }

  const keys = (leaderRows ?? []).map((row) => row.ministry_key);
  if (!profile.is_admin && keys.length === 0) redirect("/admin");

  const service = getSupabaseServiceClient();
  const [{ data: assignments }, { data: pendingRequests }] = keys.length
    ? await Promise.all([
        service
          .from("ministry_members")
          .select("ministry_key,member_id")
          .in("ministry_key", keys),
        service
          .from("ministry_membership_requests")
          .select("member_id,ministry_key,created_at")
          .in("ministry_key", keys)
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
      ])
    : [{ data: [] }, { data: [] }];

  const memberIds = Array.from(
    new Set([
      ...(assignments ?? []).map((item) => item.member_id),
      ...(pendingRequests ?? []).map((item) => item.member_id),
    ]),
  );
  const { data: members } = memberIds.length
    ? await service
        .from("member_profiles")
        .select("user_id,full_name,phone")
        .in("user_id", memberIds)
        .eq("approval_status", "approved")
    : { data: [] };
  const memberById = new Map(
    (members ?? []).map((member) => [member.user_id, member]),
  );

  return (
    <main className="admin-visitors-page">
      <header className="admin-section-header">
        <Link href="/admin">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={190}
            height={74}
            priority
          />
        </Link>
        <nav>
          <Link href="/admin">Voltar ao painel</Link>
        </nav>
      </header>

      <section className="admin-visitors-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />Minha liderança
        </p>
        <h1>Meu ministério</h1>
        <p>
          Veja sua equipe e analise as pessoas que pediram para começar a
          servir.
        </p>
      </section>

      <section
        className="role-panel-requests"
        data-has-pending={(pendingRequests ?? []).length > 0}
        aria-labelledby="serve-requests-title"
      >
        <header>
          <div>
            <span>Novos pedidos</span>
            <h2 id="serve-requests-title">Pessoas querendo servir</h2>
          </div>
          <strong>{(pendingRequests ?? []).length}</strong>
        </header>

        {(pendingRequests ?? []).length === 0 ? (
          <p className="role-panel-empty">
            Nenhum pedido aguardando análise neste momento.
          </p>
        ) : (
          <div className="role-panel-request-list">
            {(pendingRequests ?? []).map((request) => {
              const member = memberById.get(request.member_id);
              const ministry = MINISTRIES.find(
                (item) => item.key === request.ministry_key,
              );
              return (
                <article key={`${request.member_id}-${request.ministry_key}`}>
                  <div>
                    <span>Quer servir em {ministry?.label ?? "Ministério"}</span>
                    <h3>{member?.full_name || "Membro da Família"}</h3>
                    <p>{member?.phone || "Contato não informado"}</p>
                    <time>{formatRequestDate(request.created_at)}</time>
                  </div>
                  <div className="role-panel-request-actions">
                    <form action={reviewServeRequest}>
                      <input type="hidden" name="memberId" value={request.member_id} />
                      <input type="hidden" name="ministryKey" value={request.ministry_key} />
                      <input type="hidden" name="decision" value="approve" />
                      <button type="submit">Aceitar na equipe</button>
                    </form>
                    <form action={reviewServeRequest}>
                      <input type="hidden" name="memberId" value={request.member_id} />
                      <input type="hidden" name="ministryKey" value={request.ministry_key} />
                      <input type="hidden" name="decision" value="reject" />
                      <button type="submit" className="is-secondary">Agora não</button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="role-panel-list">
        {keys.map((key) => {
          const ministry = MINISTRIES.find((item) => item.key === key);
          const team = (assignments ?? []).filter(
            (item) => item.ministry_key === key,
          );
          return (
            <article className="role-panel-card" key={key}>
              <header>
                <div>
                  <span>Ministério</span>
                  <h2>{ministry?.label || key}</h2>
                </div>
                <strong>
                  {team.length} {team.length === 1 ? "pessoa" : "pessoas"}
                </strong>
              </header>
              <div className="role-panel-people">
                {team.length === 0 ? (
                  <p className="role-panel-empty">
                    Nenhum participante cadastrado ainda.
                  </p>
                ) : (
                  team.map((item) => {
                    const member = memberById.get(item.member_id);
                    return (
                      <div className="role-panel-person" key={item.member_id}>
                        <span>Participante</span>
                        <h3>{member?.full_name || "Membro da equipe"}</h3>
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
