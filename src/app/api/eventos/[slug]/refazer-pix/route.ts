import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { cancelMercadoPagoPayment, createMercadoPagoBrickPayment, isMercadoPagoBrickConfigured, synchronizeMercadoPagoPayment } from "@/lib/mercado-pago";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REPLACEABLE_STATUSES = ["created", "pending", "in_process", "rejected", "cancelled", "expired"];

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!isMercadoPagoBrickConfigured()) return NextResponse.json({ error: "O Pix Mercado Pago está indisponível agora." }, { status: 503 });
  try {
    const { slug } = await params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const currentPaymentId = String(body.paymentId ?? "");
    if (!UUID.test(currentPaymentId)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

    const service = getSupabaseServiceClient();
    const { data: current } = await service.from("mercado_pago_payments")
      .select("id,event_id,registration_id,payer_name,payer_email,payer_phone,amount_cents,status,provider_payment_id,payment_provider")
      .eq("id", currentPaymentId)
      .eq("purpose", "event")
      .eq("payment_provider", "mercado_pago")
      .maybeSingle();
    if (!current?.event_id || !current.registration_id) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

    const [{ data: event }, { data: registration }] = await Promise.all([
      service.from("events").select("id,title,slug").eq("id", current.event_id).maybeSingle(),
      service.from("event_registrations").select("id,status,order_total_cents").eq("id", current.registration_id).maybeSingle(),
    ]);
    if (!event || event.slug !== slug || !registration || event.slug !== "hamburguer-da-casa-20-09") {
      return NextResponse.json({ error: "Este pedido não pode gerar um novo Pix." }, { status: 409 });
    }

    if (current.provider_payment_id && ["pending", "in_process"].includes(current.status)) {
      const synchronized = await synchronizeMercadoPagoPayment(current.provider_payment_id);
      if (synchronized.status === "approved") {
        return NextResponse.json({ error: "Este pedido já foi pago.", ticketUrl: synchronized.ticketUrl }, { status: 409 });
      }
    }

    const { data: latest } = await service.from("mercado_pago_payments")
      .select("status,provider_payment_id")
      .eq("id", current.id)
      .single();
    if (!latest) return NextResponse.json({ error: "A cobrança atual não foi encontrada." }, { status: 404 });
    if (latest.status === "approved" || registration.status === "confirmed") {
      return NextResponse.json({ error: "Este pedido já foi pago." }, { status: 409 });
    }
    if (!REPLACEABLE_STATUSES.includes(latest.status)) {
      return NextResponse.json({ error: "Este Pix não pode ser substituído." }, { status: 409 });
    }

    if (latest.provider_payment_id && ["pending", "in_process"].includes(latest.status)) {
      await cancelMercadoPagoPayment(latest.provider_payment_id);
    }
    await service.from("mercado_pago_payments").update({
      status: "cancelled",
      status_detail: "replaced_by_customer",
      updated_at: new Date().toISOString(),
    }).eq("id", current.id).neq("status", "approved");

    const paymentId = randomUUID();
    const { error: insertError } = await service.from("mercado_pago_payments").insert({
      id: paymentId,
      purpose: "event",
      payment_provider: "mercado_pago",
      event_id: current.event_id,
      registration_id: current.registration_id,
      payer_name: current.payer_name,
      payer_email: current.payer_email,
      payer_phone: current.payer_phone,
      amount_cents: current.amount_cents,
    });
    if (insertError) throw new Error("Não foi possível abrir uma nova cobrança para este pedido.");

    await service.from("event_registrations").update({ status: "awaiting_payment", updated_at: new Date().toISOString() }).eq("id", current.registration_id);
    const result = await createMercadoPagoBrickPayment({
      paymentId,
      amountCents: Number(current.amount_cents),
      payerName: current.payer_name,
      formData: { payment_method_id: "pix", payer: { email: current.payer_email } },
      purpose: "event",
      description: `Pedido · ${event.title}`,
      maxInstallments: 1,
    });
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
    console.error("event_pix_replacement_error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível gerar um novo Pix agora." }, { status: 502 });
  }
}
