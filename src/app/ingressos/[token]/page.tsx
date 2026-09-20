import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { eventTicketUrl, TICKET_TOKEN } from "@/lib/event-tickets";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ingresso digital | Igreja Casa Forte", robots: { index: false, follow: false } };

export default async function EventTicketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!TICKET_TOKEN.test(token)) notFound();
  const service = getSupabaseServiceClient();
  const { data: ticket } = await service.from("event_tickets")
    .select("id,event_id,registration_id,public_token,status,redeemed_at,created_at")
    .eq("public_token", token)
    .maybeSingle();
  if (!ticket) notFound();

  const [{ data: event }, { data: registration }, { data: payment }] = await Promise.all([
    service.from("events").select("title,slug,start_date,start_time,location,image_url").eq("id", ticket.event_id).maybeSingle(),
    service.from("event_registrations").select("full_name,simple_quantity,double_quantity,order_total_cents,status,archived_at").eq("id", ticket.registration_id).maybeSingle(),
    service.from("mercado_pago_payments").select("status,approved_at").eq("registration_id", ticket.registration_id).eq("status", "approved").order("approved_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!event || !registration || registration.archived_at || !payment) notFound();

  const valid = ticket.status === "valid" && registration.status === "confirmed";
  const redeemed = ticket.status === "redeemed";
  const ticketUrl = eventTicketUrl(ticket.public_token);
  const qrCode = await QRCode.toDataURL(ticketUrl, { width: 640, margin: 2, errorCorrectionLevel: "H", color: { dark: "#111111", light: "#ffffff" } });
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const code = ticket.public_token.split("-")[0].toUpperCase();

  return <main className="event-ticket-page">
    <header><Link href="/"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link></header>
    <article className="event-ticket" data-status={ticket.status}>
      <div className="event-ticket-top"><p>Ingresso digital</p><span>{valid ? "Válido" : redeemed ? "Retirado" : "Cancelado"}</span></div>
      <h1>{event.title}</h1>
      <p className="event-ticket-owner">Pedido de <strong>{registration.full_name}</strong></p>
      <dl>
        <div><dt>Simples</dt><dd>{Number(registration.simple_quantity)}</dd></div>
        <div><dt>Duplos</dt><dd>{Number(registration.double_quantity)}</dd></div>
        <div><dt>Total</dt><dd>{money.format(Number(registration.order_total_cents) / 100)}</dd></div>
      </dl>
      <div className="event-ticket-qr"><Image src={qrCode} width={280} height={280} unoptimized alt={`QR Code do ingresso ${code}`} /><strong>{code}</strong><small>Apresente este QR na retirada. Cada ingresso pode ser confirmado apenas uma vez.</small></div>
      {redeemed && ticket.redeemed_at ? <p className="event-ticket-used">Retirada confirmada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(ticket.redeemed_at))}.</p> : null}
      {!valid && !redeemed ? <p className="event-ticket-invalid">Este ingresso não está válido. Procure a equipe do evento.</p> : null}
    </article>
  </main>;
}
