import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { sendWhatsappNotification } from "@/lib/whatsapp";

const API_URL = "https://api.mercadopago.com";
const SITE_URL = "https://www.casaforteerechim.app.br";

type Json = Record<string, unknown>;
type PaymentPurpose = "tithe" | "offering" | "firstfruits" | "contribution" | "event";
type ContributionPurpose = "tithe" | "offering" | "firstfruits";

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function number(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function credentials() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) throw new Error("Mercado Pago ainda não foi configurado.");
  return { accessToken };
}

export function isMercadoPagoConfigured() {
  return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim());
}

export function isMercadoPagoBrickConfigured() {
  return isMercadoPagoConfigured() && Boolean(process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY?.trim());
}

async function mercadoPagoFetch(path: string, init: RequestInit = {}) {
  const url = new URL(path, API_URL);
  if (url.origin !== API_URL) throw new Error("Endereço inesperado do Mercado Pago.");
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credentials().accessToken}`,
      ...init.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const result = object(await response.json().catch(() => ({})));
  if (!response.ok) throw new Error(text(result.message) || `Mercado Pago respondeu ${response.status}.`);
  return result;
}

export async function createMercadoPagoBrickPayment(input: {
  paymentId: string;
  amountCents: number;
  payerName: string;
  formData: Json;
  purpose?: "contribution" | "event";
  description?: string;
  maxInstallments?: number;
}) {
  const payer = object(input.formData.payer);
  const identification = object(payer.identification);
  const email = text(payer.email).toLowerCase();
  const paymentMethodId = text(input.formData.payment_method_id);
  const token = text(input.formData.token);
  const issuerId = text(input.formData.issuer_id);
  const maxInstallments = Math.max(1, Math.min(12, Math.trunc(input.maxInstallments || 12)));
  const installments = Math.max(1, Math.min(maxInstallments, Math.trunc(number(input.formData.installments) || 1)));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido no pagamento.");
  if (!paymentMethodId || (paymentMethodId !== "pix" && !token)) throw new Error("Dados de pagamento incompletos.");
  const nameParts = input.payerName.trim().split(/\s+/);
  const body: Json = {
    transaction_amount: input.amountCents / 100,
    description: (input.description || "Contribuição · Igreja Casa Forte").slice(0, 120),
    payment_method_id: paymentMethodId,
    external_reference: input.paymentId,
    notification_url: `${SITE_URL}/api/webhooks/mercado-pago`,
    statement_descriptor: "CASA FORTE",
    payer: {
      email,
      first_name: nameParts[0] || input.payerName,
      last_name: nameParts.slice(1).join(" ") || undefined,
      ...(text(identification.type) && text(identification.number) ? {
        identification: { type: text(identification.type), number: text(identification.number).replace(/\D/g, "") },
      } : {}),
    },
    metadata: { purpose: input.purpose || "contribution" },
  };
  if (token) {
    body.token = token;
    body.installments = installments;
    if (issuerId) body.issuer_id = issuerId;
  }
  const result = await mercadoPagoFetch("/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": input.paymentId },
    body: JSON.stringify(body),
  });
  const transactionData = object(object(result.point_of_interaction).transaction_data);
  const providerPaymentId = String(result.id ?? "").trim();
  if (!/^\d+$/.test(providerPaymentId)) throw new Error("O Mercado Pago não confirmou a criação do pagamento.");
  return {
    providerPaymentId,
    status: mapPaymentStatus(text(result.status)),
    statusDetail: text(result.status_detail),
    paymentMethodId,
    qrCode: text(transactionData.qr_code),
    qrCodeBase64: text(transactionData.qr_code_base64),
    ticketUrl: text(transactionData.ticket_url),
  };
}

function titleForPurpose(purpose: PaymentPurpose, eventTitle?: string) {
  if (purpose === "event") return `Inscrição · ${eventTitle || "Evento Casa Forte"}`;
  if (purpose === "contribution") return "Contribuição · Igreja Casa Forte";
  if (purpose === "tithe") return "Dízimo · Igreja Casa Forte";
  if (purpose === "firstfruits") return "Oferta de primícias · Igreja Casa Forte";
  return "Oferta · Igreja Casa Forte";
}

export async function createMercadoPagoCheckout(input: {
  paymentId: string;
  purpose: PaymentPurpose;
  amountCents: number;
  payerName: string;
  payerEmail?: string | null;
  payerPhone?: string | null;
  eventTitle?: string;
  returnPath?: string;
  allocations?: Partial<Record<ContributionPurpose, number>>;
}) {
  const returnPath = input.returnPath?.startsWith("/") ? input.returnPath : "/generosidade";
  const returnUrl = `${SITE_URL}/pagamento/retorno?reference=${encodeURIComponent(input.paymentId)}&from=${encodeURIComponent(returnPath)}`;
  const expiration = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const phoneDigits = (input.payerPhone || "").replace(/\D/g, "");
  const allocationLabels: Record<ContributionPurpose, string> = {
    tithe: "Dízimo",
    firstfruits: "Primícias",
    offering: "Oferta",
  };
  const contributionItems = input.purpose === "contribution"
    ? (Object.entries(input.allocations || {}) as [ContributionPurpose, number][])
      .filter(([, cents]) => Number.isInteger(cents) && cents > 0)
      .map(([purpose, cents]) => ({
        id: `${input.paymentId}:${purpose}`,
        title: `${allocationLabels[purpose]} · Igreja Casa Forte`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: cents / 100,
      }))
    : [];
  if (input.purpose === "contribution" && contributionItems.reduce((sum, item) => sum + Math.round(item.unit_price * 100), 0) !== input.amountCents) {
    throw new Error("A divisão da contribuição não corresponde ao valor total.");
  }
  const body: Json = {
    items: contributionItems.length ? contributionItems : [{
      id: input.paymentId,
      title: titleForPurpose(input.purpose, input.eventTitle).slice(0, 120),
      quantity: 1,
      currency_id: "BRL",
      unit_price: input.amountCents / 100,
    }],
    external_reference: input.paymentId,
    notification_url: `${SITE_URL}/api/webhooks/mercado-pago`,
    back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
    auto_return: "approved",
    statement_descriptor: "CASA FORTE",
    expires: true,
    expiration_date_to: expiration,
    metadata: { purpose: input.purpose, allocations: input.allocations || {} },
  };
  if (input.payerEmail) {
    body.payer = {
      name: input.payerName,
      email: input.payerEmail,
      ...(phoneDigits.length >= 10 ? { phone: { number: phoneDigits } } : {}),
    };
  }
  const result = await mercadoPagoFetch("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": input.paymentId },
    body: JSON.stringify(body),
  });
  const preferenceId = text(result.id);
  const checkoutUrl = text(result.init_point);
  if (!preferenceId || !checkoutUrl) throw new Error("O Mercado Pago não devolveu o link de pagamento.");
  return { preferenceId, checkoutUrl };
}

function mapPaymentStatus(value: string) {
  if (["approved", "pending", "in_process", "rejected", "cancelled", "refunded", "charged_back"].includes(value)) return value;
  return "pending";
}

export function validateMercadoPagoWebhook(input: {
  dataId: string;
  requestId: string;
  signature: string;
}) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();
  if (!secret || !input.dataId || !input.requestId || !input.signature) return false;
  const parts = new Map(input.signature.split(",").map((part) => {
    const [key, ...rest] = part.trim().split("=");
    return [key, rest.join("=")];
  }));
  const timestamp = parts.get("ts") || "";
  const received = parts.get("v1") || "";
  if (!timestamp || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const manifest = `id:${input.dataId.toLowerCase()};request-id:${input.requestId};ts:${timestamp};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export async function synchronizeMercadoPagoPayment(providerPaymentId: string) {
  if (!/^\d+$/.test(providerPaymentId)) throw new Error("Pagamento Mercado Pago inválido.");
  const provider = await mercadoPagoFetch(`/v1/payments/${providerPaymentId}`);
  const externalReference = text(provider.external_reference);
  const status = mapPaymentStatus(text(provider.status));
  const service = getSupabaseServiceClient();
  const { data: localPayment } = await service.from("mercado_pago_payments")
    .select("id,purpose,event_id,registration_id,payer_name,amount_cents,status,tithe_cents,offering_cents,firstfruits_cents,payment_method_id,whatsapp_notification_status")
    .eq("id", externalReference).maybeSingle();
  if (!localPayment) return { ignored: true, status };

  const providerAmountCents = Math.round(number(provider.transaction_amount) * 100);
  if (providerAmountCents !== Number(localPayment.amount_cents)) {
    throw new Error("O valor confirmado diverge da cobrança criada.");
  }
  const transactionDetails = object(provider.transaction_details);
  const approvedAt = status === "approved" ? text(provider.date_approved) || new Date().toISOString() : null;
  const { error: updateError } = await service.from("mercado_pago_payments").update({
    provider_payment_id: providerPaymentId,
    status,
    status_detail: text(provider.status_detail) || null,
    payment_method_id: text(provider.payment_method_id) || null,
    payment_type_id: text(provider.payment_type_id) || null,
    net_received_cents: transactionDetails.net_received_amount === undefined ? null : Math.round(number(transactionDetails.net_received_amount) * 100),
    approved_at: approvedAt,
    updated_at: new Date().toISOString(),
  }).eq("id", localPayment.id);
  if (updateError) throw new Error("Não foi possível atualizar o pagamento recebido.");

  if (localPayment.registration_id) {
    const registrationStatus = status === "approved" ? "confirmed" : ["rejected", "cancelled", "refunded", "charged_back"].includes(status) ? "cancelled" : "awaiting_payment";
    await service.from("event_registrations").update({ status: registrationStatus, updated_at: new Date().toISOString() }).eq("id", localPayment.registration_id);
  }

  if (status === "approved") {
    const parts = [
      Number(localPayment.tithe_cents) > 0 ? `Dízimo ${formatMoney(Number(localPayment.tithe_cents))}` : "",
      Number(localPayment.firstfruits_cents) > 0 ? `Primícias ${formatMoney(Number(localPayment.firstfruits_cents))}` : "",
      Number(localPayment.offering_cents) > 0 ? `Oferta ${formatMoney(Number(localPayment.offering_cents))}` : "",
    ].filter(Boolean);
    const description = localPayment.purpose === "event" ? "Inscrição de evento via Mercado Pago" : localPayment.purpose === "contribution" ? `Contribuição via Mercado Pago · ${parts.join(" · ")}` : localPayment.purpose === "tithe" ? "Dízimo via Mercado Pago" : localPayment.purpose === "firstfruits" ? "Oferta de primícias via Mercado Pago" : "Oferta via Mercado Pago";
    const fingerprint = createHash("sha256").update(`mercado_pago|${providerPaymentId}`).digest("hex");
    await service.from("finance_income_entries").upsert({
      transaction_date: approvedAt!.slice(0, 10),
      description,
      amount_cents: Number(localPayment.amount_cents),
      fingerprint,
      source: "mercado_pago",
      mercado_pago_payment_id: localPayment.id,
    }, { onConflict: "fingerprint", ignoreDuplicates: true });

    if (localPayment.purpose !== "event") {
      await notifyContributionToPastor({
        id: localPayment.id,
        purpose: localPayment.purpose as Exclude<PaymentPurpose, "event">,
        payerName: localPayment.payer_name,
        amountCents: Number(localPayment.amount_cents),
        titheCents: Number(localPayment.tithe_cents),
        offeringCents: Number(localPayment.offering_cents),
        firstfruitsCents: Number(localPayment.firstfruits_cents),
        paymentMethodId: text(provider.payment_method_id) || localPayment.payment_method_id,
      });
    }
  }
  return { ignored: false, status, paymentId: localPayment.id };
}

