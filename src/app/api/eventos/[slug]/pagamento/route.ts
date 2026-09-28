import { NextRequest, NextResponse } from "next/server";
import { getEventTicketDeliveryState } from "@/lib/event-ticket-delivery";
import { createMercadoPagoBrickPayment, isMercadoPagoBrickConfigured, synchronizeMercadoPagoPayment } from "@/lib/mercado-pago";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { createPagBankEventPayment, isPagBankConfigured, synchronizePagBankEventPayment } from "@/lib/pagbank";
import { validateEventPaymentInput } from "@/lib/event-payment-policy";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const paymentId = request.nextUrl.searchParams.get("paymentId")?.trim() || "";
    if (!UUID.test(paymentId)) return NextResponse.json({ error: "Pagamento inválido." }, { status: 400 });

    const service = getSupabaseServiceClient();
    const { data: payment } = await service.from("mercado_pago_payments")
      .select("id,event_id,registration_id,status,provider_payment_id,provider_order_id,payment_method_id,payment_provider")
      .eq("id", paymentId).eq("purpose", "event").in("payment_provider", ["mercado_pago", "pagbank"]).maybeSingle();
    if (!payment?.event_id || !payment.registration_id) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });

    const { data: event } = await service.from("events").select("slug").eq("id", payment.event_id).maybeSingle();
    if (!event || event.slug !== slug) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });

    if (payment.payment_provider === "pagbank" && payment.provider_order_id) {
      return NextResponse.json({ ok: true, paymentProvider: "pagbank", ...await synchronizePagBankEventPayment(paymentId) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (payment.payment_provider === "mercado_pago" && payment.provider_payment_id && /^\d+$/.test(payment.provider_payment_id)) {
      const synchronized = await synchronizeMercadoPagoPayment(payment.provider_payment_id);
      return NextResponse.json({
        ok: true,
        status: synchronized.status,
        providerPaymentId: payment.provider_payment_id,
        paymentMethodId: payment.payment_method_id || "pix",
        ticketUrl: synchronized.ticketUrl,
        emailSent: synchronized.emailSent ?? false,
        whatsappSent: synchronized.whatsappSent ?? false,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const delivery = await getEventTicketDeliveryState(payment.registration_id);
    return NextResponse.json({
      ok: true,
      status: payment.status,
      providerPaymentId: payment.provider_payment_id || "",
      paymentMethodId: payment.payment_method_id || "pix",
      ...delivery,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("event_payment_status_error", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Não foi possível consultar a confirmação agora." }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const { slug } = await params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const paymentId = String(body.paymentId ?? "");
    const formData = body.formData && typeof body.formData === "object" && !Array.isArray(body.formData) ? body.formData as Record<string, unknown> : {};
    if (!UUID.test(paymentId)) return NextResponse.json({ error: "Pagamento inválido." }, { status: 400 });

    const service = getSupabaseServiceClient();
    const { data: payment } = await service.from("mercado_pago_payments")
      .select("id,event_id,registration_id,payer_name,payer_email,payer_phone,amount_cents,purpose,status,payment_provider,provider_order_id,provider_payment_id")
      .eq("id", paymentId).eq("purpose", "event").in("payment_provider", ["mercado_pago", "pagbank"]).maybeSingle();
    if (!payment?.event_id || !payment.registration_id) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    const [{ data: event }, { data: registration }] = await Promise.all([
      service.from("events").select("id,title,slug,registration_fee_cents,ministry_key,ministry_payment_methods").eq("id", payment.event_id).maybeSingle(),
      service.from("event_registrations").select("id,status,order_total_cents,ministry_method").eq("id", payment.registration_id).maybeSingle(),
    ]);
    const expectedAmountCents = event?.ministry_key || event?.slug === "hamburguer-da-casa-20-09" ? Number(registration?.order_total_cents) : Number(event?.registration_fee_cents);
    if (!event || event.slug !== slug || !registration || Number(payment.amount_cents) !== expectedAmountCents) {
      return NextResponse.json({ error: "Os dados desta inscrição não conferem." }, { status: 409 });
    }
    if (registration.status === "confirmed" || payment.status === "approved") {
      return NextResponse.json({ error: "Esta inscrição já está paga e confirmada." }, { status: 409 });
    }

    if (payment.payment_provider === "pagbank") {
      if (!isPagBankConfigured()) return NextResponse.json({ error: "PagBank indisponível agora." }, { status: 503 });
      if (payment.provider_order_id) return NextResponse.json({ ok: true, ...await synchronizePagBankEventPayment(paymentId) });
      if(event.ministry_key && (registration.status!=="awaiting_payment" || !["created","in_process"].includes(payment.status) || body.method!==registration.ministry_method || !event.ministry_payment_methods.includes(body.method) || Number(body.installments||1)!==1)) return NextResponse.json({error:"A forma de pagamento ou a reserva não está disponível. Volte ao evento para conferir seu pedido."},{status:409});
      const invalid = validateEventPaymentInput(body, slug);
      if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
      if(event.ministry_key){const {error}=await service.rpc("begin_ministry_payment",{p_id:paymentId,p_method:body.method});if(error)return NextResponse.json({error:"Sua reserva mudou. Confira o pedido antes de pagar."},{status:409});}
      const result = await createPagBankEventPayment({
        paymentId, eventTitle: event.title, amountCents: Number(payment.amount_cents),
        payerName: payment.payer_name, payerEmail: payment.payer_email, payerPhone: payment.payer_phone || "",
        taxId: String(body.taxId), method: body.method as "pix" | "card",
        encryptedCard: typeof body.encryptedCard === "string" ? body.encryptedCard : undefined,
        cardHolder: typeof body.cardHolder === "string" ? body.cardHolder : undefined,
        installments: Number(body.installments || 1),
      });
      // Persist the order even if its webhook wins the race. Do not overwrite status here.
      const { error: saveError } = await service.from("mercado_pago_payments").update({
        provider_order_id: result.providerOrderId, provider_payment_id: result.providerPaymentId,
        payment_method_id: result.paymentMethodId, pix_qr_code: result.qrCode || null,
        updated_at: new Date().toISOString(),
      }).eq("id", paymentId).eq("payment_provider", "pagbank");
      if (saveError) throw new Error("O pedido foi enviado. Verifique a confirmação antes de tentar novamente.");
      return NextResponse.json({ ok: true, paymentId, ...result, ...await synchronizePagBankEventPayment(paymentId) });
    }
    if (!isMercadoPagoBrickConfigured()) return NextResponse.json({ error: "Mercado Pago indisponível para esta cobrança antiga." }, { status: 503 });

    let providerPaymentCreated = false;
    try {
      const result = await createMercadoPagoBrickPayment({
        paymentId,
        amountCents: Number(payment.amount_cents),
        payerName: payment.payer_name,
        formData,
        purpose: "event",
        description: `Inscrição · ${event.title}`,
        maxInstallments: event.slug === "hamburguer-da-casa-20-09" ? 1 : 4,
      });
      providerPaymentCreated = true;
      await service.from("mercado_pago_payments").update({
        provider_payment_id: result.providerPaymentId,
        payment_method_id: result.paymentMethodId,
        status: result.status,
        status_detail: result.statusDetail || null,
        updated_at: new Date().toISOString(),
      }).eq("id", paymentId);
      const synchronized = await synchronizeMercadoPagoPayment(result.providerPaymentId);
      return NextResponse.json({
        ok: true,
        paymentId,
        ...result,
        ticketUrl: synchronized.ticketUrl,
        emailSent: synchronized.emailSent ?? false,
        whatsappSent: synchronized.whatsappSent ?? false,
      });
    } catch (error) {
      if (!providerPaymentCreated) console.error("event_payment_provider_error", error instanceof Error ? error.message : "unknown");
      throw error;
    }
  } catch (error) {
    console.error("event_payment_error", error instanceof Error ? error.message : "unknown");
    const message = "Não foi possível concluir agora. Confira os dados e consulte a confirmação antes de tentar novamente. Não refaça um pagamento já debitado.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
