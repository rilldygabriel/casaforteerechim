"use client";

import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import Image from "next/image";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";

type BrickSubmission = Parameters<NonNullable<ComponentProps<typeof Payment>["onSubmit"]>>[0];
type PaymentResult = {
  providerPaymentId: string;
  status: "approved" | "pending" | "in_process" | "rejected" | "cancelled" | "refunded" | "charged_back" | "expired";
  paymentMethodId: string;
  qrCode?: string;
  qrCodeBase64?: string;
  ticketUrl?: string;
  emailSent?: boolean;
  whatsappSent?: boolean;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function EventPayment({
  slug,
  paymentId,
  amountCents,
  fullName,
  email,
  publicKey,
  maxInstallments = 4,
}: {
  slug: string;
  paymentId: string;
  amountCents: number;
  fullName: string;
  email: string;
  publicKey: string;
  maxInstallments?: number;
}) {
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [activePaymentId, setActivePaymentId] = useState(paymentId);
  const [regenerating, setRegenerating] = useState(false);
  const paymentStatus = result?.status;

  useEffect(() => {
    if (publicKey) initMercadoPago(publicKey, { locale: "pt-BR", advancedFraudPrevention: true });
  }, [publicKey]);

  useEffect(() => {
    if (!paymentStatus || !["pending", "in_process"].includes(paymentStatus)) return;
    let cancelled = false;

    async function refreshStatus() {
      try {
        const response = await fetch(`/api/eventos/${encodeURIComponent(slug)}/pagamento?paymentId=${encodeURIComponent(activePaymentId)}`, {
          cache: "no-store",
        });
        const payload = await response.json() as PaymentResult & { error?: string };
        if (cancelled || !response.ok || !payload.status) return;
        setResult((current) => current ? { ...current, ...payload } : current);
        if (payload.status === "approved") {
          if (payload.emailSent && payload.whatsappSent) setMessage("Pagamento confirmado! Seu ingresso foi enviado para o seu e-mail e WhatsApp.");
          else if (payload.emailSent) setMessage("Pagamento confirmado! Seu ingresso foi enviado para o seu e-mail.");
          else if (payload.whatsappSent) setMessage("Pagamento confirmado! Seu ingresso foi enviado para o seu WhatsApp.");
          else setMessage("Pagamento confirmado! Seu ingresso já está disponível abaixo.");
        }
      } catch {
        // A próxima consulta automática tentará novamente sem interromper o pagamento.
      }
    }

    const timer = window.setInterval(refreshStatus, 4_000);
    void refreshStatus();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activePaymentId, paymentStatus, slug]);

  const initialization = useMemo(() => ({
    amount: amountCents / 100,
    payer: {
      email: email || undefined,
      firstName: fullName.trim().split(/\s+/)[0] || undefined,
      lastName: fullName.trim().split(/\s+/).slice(1).join(" ") || undefined,
    },
  }), [amountCents, email, fullName]);

  async function submitPayment(submission: BrickSubmission) {
    setMessage("Processando com segurança pelo Mercado Pago…");
    const response = await fetch(`/api/eventos/${encodeURIComponent(slug)}/pagamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId: activePaymentId, formData: submission.formData }),
    });
    const payload = await response.json() as PaymentResult & { error?: string };
    if (!response.ok || !payload.providerPaymentId) {
      setMessage(payload.error || "Não foi possível processar o pagamento.");
      throw new Error(payload.error || "Não foi possível processar o pagamento.");
    }
    setResult(payload);
    if (payload.status === "approved") {
      if (payload.emailSent && payload.whatsappSent) setMessage("Pagamento confirmado! Seu ingresso foi enviado para o seu e-mail e WhatsApp.");
      else if (payload.emailSent) setMessage("Pagamento confirmado! Seu ingresso foi enviado para o seu e-mail.");
      else if (payload.whatsappSent) setMessage("Pagamento confirmado! Seu ingresso foi enviado para o seu WhatsApp.");
      else setMessage("Pagamento confirmado! Seu ingresso já está disponível abaixo.");
    } else {
      setMessage("Aguardando a confirmação do pagamento. Esta tela será atualizada automaticamente.");
    }
  }

  async function regeneratePix() {
    setRegenerating(true);
    setMessage("Gerando um novo código Pix…");
    try {
      const response = await fetch(`/api/eventos/${encodeURIComponent(slug)}/refazer-pix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: activePaymentId }),
      });
      const payload = await response.json() as PaymentResult & { paymentId?: string; error?: string };
      if (!response.ok) {
        if (payload.ticketUrl) setResult((current) => current ? { ...current, status: "approved", ticketUrl: payload.ticketUrl } : current);
        throw new Error(payload.error || "Não foi possível gerar o novo Pix.");
      }
      if (!payload.paymentId || !payload.providerPaymentId) throw new Error("O novo Pix não foi confirmado.");
      setActivePaymentId(payload.paymentId);
      setResult(payload);
      setCopied(false);
      setMessage("Novo Pix gerado. O código anterior foi cancelado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o novo Pix.");
    } finally {
      setRegenerating(false);
    }
  }

  async function copyPix() {
    if (!result?.qrCode) return;
    await navigator.clipboard.writeText(result.qrCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  if (result) {
    const approved = result.status === "approved";
    const rejected = ["rejected", "cancelled", "refunded", "charged_back", "expired"].includes(result.status);
    return <div className={`event-registration-success event-payment-result is-${result.status}`} role="status">
      <span aria-hidden="true">{approved ? "✓" : rejected ? "!" : "…"}</span>
      <h2>{approved ? "Inscrição confirmada" : rejected ? "Pagamento não aprovado" : result.paymentMethodId === "pix" ? "Pix gerado" : "Pagamento em análise"}</h2>
      <p>{approved ? result.emailSent && result.whatsappSent ? "Pagamento confirmado. Seu ingresso foi enviado para o seu e-mail e WhatsApp." : result.emailSent ? "Pagamento confirmado. Seu ingresso foi enviado para o seu e-mail." : result.whatsappSent ? "Pagamento confirmado. Seu ingresso foi enviado para o seu WhatsApp." : "Seu pagamento foi aprovado e seu ingresso está disponível abaixo." : rejected ? "O Mercado Pago não aprovou este pagamento. Confira os dados e tente novamente." : result.paymentMethodId === "pix" ? "Pague pelo QR Code ou copie o código abaixo. A vaga será confirmada automaticamente após o pagamento." : "A confirmação será atualizada automaticamente assim que o Mercado Pago concluir a análise."}</p>
      {result.qrCodeBase64 ? <Image className="pix-qr" src={`data:image/png;base64,${result.qrCodeBase64}`} width={220} height={220} unoptimized alt="QR Code Mercado Pago para pagamento da inscrição por Pix" /> : null}
      {result.qrCode ? <button className="event-copy-pix" type="button" onClick={copyPix}>{copied ? "Código Pix copiado" : "Copiar código Pix"}</button> : null}
      {!approved && !rejected && result.paymentMethodId === "pix" ? <button className="event-regenerate-pix" type="button" disabled={regenerating} onClick={regeneratePix}>{regenerating ? "Gerando novo Pix…" : "Gerar novo código Pix"}</button> : null}
      {approved && result.ticketUrl ? <a className="event-ticket-link" href={result.ticketUrl}>Abrir meu ingresso com QR</a> : null}
      {message ? <p className="payment-inline-message" role="status">{message}</p> : null}
      <small>Pagamento Mercado Pago {result.providerPaymentId}</small>
    </div>;
  }

  return <div className="event-embedded-payment">
    <header><span>Inscrição reservada</span><strong>{money.format(amountCents / 100)}</strong><p>Escolha Pix ou cartão {maxInstallments === 1 ? "em 1 vez" : `em até ${maxInstallments} vezes`}. O pagamento é processado pelo Mercado Pago dentro desta página e os dados do cartão não são armazenados pela Casa Forte.</p></header>
    <div className="embedded-payment">
      <Payment
        initialization={initialization}
        customization={{
          paymentMethods: { creditCard: "all", bankTransfer: ["pix"], maxInstallments },
          visual: { style: { theme: "default" }, hideRedirectionPanel: true },
        }}
        locale="pt-BR"
        onSubmit={submitPayment}
        onError={(error) => {
          console.error("event_mercado_pago_brick_error", error);
          setMessage("Não foi possível carregar o pagamento. Atualize a página e tente novamente.");
        }}
      />
      <p className="payment-inline-message" role="status">{message || "Pagamento protegido pelo Mercado Pago. A Casa Forte não recebe nem armazena os dados do seu cartão."}</p>
    </div>
  </div>;
}
