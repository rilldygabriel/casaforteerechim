import { createMercadoPagoBrickPayment, isMercadoPagoBrickConfigured, synchronizeMercadoPagoPayment } from "@/lib/mercado-pago";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function amountInCents(value: unknown) {
  const normalized = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export async function POST(request: Request) {
  if (!isMercadoPagoBrickConfigured()) return Response.json({ error: "O pagamento dentro do site está sendo ativado. Tente novamente em instantes." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const paymentId = String(body.requestId ?? "");
  const payerName = String(body.name ?? "").trim();
  const titheCents = amountInCents(body.tithe);
  const firstfruitsCents = amountInCents(body.firstfruits);
  const offeringCents = amountInCents(body.offering);
  const formData = body.formData && typeof body.formData === "object" && !Array.isArray(body.formData) ? body.formData as Record<string, unknown> : {};
  const amountCents = titheCents + firstfruitsCents + offeringCents;
  if (!UUID.test(paymentId)) return Response.json({ error: "Solicitação de pagamento inválida." }, { status: 400 });
  if (payerName.length < 2 || payerName.length > 160) return Response.json({ error: "Informe seu nome." }, { status: 400 });
  if ([titheCents, firstfruitsCents, offeringCents].some((value) => value < 0)) return Response.json({ error: "Os valores não podem ser negativos." }, { status: 400 });
  if (amountCents < 100 || amountCents > 100_000_000) return Response.json({ error: "Informe um valor entre R$ 1,00 e R$ 1.000.000,00." }, { status: 400 });

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const payerEmail = user?.email?.trim().toLowerCase() || null;

  const service = getSupabaseServiceClient();
  const { data: existing } = await service.from("mercado_pago_payments").select("checkout_url").eq("id", paymentId).maybeSingle();
  if (existing?.checkout_url) return Response.json({ ok: true, checkoutUrl: existing.checkout_url });
  const { error: insertError } = await service.from("mercado_pago_payments").insert({
    id: paymentId,
    purpose: "contribution",
    payer_name: payerName,
    payer_email: payerEmail,
    payer_phone: null,
    amount_cents: amountCents,
    tithe_cents: titheCents,
    firstfruits_cents: firstfruitsCents,
    offering_cents: offeringCents,
  });
  if (insertError?.code !== "23505" && insertError) return Response.json({ error: "Não foi possível iniciar a contribuição." }, { status: 500 });

  let providerPaymentCreated = false;
  try {
    const payment = await createMercadoPagoBrickPayment({
      paymentId,
      amountCents,
      payerName,
      formData,
    });
    providerPaymentCreated = true;
    await service.from("mercado_pago_payments").update({
      provider_payment_id: payment.providerPaymentId,
      payment_method_id: payment.paymentMethodId,
      status: payment.status,
      status_detail: payment.statusDetail || null,
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);
    await synchronizeMercadoPagoPayment(payment.providerPaymentId);
    return Response.json({ ok: true, paymentId, ...payment });
  } catch (error) {
    console.error("mercado_pago_checkout_error", error instanceof Error ? error.message : "unknown");
    if (!providerPaymentCreated) await service.from("mercado_pago_payments").delete().eq("id", paymentId).eq("status", "created");
    return Response.json({ error: error instanceof Error && !/Mercado Pago respondeu/.test(error.message) ? error.message : "Não foi possível processar pelo Mercado Pago agora. Confira os dados e tente novamente." }, { status: 502 });
  }
}
