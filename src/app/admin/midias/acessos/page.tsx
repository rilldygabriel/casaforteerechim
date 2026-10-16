import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMediaAccessManager } from "@/lib/media-access-server";
import { MediaError } from "@/lib/media-library-server";
import SiteNotificationBell from "@/components/site-notification-bell";
import SiteRefreshButton from "@/components/site-refresh-button";
import ThemeToggle from "@/components/theme-toggle";
import AccessList from "./access-list";
import styles from "../../pronto-para-postar/media-library.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Acessos de Mídias | Casa Forte", robots: { index: false, follow: false } };

export default async function MediaAccessPage() {
  const { canRevoke } = await requireMediaAccessManager().catch((error: unknown) => {
    if (error instanceof MediaError && error.status === 401) redirect("/familia/login");
    if (error instanceof MediaError && error.status === 403) redirect("/admin");
    throw error;
  });
  return <main className={styles.root}>
    <header className={styles.nav}><nav aria-label="Navegação de acessos"><Link href="/admin/midias">← Voltar para Mídias</Link></nav><div className="home-header-tools"><SiteNotificationBell /><SiteRefreshButton /><ThemeToggle /></div></header>
    <header className={styles.hero}><p className={styles.eyebrow}>Sua equipe</p><h1>Cadastrar pessoas<span>.</span></h1><p>Marque para liberar Mídias e Pronto para postar. {canRevoke ? "Desmarque para retirar esse acesso." : "A retirada de acessos é feita pelo pastor responsável."} Cada alteração é salva automaticamente.</p></header>
    <AccessList canRevoke={canRevoke} />
  </main>;
}
