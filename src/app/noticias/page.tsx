import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import SiteBackButton from "@/components/site-back-button";
import SiteRefreshButton from "@/components/site-refresh-button";
import ThemeToggle from "@/components/theme-toggle";
import { coverForNews, type NewsPost } from "@/lib/news";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./news.module.css";

export const metadata: Metadata = {
  title: "Notícias da Casa",
  description: "Notícias, convites e informações da Igreja Casa Forte Erechim.",
};
export const revalidate = 60;

export default async function NewsPage() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("news_posts")
    .select("id,slug,title,body,status,published_at,created_at,updated_at,news_images(id,image_url,storage_path,position,is_cover)")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  const posts = (data ?? []) as NewsPost[];

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" aria-label="Casa Forte — início"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} style={{ width: "auto", height: "auto" }} priority /></Link>
        <div><SiteBackButton /><ThemeToggle /><SiteRefreshButton /></div>
      </header>
      <section className={styles.hero}>
        <p>Fique por dentro</p>
        <h1>Notícias<br /><strong>da Casa.</strong></h1>
        <span>Informações, convites e tudo o que você precisa saber para caminhar com a família.</span>
      </section>
      <section className={styles.grid} aria-label="Notícias publicadas">
        {!posts.length ? <p className={styles.empty}>Nenhuma notícia publicada ainda.</p> : posts.map((post) => {
          const cover = coverForNews(post);
          return (
            <Link className={styles.card} href={`/noticias/${post.slug}`} key={post.id}>
              {cover ? <figure><Image src={cover.image_url} alt={`Capa da notícia ${post.title}`} fill unoptimized sizes="(max-width: 720px) 100vw, 50vw" /></figure> : null}
              <div>
                <time dateTime={post.published_at}>{formatPublishedDate(post.published_at)}</time>
                <h2>{post.title}</h2>
                <p>{post.body}</p>
                <strong>Ler notícia completa →</strong>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

function formatPublishedDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}
