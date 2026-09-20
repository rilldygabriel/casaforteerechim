import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEventAdminScope } from "@/lib/event-admin-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import TicketScanner from "./ticket-scanner";
import TicketDeliveryButton from "./ticket-delivery-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leitor de ingressos | Painel", robots: { index: false, follow: false } };

export default async function EventTicketScannerPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const scope = await getEventAdminScope(user.id);
  const { data: event } = await scope.service.from("events").select("id,title").eq("slug", "hamburguer-da-casa-20-09").is("archived_at", null).maybeSingle();
  if (!event || !scope.canManage(event.id)) redirect("/admin/eventos");

  return <main className="admin-ticket-page">
    <header className="admin-section-header"><Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link><nav><Link href="/admin/eventos?tab=inscricoes">Voltar aos pedidos</Link></nav></header>
    <section className="admin-events-hero"><p className="section-eyebrow"><span aria-hidden="true" />Retirada de pedidos</p><h1>Leitor de ingressos</h1><p>Leia o QR Code, confira os hambúrgueres e confirme a retirada. O mesmo ingresso não pode ser utilizado duas vezes.</p></section>
    <TicketDeliveryButton />
    <TicketScanner />
  </main>;
}
