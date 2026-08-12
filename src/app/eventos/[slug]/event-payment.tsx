"use client";

import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import Image from "next/image";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";

type BrickSubmission = Parameters<NonNullable<ComponentProps<typeof Payment>["onSubmit"]>>[0];
type PaymentResult = {
  providerPaymentId: string;
  status: "approved" | "pending" | "rejected" | "cancelled" | "refunded";
  paymentMethodId: string;
  qrCode?: string;
  qrCodeBase64?: string;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function EventPayment({ slug, paymentId, amountCents, fullName, email, publicKey }: { slug: string; paymentId: string; amountCents: number; fullName: string; email: string; publicKey: string }) {
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (publicKey) initMercadoPago(publicKey, { locale: "pt-BR", advancedFraudPrevention: true });
  }, [publicKey]);

  const initialization = useMemo(() => ({
    amount: amountCents / 100,
    payer: {
      email,
      firstName: fullName.trim().split(/\s+/)[0],
      lastName: fullName.trim().split(/\s+/).slice(1).join(" ") || undefined,
    },
  }), [amountCents, email, fullName]);

  async function submitPayment(submission: BrickSubmission) {
    setMessage("Processando com segurança…");
    const response = await fetch(`/api/eventos/${encodeURIComponent(slug)}/pagamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId, formData: submission.formData }),
    });
    const payload = await response.json() as PaymentResult & { error?: string };
    if (!response.ok || !payload.providerPaymentId) {
      setMessage(payload.error || "Não foi possível processar o pagamento.");
      throw new Error(payload.error || "Não foi possível processar o pagamento.");
    }
    setResult(payload);
    setMessage("");
  }

  async function copyPix() {
    if (!result?.qrCode) return;
    await navigator.clipboard.writeText(result.qrCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  if (result) {
    const approved = result.status === "approved";
    const rejected = result.status === "rejected";
    return <div className={`event-registration-success event-payment-result is-${result.status}`} role="status">
      <span aria-hidden="true">{approved ? "✓" : rejected ? "!" : "…"}</span>
      <h2>{approved ? "Inscrição confirmada" : rejected ? "Pagamento não aprovado" : result.paymentMethodId === "pix" ? "Pix gerado" : "Pagamento em análise"}</h2>
      <p>{approved ? "Seu pagamento foi aprovado e sua vaga está confirmada." : rejected ? "O Mercado Pago não aprovou este pagamento. Confira os dados e tente novamente mais tarde." : result.paymentMethodId === "pix" ? "Pague pelo QR Code ou copie o código abaixo. A vaga será confirmada automaticamente após o pagamento." : "A confirmação será atualizada automaticamente assim que o Mercado Pago concluir a análise."}</p>
      {result.qrCodeBase64 ? <Image className="pix-qr" src={`data:image/png;base64,${result.qrCodeBase64}`} width={220} height={220} unoptimized alt="QR Code para pagamento da inscrição por Pix" /> : null}
      {result.qrCode ? <button className="event-copy-pix" type="button" onClick={copyPix}>{copied ? "Código Pix copiado" : "Copiar código Pix"}</button> : null}
      <small>Pagamento {result.providerPaymentId}</small>
    </div>;
  }

  return <div className="event-embedded-payment">
    <header><span>Inscrição reservada</span><strong>{money.format(amountCents / 100)}</strong><p>Escolha Pix ou cartão. No cartão, parcele em até 4 vezes; o Mercado Pago mostrará eventuais acréscimos antes da confirmação.</p></header>
    <div className="embedded-payment">
      <Payment
        initialization={initialization}
        customization={{
          paymentMethods: { creditCard: "all", bankTransfer: ["pix"], maxInstallments: 4 },
          visual: { style: { theme: "default" }, hideRedirectionPanel: true },
        }}
        locale="pt-BR"
        onSubmit={submitPayment}
        onError={(error) => {
          console.error("event_payment_brick_error", error);
          setMessage("Não foi possível carregar o pagamento. Atualize a página e tente novamente.");
        }}
      />
      <p className="payment-inline-message" role="status">{message || "Pagamento protegido pelo Mercado Pago. A Casa Forte não recebe os dados do seu cartão."}</p>
    </div>
  </div>;
}
