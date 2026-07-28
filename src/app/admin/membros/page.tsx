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

const MEMBER_FIELDS =
  "user_id,full_name,email,phone,profile_completed,created_at" as const;
const SUPABASE_ADMIN_MEMBER_STATS_URL =
  "https://fjwkfpwraipxmcjlwssv.supabase.co/functions/v1/admin-member-stats";
const VERCEL_TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const VERCEL_PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";

type MemberStats = {
  registeredMembers: number;
  emailAuthenticatedMembers: number;
  memberVerification: MemberVerification[];
};

type MemberVerification = {
  userId: string;
  emailVerified: boolean;
  phoneVerified: boolean;
};

function isValidCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isMemberVerification(value: unknown): value is MemberVerification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const verification = value as Record<string, unknown>;

  return (
    typeof verification.userId === "string" &&
    typeof verification.emailVerified === "boolean" &&
    typeof verification.phoneVerified === "boolean"
  );
}

async function getAdminMemberStats(
  adminUserId: string,
): Promise<MemberStats | null> {
  // Os dados privados do Auth chegam somente pela Edge Function protegida por OIDC.
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
      memberVerification?: unknown;
    };

    if (
      result.ok !== true ||
      !isValidCount(result.registeredMembers) ||
      !isValidCount(result.emailAuthenticatedMembers) ||
      !Array.isArray(result.memberVerification) ||
      !result.memberVerification.every(isMemberVerification) ||
      result.emailAuthenticatedMembers > result.registeredMembers
    ) {
      return null;
    }

    return {
      registeredMembers: result.registeredMembers,
      emailAuthenticatedMembers: result.emailAuthenticatedMembers,
      memberVerification: result.memberVerification,
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
  const verificationByUserId = new Map(
    (memberStats?.memberVerification ?? []).map((verification) => [
      verification.userId,
      verification,
    ]),
  );
  const membersWithVerification = members.map((member) => {
    const verification = verificationByUserId.get(member.user_id);

    return {
      ...member,
      email_verified: verification?.emailVerified ?? false,
      phone_verified: verification?.phoneVerified ?? false,
    };
  });
  const registeredMembers =
    memberStats?.registeredMembers ?? (memberError ? null : members.length);
  const verifiedMembers = memberStats
    ? memberStats.memberVerification.filter(
        ({ emailVerified, phoneVerified }) =>
          emailVerified || phoneVerified,
      ).length
    : null;
  const verificationPending =
    registeredMembers !== null && verifiedMembers !== null
      ? Math.max(registeredMembers - verifiedMembers, 0)
      : null;
  const completeProfiles = memberError
    ? null
    : members.filter((member) => member.profile_completed).length;

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
              <dt>Contas verificadas</dt>
              <dd>{verifiedMembers ?? "—"}</dd>
            </div>
            <div>
              <dt>Cadastros completos</dt>
              <dd>{completeProfiles ?? "—"}</dd>
            </div>
          </dl>

          <p className="admin-member-summary-note">
            {verificationPending === null
              ? "A verificação das contas está temporariamente indisponível."
              : verificationPending === 0
                ? "Todos os membros cadastrados possuem uma conta verificada."
                : `${verificationPending} ${
                    verificationPending === 1
                      ? "membro ainda precisa"
                      : "membros ainda precisam"
                  } verificar o e-mail ou, futuramente, o WhatsApp.`}
          </p>
        </aside>

        <MembersList
          members={membersWithVerification}
          hasLoadError={Boolean(memberError) || !memberStats}
        />
      </div>
    </main>
  );
}
