import { createMercadoPagoCheckout, isMercadoPagoConfigured } from "@/lib/mercado-pago";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function amountInCents(value: unknown) {
  const normalized = String(value ?? "").trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export async function POST(request: Request) {
  if (!isMercadoPagoConfigured()) return Response.json({ error: "O checkout está sendo ativado. Tente novamente em instantes." }, { status: 503 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const paymentId = String(body.requestId ?? "");
  const purpose = String(body.purpose ?? "");
  const payerName = String(body.name ?? "").trim();
  const payerEmail = String(body.email ?? "").trim().toLowerCase();
  const payerPhone = String(body.phone ?? "").trim();
  const amountCents = amountInCents(body.amount);
  if (!UUID.test(paymentId) || !["tithe", "offering", "firstfruits"].includes(purpose)) return Response.json({ error: "Solicitação de pagamento inválida." }, { status: 400 });
  if (payerName.length < 2 || payerName.length > 160) return Response.json({ error: "Informe seu nome." }, { status: 400 });
  if (payerEmail && !EMAIL.test(payerEmail)) return Response.json({ error: "Informe um e-mail válido ou deixe o campo vazio." }, { status: 400 });
  if (amountCents < 100 || amountCents > 100_000_000) return Response.json({ error: "Informe um valor entre R$ 1,00 e R$ 1.000.000,00." }, { status: 400 });

  const service = getSupabaseServiceClient();
  const { data: existing } = await service.from("mercado_pago_payments").select("checkout_url").eq("id", paymentId).maybeSingle();
  if (existing?.checkout_url) return Response.json({ ok: true, checkoutUrl: existing.checkout_url });
  const { error: insertError } = await service.from("mercado_pago_payments").insert({
    id: paymentId,
    purpose,
    payer_name: payerName,
    payer_email: payerEmail || null,
    payer_phone: payerPhone || null,
    amount_cents: amountCents,
  });
  if (insertError?.code !== "23505" && insertError) return Response.json({ error: "Não foi possível iniciar a contribuição." }, { status: 500 });

  try {
    const checkout = await createMercadoPagoCheckout({
      paymentId,
      purpose: purpose as "tithe" | "offering" | "firstfruits",
      amountCents,
      payerName,
      payerEmail: payerEmail || null,
      payerPhone: payerPhone || null,
      returnPath: "/generosidade",
    });
    await service.from("mercado_pago_payments").update({
      provider_preference_id: checkout.preferenceId,
      checkout_url: checkout.checkoutUrl,
      status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("id", paymentId);
    return Response.json({ ok: true, checkoutUrl: checkout.checkoutUrl });
  } catch (error) {
    console.error("mercado_pago_checkout_error", error instanceof Error ? error.message : "unknown");
    await service.from("mercado_pago_payments").delete().eq("id", paymentId).eq("status", "created");
    return Response.json({ error: "Não foi possível abrir o Mercado Pago agora. Tente novamente." }, { status: 502 });
  }
}
