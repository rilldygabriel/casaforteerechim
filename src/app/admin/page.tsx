import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("full_name,is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/admin/login?erro=sem-permissao");
  }

  async function signOut() {
    "use server";
    const serverSupabase = await getSupabaseServerClient();
    await serverSupabase.auth.signOut({ scope: "local" });
    redirect("/admin/login");
  }

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard-header">
        <Image
          src="/images/logo-casa-forte.png"
          alt="Igreja Casa Forte"
          width={190}
          height={74}
          priority
        />
        <div className="admin-dashboard-actions">
          <Link href="/">Voltar ao site</Link>
          <form action={signOut}>
            <button type="submit">Sair com segurança</button>
          </form>
        </div>
      </header>

      <section className="admin-dashboard-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Painel administrativo
        </p>
        <h1>Olá, {profile.full_name || "Pastor Rilldy"}.</h1>
        <p>
          Sua autenticação está protegida. Visitantes e pedidos de oração estão
          disponíveis para consulta segura.
        </p>
      </section>

      <section className="admin-dashboard-grid" aria-label="Módulos do painel">
        <Link className="admin-module-link" href="/admin/visitantes">
          <span>01</span>
          <h2>Visitantes</h2>
          <p>Consulte as fichas recebidas e os próximos passos de cada pessoa.</p>
          <strong>Acessar visitantes →</strong>
        </Link>
        <Link className="admin-module-link" href="/admin/pedidos-oracao">
          <span>02</span>
          <h2>Pedidos de oração</h2>
          <p>
            Consulte os pedidos e registre o andamento do cuidado pastoral.
          </p>
          <strong>Acessar pedidos →</strong>
        </Link>
        <Link className="admin-module-link" href="/admin/membros">
          <span>03</span>
          <h2>Membros</h2>
          <p>
            Revise novos cadastros e controle quem pode acessar a Área da
            Família.
          </p>
          <strong>Gerenciar membros →</strong>
        </Link>
      </section>
    </main>
  );
}
