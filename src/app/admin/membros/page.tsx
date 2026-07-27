import type { Metadata } from "next";
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

  const { data: memberData, error: memberError } = await supabase
    .from("member_profiles")
    .select(MEMBER_FIELDS)
    .order("created_at", { ascending: false });

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

      <MembersList
        members={(memberData ?? []) as MemberListRecord[]}
        hasLoadError={Boolean(memberError)}
      />
    </main>
  );
}
