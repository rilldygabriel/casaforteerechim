import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import VisitorsList, { type VisitorRecord } from "./visitors-list";
import "../inbox-list.css";

export const metadata: Metadata = {
  title: "Visitantes",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

const VISITOR_FIELDS =
  "id,nome,telefone,cidade,bairro,acompanhamento,convidado_por,igreja_anterior,passo_fe,mensagem_pastor,experiencia_culto,voltar_culto,data_visita,status_acompanhamento,created_at,opened_at" as const;

export default async function AdminVisitorsPage() {
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

  const { data, error } = await supabase
    .from("visitantes")
    .select(VISITOR_FIELDS)
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
          Acolhimento
        </p>
        <h1>Visitantes</h1>
        <p>
          Consulte as fichas enviadas pelo site e registre o andamento de cada
          acolhimento. Somente administradores autorizados podem ler ou
          atualizar estas informações.
        </p>
      </section>

      <VisitorsList
        visitors={(data ?? []) as VisitorRecord[]}
        hasLoadError={Boolean(error)}
      />
    </main>
  );
}
