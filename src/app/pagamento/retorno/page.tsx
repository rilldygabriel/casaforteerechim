import Image from "next/image";
import Link from "next/link";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { synchronizeMercadoPagoPayment } from "@/lib/mercado-pago";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pagamento | Igreja Casa Forte", robots: { index: false, follow: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;

export default async function PaymentReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const reference = typeof params.reference === "string" && UUID.test(params.reference) ? params.reference : "";
  const providerPaymentId = typeof params.payment_id === "string" && /^\d+$/.test(params.payment_id) ? params.payment_id : "";
  if (reference && providerPaymentId) {
    try { await synchronizeMercadoPagoPayment(providerPaymentId); } catch { /* O webhook fará uma nova tentativa. */ }
  }
  const { data: payment } = reference
    ? await getSupabaseServiceClient().from("mercado_pago_payments").select("status,purpose,event_id,amount_cents,tithe_cents,offering_cents,firstfruits_cents").eq("id", reference).maybeSingle()
    : { data: null };
  const approved = payment?.status === "approved";
  const rejected = payment && ["rejected", "cancelled", "refunded", "charged_back"].includes(payment.status);
  const title = approved ? "Pagamento confirmado" : rejected ? "Pagamento não concluído" : "Pagamento em processamento";
  const copy = approved ? "Recebemos a confirmação do Mercado Pago. Obrigado por caminhar e construir conosco." : rejected ? "O pagamento não foi aprovado. Você pode tentar novamente com outra forma de pagamento." : "O Mercado Pago ainda está processando a transação. A confirmação será atualizada automaticamente.";
  const back = typeof params.from === "string" && params.from.startsWith("/") && !params.from.startsWith("//") ? params.from : "/generosidade";
  const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  return <main className="payment-return-page"><header><Link href="/"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link></header><section data-status={approved ? "approved" : rejected ? "rejected" : "pending"}><span aria-hidden="true">{approved ? "✓" : rejected ? "!" : "…"}</span><p className="section-eyebrow">Mercado Pago</p><h1>{title}</h1><p>{copy}</p>{payment ? <strong>{money.format(Number(payment.amount_cents) / 100)}</strong> : null}{payment?.purpose === "contribution" ? <ul>{Number(payment.tithe_cents) > 0 ? <li>Dízimo: {money.format(Number(payment.tithe_cents) / 100)}</li> : null}{Number(payment.firstfruits_cents) > 0 ? <li>Primícias: {money.format(Number(payment.firstfruits_cents) / 100)}</li> : null}{Number(payment.offering_cents) > 0 ? <li>Oferta: {money.format(Number(payment.offering_cents) / 100)}</li> : null}</ul> : null}<div><Link href={back}>Voltar</Link><Link href="/">Ir para o início</Link></div></section></main>;
}
