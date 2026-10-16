import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MediaError, requireMediaAccess } from "@/lib/media-library-server";
import MediaLibrary from "./media-library";
import styles from "./media-library.module.css";
import SiteNotificationBell from "@/components/site-notification-bell";
import SiteRefreshButton from "@/components/site-refresh-button";
import ThemeToggle from "@/components/theme-toggle";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pronto para postar | Casa Forte", robots: { index: false, follow: false } };
export default async function MediaLibraryPage() {
  try { await requireMediaAccess(); } catch (error) {
    if (error instanceof MediaError && error.status === 401) redirect("/familia/login");
    if (!(error instanceof MediaError) || error.status !== 403) throw error;
    return <main className={styles.root}><header className={styles.hero}><p>Equipe de mídia</p><h1>Acesso restrito</h1><p>Esta biblioteca está disponível para administradores e membros com a classificação Mídia. Solicite ao pastor a liberação na sua ficha.</p><Link href="/familia">Voltar à Área da Família</Link></header></main>;
  }
  return <main className={styles.root}>
    <header className={styles.nav}><nav aria-label="Navegação da biblioteca"><Link href="/admin/midias">← Voltar para Mídias</Link></nav><div className="home-header-tools"><SiteNotificationBell /><SiteRefreshButton /><ThemeToggle /></div></header>
    <header className={styles.hero}><p className={styles.eyebrow}>Da Casa para o mundo</p><h1>Pronto para postar<span>.</span></h1><p>O material final, a legenda certa e tudo organizado. Baixe, publique nas redes e marque quando terminar.</p></header>
    <MediaLibrary />
  </main>;
}
