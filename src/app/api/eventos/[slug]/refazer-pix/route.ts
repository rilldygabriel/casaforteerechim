import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { synchronizeMercadoPagoPayment } from "@/lib/mercado-pago";
import { isPagBankConfigured, synchronizePagBankEventPayment } from "@/lib/pagbank";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getEventTicketDeliveryState } from "@/lib/event-ticket-delivery";

export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!isPagBankConfigured()) return NextResponse.json({ error: "PagBank indisponível agora." }, { status: 503 });
  try {
    const { slug } = await params;
    const body = await request.json();
    const currentPaymentId = String(body.paymentId ?? "");
    if (!UUID.test(currentPaymentId)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
    const service = getSupabaseServiceClient();
    const { data: current } = await service.from("mercado_pago_payments")
      .select("id,event_id,registration_id,payer_name,payer_email,payer_phone,amount_cents,status,provider_payment_id,provider_order_id,payment_provider")
      .eq("id", currentPaymentId).eq("purpose", "event").in("payment_provider", ["mercado_pago", "pagbank"]).maybeSingle();
    if (!current?.event_id || !current.registration_id) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    const { data: event } = await service.from("events").select("slug").eq("id", current.event_id).maybeSingle();
    if (event?.slug !== slug) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

    // Never create another payable charge while the previous one may still be paid.
    let status = current.status;
    if (current.payment_provider === "pagbank" && current.provider_order_id) {
      const synchronized = await synchronizePagBankEventPayment(current.id);
      if (synchronized.ignored || !synchronized.status) throw new Error("Confirmação indisponível.");
      status = synchronized.status;
      if (["pending", "in_process", "approved"].includes(status)) return NextResponse.json({ ok: true, ...synchronized });
    } else if (current.payment_provider === "mercado_pago" && current.provider_payment_id) {
      status = (await synchronizeMercadoPagoPayment(current.provider_payment_id)).status;
    }
    const { data: registration } = await service.from("event_registrations").select("status").eq("id", current.registration_id).single();
    if (status === "approved" || registration?.status === "confirmed") return NextResponse.json({ ok: true, status: "approved", ...await getEventTicketDeliveryState(current.registration_id) });
    if (!["rejected", "cancelled", "expired"].includes(status)) return NextResponse.json({ error: "A cobrança anterior ainda está ativa. Aguarde a confirmação ou o vencimento antes de gerar outra." }, { status: 409 });

    // Stable successor makes repeated clicks and retries resume the same attempt.
    const hex = createHash("sha256").update(`pagbank-retry:${current.id}`).digest("hex");
    const paymentId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    const { error } = await service.from("mercado_pago_payments").upsert({
      id: paymentId, purpose: "event", payment_provider: "pagbank", event_id: current.event_id,
      registration_id: current.registration_id, payer_name: current.payer_name, payer_email: current.payer_email,
      payer_phone: current.payer_phone, amount_cents: current.amount_cents,
    }, { onConflict: "id", ignoreDuplicates: true });
    if (error) throw new Error("Falha ao preparar a nova tentativa.");
    // The CPF is collected again by the secure checkout, never stored for reuse.
    return NextResponse.json({ ok: true, paymentProvider: "pagbank", paymentId, amountCents: Number(current.amount_cents) });
  } catch {
    return NextResponse.json({ error: "Não foi possível verificar o pagamento anterior. Tente novamente em instantes." }, { status: 502 });
  }
}
