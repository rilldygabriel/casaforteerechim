import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import AnnouncementForm from "./announcement-form";

export const metadata = { title: "Notificações | Painel administrativo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("member_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/admin");
  const { data: announcements } = await supabase.from("family_announcements").select("id,title,body,created_at").order("created_at", { ascending: false }).limit(30);

  return <main className="admin-announcements-page">
    <header className="admin-section-header"><Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link><nav><Link href="/admin">Voltar ao painel</Link></nav></header>
    <section className="admin-announcements-hero"><p className="section-eyebrow"><span aria-hidden="true" />Comunicação da Casa</p><h1>Notificações</h1><p>Publique uma mensagem na Área da Família e envie o mesmo aviso aos celulares que autorizaram notificações.</p></section>
    <section className="admin-announcements-layout">
      <article><p className="home-kicker">Nova mensagem</p><h2>Enviar para todos</h2><AnnouncementForm /></article>
      <aside><p className="home-kicker">Histórico</p><h2>Mensagens enviadas</h2>{announcements?.length ? announcements.map((item) => <article key={item.id}><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.created_at))}</time><h3>{item.title}</h3><p>{item.body}</p></article>) : <p>Nenhuma mensagem enviada ainda.</p>}</aside>
    </section>
  </main>;
}
