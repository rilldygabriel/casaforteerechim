import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import PrayerRequestsList, {
  type PrayerRequestRecord,
} from "./prayer-requests-list";
import "./prayer-requests.css";

export const metadata: Metadata = {
  title: "Pedidos de oração",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

const PRAYER_REQUEST_FIELDS =
  "id,nome,telefone,categoria,pedido,deseja_contato,urgente,status,responsavel,observacoes,created_at,updated_at" as const;

export default async function AdminPrayerRequestsPage() {
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

  const { data, error } = await supabase
    .from("pedidos_oracao")
    .select(PRAYER_REQUEST_FIELDS)
    .order("urgente", { ascending: false })
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
          Intercessão e cuidado
        </p>
        <h1>Pedidos de oração</h1>
        <p>
          Leia cada pedido com cuidado e registre o andamento do atendimento.
          Somente administradores autorizados podem consultar ou atualizar
          estas informações.
        </p>
      </section>

      <PrayerRequestsList
        requests={(data ?? []) as PrayerRequestRecord[]}
        hasLoadError={Boolean(error)}
      />
    </main>
  );
}