async function notifyContributionToPastor(input: {
  id: string;
  purpose: Exclude<PaymentPurpose, "event">;
  payerName: string;
  amountCents: number;
  titheCents: number;
  offeringCents: number;
  firstfruitsCents: number;
  paymentMethodId: string | null;
}) {
  const service = getSupabaseServiceClient();
  const { data: claim, error: claimError } = await service.from("mercado_pago_payments")
    .update({ whatsapp_notification_status: "sending", whatsapp_notification_error: null })
    .eq("id", input.id)
    .in("whatsapp_notification_status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error("Não foi possível reservar a notificação da contribuição.");
  if (!claim) return;

  const { data: recipients, error: recipientError } = await service.from("member_profiles")
    .select("phone")
    .ilike("full_name", "Pastor Rilldy")
    .eq("is_admin", true)
    .limit(2);
  const recipient = recipients?.length === 1 ? recipients[0] : null;
  if (recipientError || !recipient?.phone) {
    await service.from("mercado_pago_payments").update({
      whatsapp_notification_status: "failed",
      whatsapp_notification_error: recipients?.length && recipients.length > 1
        ? "Mais de um destinatário financeiro foi encontrado."
        : "Telefone do Pastor Rilldy não encontrado.",
    }).eq("id", input.id);
    throw new Error("Telefone do destinatário da contribuição não encontrado.");
  }

  const titheCents = input.purpose === "tithe" ? input.amountCents : input.titheCents;
  const firstfruitsCents = input.purpose === "firstfruits" ? input.amountCents : input.firstfruitsCents;
  const offeringCents = input.purpose === "offering" ? input.amountCents : input.offeringCents;
  const paymentMethod = input.paymentMethodId === "pix" ? "Pix" : "Cartão";
  const message = [
    "Nova contribuição confirmada 🙏",
    `Pessoa: ${input.payerName}`,
    `Valor total: ${formatMoney(input.amountCents)}`,
    `Primícia: ${formatMoney(firstfruitsCents)}`,
    `Dízimo: ${formatMoney(titheCents)}`,
    `Oferta: ${formatMoney(offeringCents)}`,
    `Forma de pagamento: ${paymentMethod}`,
  ].join(" · ");
  const result = await sendWhatsappNotification(recipient.phone, message);

  if (!result.ok) {
    await service.from("mercado_pago_payments").update({
      whatsapp_notification_status: "failed",
      whatsapp_notification_error: result.error.slice(0, 500),
    }).eq("id", input.id);
    throw new Error("A notificação da contribuição não foi aceita pelo WhatsApp.");
  }

  const { error: sentError } = await service.from("mercado_pago_payments").update({
    whatsapp_notification_status: "sent",
    whatsapp_notification_sent_at: new Date().toISOString(),
    whatsapp_notification_message_id: result.messageId || null,
    whatsapp_notification_error: null,
  }).eq("id", input.id);
  if (sentError) console.error("mercado_pago_whatsapp_notification_audit_error", sentError);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}
