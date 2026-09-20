import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { markAllFamilyAnnouncementsRead } from "./actions";
import AnnouncementInteractions, { type AnnouncementComment } from "./interactions";

export const metadata = { title: "Mensagens da Casa", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function FamilyNotificationsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/familia/login");
  const { data: profile } = await supabase.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin && profile?.approval_status !== "approved") redirect("/familia");
  const [
    { data: announcements },
    { data: reads },
    { data: likes },
    { data: comments },
    { data: news },
    { data: newsReads },
  ] = await Promise.all([
    supabase.from("family_announcements").select("id,title,body,created_at").order("created_at", { ascending: false }).limit(100),
    supabase.from("family_announcement_reads").select("announcement_id").eq("user_id", user.id),
    supabase.from("family_announcement_likes").select("announcement_id,user_id"),
    supabase.from("family_announcement_comments").select("id,announcement_id,user_id,author_name,body,created_at").order("created_at", { ascending: true }).limit(1000),
    supabase.from("news_posts").select("id,slug,title,body,published_at").eq("status", "published").order("published_at", { ascending: false }).limit(100),
    supabase.from("news_post_reads").select("news_id").eq("user_id", user.id),
  ]);
  const readIds = new Set((reads ?? []).map((item) => item.announcement_id));
  const readNewsIds = new Set((newsReads ?? []).map((item) => item.news_id));
  const unreadMessages = (announcements ?? []).filter((item) => !readIds.has(item.id)).length;
  const unreadNews = (news ?? []).filter((item) => !readNewsIds.has(item.id)).length;
  const unread = unreadMessages + unreadNews;

  return <main className="family-notifications-page">
    <header className="inner-header"><Link href="/familia"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={180} height={70} priority /></Link><Link className="inner-back" href="/familia">Voltar à Família</Link></header>
    <section className="family-notifications-hero"><p className="section-eyebrow"><span aria-hidden="true" />Comunicação da Casa</p><h1>Notificações</h1><p>Acompanhe as notícias e todas as mensagens enviadas pela liderança.</p>{unread > 0 ? <form action={markAllFamilyAnnouncementsRead}><button type="submit">Marcar tudo como lido</button></form> : null}</section>
    {news?.length ? <section className="family-notifications-group" aria-labelledby="news-notifications-heading">
      <div className="family-notifications-group-heading"><span>Notícias da Casa</span><h2 id="news-notifications-heading">As novidades em um só lugar</h2></div>
      <div className="family-news-notification-list">{news.map((item) => <Link id={`noticia-${item.id}`} data-unread={!readNewsIds.has(item.id)} key={item.id} href={`/noticias/${item.slug}`}><div><span>{readNewsIds.has(item.id) ? "Lida" : "Nova notícia"}</span><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.published_at))}</time></div><h3>{item.title}</h3><p>{item.body}</p><strong>Leia a notícia completa →</strong></Link>)}</div>
    </section> : null}
    <div className="family-notifications-group-heading family-notifications-message-heading"><span>Mensagens da liderança</span><h2>Todos os avisos da Casa</h2></div>
    <section className="family-notifications-list">{announcements?.length ? announcements.map((item) => {
      const announcementLikes = (likes ?? []).filter((like) => like.announcement_id === item.id);
      const announcementComments = (comments ?? []).filter((comment) => comment.announcement_id === item.id) as AnnouncementComment[];
      return <article id={`mensagem-${item.id}`} data-unread={!readIds.has(item.id)} key={item.id}><div><span>{readIds.has(item.id) ? "Lida" : "Nova mensagem"}</span><time>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.created_at))}</time></div><h2>{item.title}</h2><p>{item.body}</p><AnnouncementInteractions announcementId={item.id} userId={user.id} liked={announcementLikes.some((like) => like.user_id === user.id)} likeCount={announcementLikes.length} comments={announcementComments} /></article>;
    }) : <article className="is-empty"><h2>Nenhuma mensagem ainda</h2><p>Quando a Casa enviar um aviso, ele aparecerá aqui.</p></article>}</section>
  </main>;
}
