import type { Metadata } from "next";
import { getVercelOidcToken } from "@vercel/oidc";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import MembersList, { type MemberListRecord } from "./members-list";
import "./members.css";

export const metadata: Metadata = {
  title: "Membros",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

const MEMBER_FIELDS = "user_id,full_name,created_at" as const;
const SUPABASE_ADMIN_MEMBER_STATS_URL =
  "https://fjwkfpwraipxmcjlwssv.supabase.co/functions/v1/admin-member-stats";
const VERCEL_TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const VERCEL_PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";

type MemberStats = {
  registeredMembers: number;
  emailAuthenticatedMembers: number;
};

function isValidCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

async function getAdminMemberStats(
  adminUserId: string,
): Promise<MemberStats | null> {
  const requestId = crypto.randomUUID();

  try {
    const oidcToken = await getVercelOidcToken({
      team: VERCEL_TEAM_ID,
      project: VERCEL_PROJECT_ID,
      expirationBufferMs: 10_000,
    });
    const response = await fetch(SUPABASE_ADMIN_MEMBER_STATS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${oidcToken}`,
        "Content-Type": "application/json",
        "x-request-id": requestId,
      },
      body: JSON.stringify({ adminUserId }),
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json() as {
      ok?: unknown;
      registeredMembers?: unknown;
      emailAuthenticatedMembers?: unknown;
    };

    if (
      result.ok !== true ||
      !isValidCount(result.registeredMembers) ||
      !isValidCount(result.emailAuthenticatedMembers) ||
      result.emailAuthenticatedMembers > result.registeredMembers
    ) {
      return null;
    }

    return {
      registeredMembers: result.registeredMembers,
      emailAuthenticatedMembers: result.emailAuthenticatedMembers,
    };
  } catch {
    return null;
  }
}

export default async function AdminMembersPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/admin/login?erro=sem-permissao");
  }

  const [
    { data: memberData, error: memberError },
    memberStats,
  ] = await Promise.all([
    supabase
      .from("member_profiles")
      .select(MEMBER_FIELDS)
      .order("created_at", { ascending: false }),
    getAdminMemberStats(user.id),
  ]);
  const members = (memberData ?? []) as MemberListRecord[];
  const registeredMembers =
    memberStats?.registeredMembers ?? (memberError ? null : members.length);
  const emailAuthenticatedMembers =
    memberStats?.emailAuthenticatedMembers ?? null;
  const emailConfirmationPending =
    registeredMembers !== null && emailAuthenticatedMembers !== null
      ? Math.max(registeredMembers - emailAuthenticatedMembers, 0)
      : null;

  return (
    <main className="admin-visitors-page">
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

      <section className="admin-visitors-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Área da Família
        </p>
        <h1>Membros</h1>
        <p>
          Uma lista simples de quem faz parte da Família. Clique no nome para
          abrir a ficha completa.
        </p>
      </section>

      <div className="admin-member-dashboard">
        <aside
          className="admin-member-summary"
          aria-labelledby="member-summary-title"
        >
          <p>Contas da Família</p>
          <h2 id="member-summary-title">Resumo de membros</h2>

          <dl>
            <div>
              <dt>Membros cadastrados</dt>
              <dd>{registeredMembers ?? "—"}</dd>
            </div>
            <div>
              <dt>E-mails confirmados</dt>
              <dd>{emailAuthenticatedMembers ?? "—"}</dd>
            </div>
          </dl>

          <p className="admin-member-summary-note">
            {emailConfirmationPending === null
              ? "A confirmação dos e-mails está temporariamente indisponível."
              : emailConfirmationPending === 0
                ? "Todos os membros cadastrados confirmaram o e-mail."
                : `${emailConfirmationPending} ${
                    emailConfirmationPending === 1
                      ? "membro ainda precisa"
                      : "membros ainda precisam"
                  } confirmar o e-mail.`}
          </p>
        </aside>

        <MembersList
          members={members}
          hasLoadError={Boolean(memberError)}
        />
      </div>
    </main>
  );
}
