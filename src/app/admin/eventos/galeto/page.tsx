import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { canManageGaleto, type GaletoAllocation, type GaletoChange } from "@/lib/galeto";
import GaletoControl from "./control";
import styles from "./galeto.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Galeto com Massa | Controle privado", robots: { index: false, follow: false } };

export default async function GaletoPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  if (!canManageGaleto(user.id)) redirect("/admin");
  const [allocations, history] = await Promise.all([
    supabase.from("galeto_allocations").select("*").order("name"),
    supabase.from("galeto_changes").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  return <main className={styles.page}>
    <Link className={styles.back} href="/admin/eventos">← Eventos</Link>
    <header className={styles.header}>
      <p>Controle privado · Rilldy e Lisi</p><h1>Galeto com massa</h1>
      <span>Ingressos, acertos e retirada das refeições, em um só lugar.</span>
    </header>
    {allocations.error || history.error
      ? <p role="alert">Não foi possível carregar o controle. Atualize a página; nenhum registro foi alterado.</p>
      : <GaletoControl rows={(allocations.data ?? []) as GaletoAllocation[]} history={(history.data ?? []) as GaletoChange[]} />}
  </main>;
}
