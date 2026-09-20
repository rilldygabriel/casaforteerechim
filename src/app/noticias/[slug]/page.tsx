import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteBackButton from "@/components/site-back-button";
import NotificationReadTracker from "@/components/notification-read-tracker";
import ThemeToggle from "@/components/theme-toggle";
import type { NewsPost } from "@/lib/news";
import { coverForNews, sortNewsImages } from "@/lib/news";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import styles from "../news.module.css";

export const revalidate = 60;

async function getPost(slug: string) {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("news_posts")
    .select("id,slug,title,body,status,published_at,created_at,updated_at,news_images(id,image_url,storage_path,position,is_cover)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return data as NewsPost | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Notícia não encontrada" };
  const cover = coverForNews(post);
  return {
    title: post.title,
    description: post.body.replace(/\s+/g, " ").slice(0, 155),
    openGraph: cover ? { images: [{ url: cover.image_url }] } : undefined,
  };
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const images = sortNewsImages(post.news_images);
  const cover = coverForNews(post);
  const gallery = images.filter((image) => image.image_url !== cover?.image_url);

  return (
    <main className={styles.page}>
      <NotificationReadTracker id={post.id} type="news" />
      <header className={styles.topbar}>
        <Link href="/noticias" aria-label="Voltar às notícias"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} style={{ width: "auto", height: "auto" }} priority /></Link>
        <div><SiteBackButton /><ThemeToggle /></div>
      </header>
      <article className={styles.article}>
        <header>
          <p>Notícias da Casa</p>
          <h1>{post.title}</h1>
          <time dateTime={post.published_at}>{formatPublishedDate(post.published_at)}</time>
        </header>
        {cover ? <figure className={styles.cover}><Image src={cover.image_url} alt={`Capa da notícia ${post.title}`} fill unoptimized priority sizes="(max-width: 900px) 100vw, 1100px" /></figure> : null}
        <div className={styles.body}><LinkedText text={post.body} /></div>
        {gallery.length ? <section className={styles.gallery} aria-label="Outras fotos da notícia">{gallery.map((image, index) => (
          <figure key={image.id ?? image.image_url}><Image src={image.image_url} alt={`Foto ${index + 2} da notícia ${post.title}`} fill unoptimized sizes="(max-width: 720px) 100vw, 50vw" /></figure>
        ))}</section> : null}
        <Link className={styles.backLink} href="/noticias">Ver todas as notícias →</Link>
      </article>
    </main>
  );
}

function LinkedText({ text }: { text: string }) {
  const pieces = text.split(/(https?:\/\/[^\s]+)/g);
  return <p>{pieces.map((piece, index) => /^https?:\/\//.test(piece) ? <a key={`${piece}-${index}`} href={piece} target="_blank" rel="noreferrer">{piece}</a> : piece)}</p>;
}

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
