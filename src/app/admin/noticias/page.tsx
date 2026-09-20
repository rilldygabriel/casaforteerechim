import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { NewsPost } from "@/lib/news";
import { getNewsManager, sortNewsImages } from "@/lib/news";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import NewsAdminClient from "./news-admin-client";
import styles from "./news-admin.module.css";

export const metadata = {
  title: "Notícias | Painel administrativo",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const manager = await getNewsManager();
  if (!manager) redirect("/admin");

  const service = getSupabaseServiceClient();
  const { data } = await service
    .from("news_posts")
    .select("id,slug,title,body,status,published_at,created_at,updated_at,news_images(id,image_url,storage_path,position,is_cover)")
    .order("published_at", { ascending: false });

  const posts = ((data ?? []) as NewsPost[]).map((post) => ({
    ...post,
    news_images: sortNewsImages(post.news_images),
  }));

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/admin" aria-label="Voltar ao painel">
          <Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} style={{ width: "auto", height: "auto" }} priority />
        </Link>
        <Link href="/admin">Voltar ao painel</Link>
      </header>
      <section className={styles.hero}>
        <p>Comunicação da Casa</p>
        <h1>Notícias</h1>
        <span>Crie uma nova notícia ou edite as publicações existentes. Cada nova publicação avisa os aparelhos cadastrados.</span>
      </section>
      <NewsAdminClient initialPosts={posts} />
    </main>
  );
}
