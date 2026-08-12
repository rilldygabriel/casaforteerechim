import { NextResponse } from "next/server";
import { createMercadoPagoBrickPayment, isMercadoPagoBrickConfigured, synchronizeMercadoPagoPayment } from "@/lib/mercado-pago";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!isMercadoPagoBrickConfigured()) return NextResponse.json({ error: "O pagamento deste evento está sendo ativado." }, { status: 503 });
  try {
    const { slug } = await params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const paymentId = String(body.paymentId ?? "");
    const formData = body.formData && typeof body.formData === "object" && !Array.isArray(body.formData) ? body.formData as Record<string, unknown> : {};
    if (!UUID.test(paymentId)) return NextResponse.json({ error: "Pagamento inválido." }, { status: 400 });

    const service = getSupabaseServiceClient();
    const { data: payment } = await service.from("mercado_pago_payments")
      .select("id,event_id,registration_id,payer_name,amount_cents,purpose,status")
      .eq("id", paymentId).eq("purpose", "event").maybeSingle();
    if (!payment?.event_id || !payment.registration_id) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    const [{ data: event }, { data: registration }] = await Promise.all([
      service.from("events").select("id,title,slug,registration_fee_cents").eq("id", payment.event_id).maybeSingle(),
      service.from("event_registrations").select("id,status").eq("id", payment.registration_id).maybeSingle(),
    ]);
    if (!event || event.slug !== slug || !registration || Number(payment.amount_cents) !== Number(event.registration_fee_cents)) {
      return NextResponse.json({ error: "Os dados desta inscrição não conferem." }, { status: 409 });
    }
    if (registration.status === "confirmed" || payment.status === "approved") {
      return NextResponse.json({ error: "Esta inscrição já está paga e confirmada." }, { status: 409 });
    }

    let providerPaymentCreated = false;
    try {
      const result = await createMercadoPagoBrickPayment({
        paymentId,
        amountCents: Number(payment.amount_cents),
        payerName: payment.payer_name,
        formData,
        purpose: "event",
        description: `Inscrição · ${event.title}`,
        maxInstallments: 4,
      });
      providerPaymentCreated = true;
      await service.from("mercado_pago_payments").update({
        provider_payment_id: result.providerPaymentId,
        payment_method_id: result.paymentMethodId,
        status: result.status,
        status_detail: result.statusDetail || null,
        updated_at: new Date().toISOString(),
      }).eq("id", paymentId);
      await synchronizeMercadoPagoPayment(result.providerPaymentId);
      return NextResponse.json({ ok: true, paymentId, ...result });
    } catch (error) {
      if (!providerPaymentCreated) console.error("event_payment_provider_error", error instanceof Error ? error.message : "unknown");
      throw error;
    }
  } catch (error) {
    console.error("event_payment_error", error instanceof Error ? error.message : "unknown");
    const message = error instanceof Error && !/Mercado Pago respondeu/.test(error.message)
      ? error.message
      : "Não foi possível processar o pagamento agora. Confira os dados e tente novamente.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
