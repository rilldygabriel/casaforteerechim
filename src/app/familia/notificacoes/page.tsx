import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { markAllFamilyAnnouncementsRead } from "./actions";

export const metadata = { title: "Mensagens da Casa", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function FamilyNotificationsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/familia/login");
  const { data: profile } = await supabase.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin && profile?.approval_status !== "approved") redirect("/familia");
  const [{ data: announcements }, { data: reads }] = await Promise.all([
    supabase.from("family_announcements").select("id,title,body,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("family_announcement_reads").select("announcement_id").eq("user_id", user.id),
  ]);
  const readIds = new Set((reads ?? []).map((item) => item.announcement_id));
  const unread = (announcements ?? []).filter((item) => !readIds.has(item.id)).length;

  return <main className="family-notifications-page">
    <header className="inner-header"><Link href="/familia"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={180} height={70} priority /></Link><Link className="inner-back" href="/familia">Voltar à Família</Link></header>
    <section className="family-notifications-hero"><p className="section-eyebrow"><span aria-hidden="true" />Comunicação da Casa</p><h1>Mensagens</h1><p>Acompanhe aqui todos os avisos enviados pela liderança.</p>{unread > 0 ? <form action={markAllFamilyAnnouncementsRead}><button type="submit">Marcar todas como lidas</button></form> : null}</section>
    <section className="family-notifications-list">{announcements?.length ? announcements.map((item) => <article data-unread={!readIds.has(item.id)} key={item.id}><div><span>{readIds.has(item.id) ? "Lida" : "Nova"}</span><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.created_at))}</time></div><h2>{item.title}</h2><p>{item.body}</p></article>) : <article className="is-empty"><h2>Nenhuma mensagem ainda</h2><p>Quando a Casa enviar um aviso, ele aparecerá aqui.</p></article>}</section>
  </main>;
}
