import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const API_URL = "https://api.pagseguro.com";
const SITE_URL = "https://www.casaforteerechim.app.br";
type Json = Record<string, unknown>;
type PagBankStatus = "created" | "pending" | "in_process" | "approved" | "rejected" | "cancelled" | "refunded" | "charged_back" | "expired";

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function token() {
  const value = process.env.PAGBANK_TOKEN?.trim();
  if (!value) throw new Error("PagBank ainda não foi configurado.");
  return value;
}

export function isPagBankConfigured() {
  return Boolean(process.env.PAGBANK_TOKEN?.trim());
}

let publicKeyPromise: Promise<string> | null = null;

async function requestPagBankPublicKey(method: "GET" | "POST") {
  const path = method === "GET" ? "/public-keys/card" : "/public-keys";
  const response = await fetch(new URL(path, API_URL), {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
    },
    body: method === "POST" ? JSON.stringify({ type: "card" }) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (method === "GET" && response.status === 404) return "";
  const result = object(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(text(result.message) || `PagBank respondeu ${response.status}.`);
  return text(result.public_key);
}

export function getPagBankPublicKey() {
  if (!publicKeyPromise) {
    publicKeyPromise = (async () => {
      const existing = await requestPagBankPublicKey("GET");
      const publicKey = existing || await requestPagBankPublicKey("POST");
      if (!publicKey) throw new Error("O PagBank não forneceu a chave pública do cartão.");
      return publicKey;
    })().catch((error) => {
      publicKeyPromise = null;
      throw error;
    });
  }
  return publicKeyPromise;
}

async function pagBankFetch(path: string, init: RequestInit = {}) {
  const url = new URL(path, API_URL);
  if (url.origin !== API_URL) throw new Error("Endereço inesperado do PagBank.");
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const result = object(await response.json().catch(() => ({})));
  if (!response.ok) {
    const errorMessages = array(result.error_messages)
      .map(object)
      .map((error) => text(error.description) || text(error.message) || text(error.code))
      .filter(Boolean);
    throw new Error(errorMessages.join(" · ") || text(result.message) || `PagBank respondeu ${response.status}.`);
  }
  return result;
}

function normalizeStatus(value: string): PagBankStatus {
  const status = value.toUpperCase();
  if (status === "PAID") return "approved";
  if (status === "WAITING") return "pending";
  if (status === "IN_ANALYSIS" || status === "AUTHORIZED") return "in_process";
  if (status === "DECLINED") return "rejected";
  if (status === "CANCELED") return "cancelled";
  if (status === "EXPIRED") return "expired";
  return "pending";
}

function phoneParts(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (!/^\d{10,11}$/.test(digits)) throw new Error("Informe um WhatsApp válido.");
  return { country: "55", area: digits.slice(0, 2), number: digits.slice(2), type: "MOBILE" };
}

function validCpf(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let size = 9; size <= 10; size += 1) {
    const sum = cpf.slice(0, size).split("").reduce((total, digit, index) => total + Number(digit) * (size + 1 - index), 0);
    const check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (Number(cpf[size]) !== check) return false;
  }
  return true;
}

function chargeFromOrder(order: Json, paymentId: string) {
  return array(order.charges).map(object).find((charge) => text(charge.reference_id) === paymentId) || object(array(order.charges)[0]);
}

function qrCodeFromCharge(charge: Json) {
  const qrCode = object(charge.qr_code);
  return text(qrCode.text);
}

async function qrCodeBase64FromCharge(charge: Json) {
  const link = array(charge.links).map(object).find((item) => text(item.rel) === "QRCODE.PNG");
  const href = text(link?.href);
  if (!href) return "";
  const url = new URL(href);
  if (url.protocol !== "https:" || !url.hostname.endsWith("pagseguro.com")) return "";
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token()}` }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return "";
    return Buffer.from(await response.arrayBuffer()).toString("base64");
  } catch {
    return "";
  }
}

export async function createPagBankEventPayment(input: {
  paymentId: string;
  eventTitle: string;
  amountCents: number;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  taxId: string;
  method: "pix" | "card";
  encryptedCard?: string;
  cardHolder?: string;
  installments?: number;
}) {
  const taxId = input.taxId.replace(/\D/g, "");
  if (!validCpf(taxId)) throw new Error("Informe um CPF válido para o pagamento.");
  const installments = Math.max(1, Math.min(4, Math.trunc(input.installments || 1)));
  if (input.method === "card" && !input.encryptedCard) throw new Error("Os dados do cartão não foram criptografados.");
  const paymentMethod: Json = input.method === "pix" ? {
    type: "PIX",
    pix: { expiration_date: new Date(Date.now() + 24 * 60 * 60_000).toISOString() },
  } : {
    type: "CREDIT_CARD",
    installments,
    capture: true,
    card: {
      encrypted: input.encryptedCard,
      store: false,
      holder: { name: input.cardHolder || input.payerName, tax_id: taxId },
    },
  };
  const result = await pagBankFetch("/orders", {
    method: "POST",
    headers: { "x-idempotency-key": input.paymentId },
    body: JSON.stringify({
      reference_id: input.paymentId,
      customer: {
        name: input.payerName,
        email: input.payerEmail,
        tax_id: taxId,
        phones: [phoneParts(input.payerPhone)],
      },
      items: [{ reference_id: input.paymentId, name: `Inscrição · ${input.eventTitle}`.slice(0, 100), quantity: 1, unit_amount: input.amountCents }],
      charges: [{
        reference_id: input.paymentId,
        description: `Inscrição · ${input.eventTitle}`.slice(0, 64),
        amount: { value: input.amountCents, currency: "BRL" },
        payment_method: paymentMethod,
      }],
      notification_urls: [`${SITE_URL}/api/webhooks/pagbank`],
    }),
  });
  const orderId = text(result.id);
  const charge = chargeFromOrder(result, input.paymentId);
  const chargeId = text(charge.id);
  if (!orderId.startsWith("ORDE_") || !chargeId.startsWith("CHAR_")) throw new Error("O PagBank não confirmou a criação do pagamento.");
  return {
    providerOrderId: orderId,
    providerPaymentId: chargeId,
    status: normalizeStatus(text(charge.status)),
    statusDetail: text(object(charge.payment_response).message),
    paymentMethodId: input.method === "pix" ? "pix" : "credit_card",
    qrCode: qrCodeFromCharge(charge),
    qrCodeBase64: input.method === "pix" ? await qrCodeBase64FromCharge(charge) : "",
  };
}

export async function synchronizePagBankEventPayment(paymentId: string) {
  const service = getSupabaseServiceClient();
  const { data: localPayment } = await service.from("mercado_pago_payments")
    .select("id,event_id,registration_id,payer_name,amount_cents,status,provider_order_id")
    .eq("id", paymentId).eq("purpose", "event").eq("payment_provider", "pagbank").maybeSingle();
  if (!localPayment?.provider_order_id) return { ignored: true };
  const order = await pagBankFetch(`/orders/${encodeURIComponent(localPayment.provider_order_id)}`);
  const charge = chargeFromOrder(order, paymentId);
  const providerAmount = number(object(charge.amount).value);
  if (providerAmount !== Number(localPayment.amount_cents)) throw new Error("O valor confirmado pelo PagBank diverge da inscrição.");
  const status = normalizeStatus(text(charge.status));
  const approvedAt = status === "approved" ? text(charge.paid_at) || new Date().toISOString() : null;
  const { error: updateError } = await service.from("mercado_pago_payments").update({
    provider_payment_id: text(charge.id) || null,
    status,
    status_detail: text(object(charge.payment_response).message) || null,
    payment_method_id: text(object(charge.payment_method).type).toLowerCase() || null,
    // O resumo `paid` confirma o valor bruto, não o líquido depois das tarifas.
    // Mantemos o líquido vazio para não exibir um valor financeiro enganoso.
    net_received_cents: null,
    pix_qr_code: qrCodeFromCharge(charge) || null,
    approved_at: approvedAt,
    updated_at: new Date().toISOString(),
  }).eq("id", localPayment.id);
  if (updateError) throw new Error("Não foi possível atualizar o pagamento PagBank.");
  if (localPayment.registration_id) {
    const registrationStatus = status === "approved" ? "confirmed" : ["rejected", "cancelled", "expired"].includes(status) ? "cancelled" : "awaiting_payment";
    await service.from("event_registrations").update({ status: registrationStatus, updated_at: new Date().toISOString() }).eq("id", localPayment.registration_id);
  }
  if (status === "approved") {
    const fingerprint = createHash("sha256").update(`pagbank|${text(charge.id)}`).digest("hex");
    await service.from("finance_income_entries").upsert({
      transaction_date: approvedAt!.slice(0, 10),
      description: "Inscrição de evento via PagBank",
      amount_cents: Number(localPayment.amount_cents),
      fingerprint,
      source: "pagbank",
      mercado_pago_payment_id: localPayment.id,
    }, { onConflict: "fingerprint", ignoreDuplicates: true });
  }
  return { ignored: false, status, paymentId: localPayment.id };
}

export async function expireStalePagBankPixPayments() {
  const service = getSupabaseServiceClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { data: stalePayments, error: selectError } = await service.from("mercado_pago_payments")
    .select("id")
    .eq("purpose", "event")
    .eq("payment_provider", "pagbank")
    .eq("payment_method_id", "pix")
    .in("status", ["created", "pending", "in_process"])
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(100);
  if (selectError) throw new Error("Não foi possível consultar os Pix PagBank pendentes.");

  const eligibleForExpiry: string[] = [];
  let synchronized = 0;
  let synchronizationFailures = 0;
  for (const payment of stalePayments ?? []) {
    try {
      const result = await synchronizePagBankEventPayment(payment.id);
      synchronized += 1;
      if (!result.ignored && result.status && ["created", "pending", "in_process"].includes(result.status)) eligibleForExpiry.push(payment.id);
    } catch (error) {
      synchronizationFailures += 1;
      console.error("pagbank_stale_pix_sync_error", { paymentId: payment.id, error });
    }
  }
  if (!eligibleForExpiry.length) return { checked: stalePayments?.length ?? 0, synchronized, synchronizationFailures, expired: 0 };

  const { data: expiredPayments, error: expireError } = await service.from("mercado_pago_payments").update({
    status: "expired",
    status_detail: "not_confirmed_within_24_hours",
    updated_at: new Date().toISOString(),
  })
    .in("id", eligibleForExpiry)
    .eq("payment_provider", "pagbank")
    .in("status", ["created", "pending", "in_process"])
    .lt("created_at", cutoff)
    .select("id,registration_id");
  if (expireError) throw new Error("Não foi possível retirar os Pix PagBank vencidos do processamento.");

  const registrationIds = (expiredPayments ?? []).map((payment) => payment.registration_id).filter((id): id is string => Boolean(id));
  if (registrationIds.length) await service.from("event_registrations").update({ status: "cancelled", updated_at: new Date().toISOString() }).in("id", registrationIds);
  return { checked: stalePayments?.length ?? 0, synchronized, synchronizationFailures, expired: expiredPayments?.length ?? 0 };
}

export function pagBankWebhookSignature(rawBody: string) {
  return createHash("sha256").update(`${token()}-${rawBody}`).digest("hex");
}

export function validatePagBankWebhook(rawBody: string, signature: string) {
  const expected = pagBankWebhookSignature(rawBody);
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}
