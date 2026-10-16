import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MediaError, requireMediaAccess } from "@/lib/media-library-server";
import { MEDIA_ACCESS_OWNER_ID } from "@/lib/media-access-policy";
import styles from "../pronto-para-postar/media-library.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mídias | Casa Forte", robots: { index: false, follow: false } };

export default async function MediaPage() {
  const access = await requireMediaAccess().catch((error: unknown) => {
    if (error instanceof MediaError && error.status === 401) redirect("/familia/login");
    if (error instanceof MediaError && error.status === 403) redirect("/familia");
    throw error;
  });
  return <main className={styles.root}>
    <nav className={styles.nav} aria-label="Navegação de mídias"><Link href="/admin">← Meu painel</Link></nav>
    <header className={styles.hero}><p className={styles.eyebrow}>Comunicação da Casa</p><h1>Mídias<span>.</span></h1><p>Os materiais da Casa e a equipe que leva nossa mensagem mais longe.</p></header>
    <section className={styles.grid} aria-label="Opções de mídias">
      <article className={styles.card}><span className={styles.type}>Biblioteca</span><h2>Pronto para postar</h2><p className={styles.caption}>Artes, carrosséis e vídeos com os arquivos originais e suas legendas.</p><Link className={styles.primary} href="/admin/pronto-para-postar">Abrir Pronto para postar →</Link></article>
      {access.user.id === MEDIA_ACCESS_OWNER_ID && <article className={styles.card}><span className={styles.type}>Sua equipe</span><h2>Cadastrar pessoas</h2><p className={styles.caption}>Escolha entre os cadastrados no site quem pode acessar a área de Mídias.</p><Link className={styles.primary} href="/admin/midias/acessos">Gerenciar acessos →</Link></article>}
    </section>
  </main>;
}
