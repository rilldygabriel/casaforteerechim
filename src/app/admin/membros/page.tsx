import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import MembersList, {
  type MemberApplicationRecord,
  type MemberApprovalRecord,
} from "./members-list";
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
  "user_id,email,full_name,phone,approval_status,church_status,is_admin,created_at,approved_at" as const;
const APPLICATION_FIELDS =
  "id,full_name,email,phone,status,auth_user_id,created_at,reviewed_at" as const;

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
    await supabase.auth.signOut();
    redirect("/admin/login?erro=sem-permissao");
  }

  const [
    { data: memberData, error: memberError },
    { data: applicationData, error: applicationError },
  ] = await Promise.all([
    supabase
      .from("member_profiles")
      .select(MEMBER_FIELDS)
      .order("created_at", { ascending: false }),
    supabase
      .from("member_applications")
      .select(APPLICATION_FIELDS)
      .order("created_at", { ascending: false }),
  ]);

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
          Consulte quem faz parte da Área da Família. Clique no nome para abrir
          a ficha completa, ver a caminhada da pessoa e acompanhar os dados de
          contato. Nenhum cadastro pode ser apagado por este painel.
        </p>
      </section>

      <MembersList
        applications={(applicationData ?? []) as MemberApplicationRecord[]}
        members={(memberData ?? []) as MemberApprovalRecord[]}
        hasLoadError={Boolean(memberError || applicationError)}
      />
    </main>
  );
}
