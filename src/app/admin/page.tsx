import Image from "next/image";
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
    await supabase.auth.signOut();
    redirect("/admin/login?erro=sem-permissao");
  }

  async function signOut() {
    "use server";
    const serverSupabase = await getSupabaseServerClient();
    await serverSupabase.auth.signOut();
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
        <form action={signOut}>
          <button type="submit">Sair com segurança</button>
        </form>
      </header>

      <section className="admin-dashboard-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Painel administrativo
        </p>
        <h1>Olá, {profile.full_name || "Pastor Rilldy"}.</h1>
        <p>
          Sua autenticação está protegida. Visitantes e pedidos de oração serão
          conectados aqui somente depois deste acesso passar por todos os testes.
        </p>
      </section>

      <section className="admin-dashboard-grid" aria-label="Módulos do painel">
        <article>
          <span>01</span>
          <h2>Visitantes</h2>
          <p>Próxima etapa após a validação completa do login.</p>
          <strong>Protegido</strong>
        </article>
        <article>
          <span>02</span>
          <h2>Pedidos de oração</h2>
          <p>Será liberado depois do módulo de visitantes.</p>
          <strong>Protegido</strong>
        </article>
      </section>
    </main>
  );
}
