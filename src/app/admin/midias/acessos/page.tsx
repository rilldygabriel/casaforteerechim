import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireMediaAccessManager } from "@/lib/media-access-server";
import { MediaError } from "@/lib/media-library-server";
import AccessList from "./access-list";
import styles from "../../pronto-para-postar/media-library.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Acessos de Mídias | Casa Forte", robots: { index: false, follow: false } };

export default async function MediaAccessPage() {
  await requireMediaAccessManager().catch((error: unknown) => {
    if (error instanceof MediaError && error.status === 401) redirect("/familia/login");
    if (error instanceof MediaError && error.status === 403) redirect("/admin");
    throw error;
  });
  return <main className={styles.root}>
    <nav className={styles.nav} aria-label="Navegação de acessos"><Link href="/admin/midias">← Mídias</Link></nav>
    <header className={styles.hero}><p className={styles.eyebrow}>Sua equipe</p><h1>Cadastrar pessoas<span>.</span></h1><p>Marque para liberar Mídias e Pronto para postar. Desmarque para retirar esse acesso. Cada alteração é salva automaticamente.</p></header>
    <AccessList />
  </main>;
}
