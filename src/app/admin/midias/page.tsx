import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MediaError, requireMediaAccess } from "@/lib/media-library-server";
import { requireMediaAccessManager } from "@/lib/media-access-server";
import SiteNotificationBell from "@/components/site-notification-bell";
import SiteRefreshButton from "@/components/site-refresh-button";
import ThemeToggle from "@/components/theme-toggle";
import styles from "../pronto-para-postar/media-library.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mídias | Casa Forte", robots: { index: false, follow: false } };

export default async function MediaPage() {
  await requireMediaAccess().catch((error: unknown) => {
    if (error instanceof MediaError && error.status === 401) redirect("/familia/login");
    if (error instanceof MediaError && error.status === 403) redirect("/familia");
    throw error;
  });
  const canAddPeople = await requireMediaAccessManager().then(() => true).catch((error: unknown) => {
    if (error instanceof MediaError && error.status === 403) return false;
    throw error;
  });
  return <main className={styles.root}>
    <header className={styles.nav}><nav aria-label="Navegação de mídias"><Link href="/admin">← Voltar ao meu painel</Link></nav><div className="home-header-tools"><SiteNotificationBell /><SiteRefreshButton /><ThemeToggle /></div></header>
    <header className={styles.hero}><p className={styles.eyebrow}>Comunicação da Casa</p><h1>Mídias<span>.</span></h1><p>Os materiais da Casa e a equipe que leva nossa mensagem mais longe.</p></header>
    <section className={styles.grid} aria-label="Opções de mídias">
      <article className={styles.card}><span className={styles.type}>Biblioteca</span><h2>Pronto para postar</h2><p className={styles.caption}>Artes, carrosséis e vídeos com os arquivos originais e suas legendas.</p><Link className={styles.primary} href="/admin/pronto-para-postar">Abrir Pronto para postar →</Link></article>
      {canAddPeople && <article className={styles.card}><span className={styles.type}>Sua equipe</span><h2>Cadastrar pessoas</h2><p className={styles.caption}>Escolha entre os cadastrados no site quem pode acessar a área de Mídias.</p><Link className={styles.primary} href="/admin/midias/acessos">Gerenciar acessos →</Link></article>}
    </section>
  </main>;
}
