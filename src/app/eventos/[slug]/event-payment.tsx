"use client";

import Image from "next/image";
import Script from "next/script";
import { useEffect, useState } from "react";

type PaymentResult = {
  providerPaymentId: string;
  providerOrderId: string;
  status: "approved" | "pending" | "in_process" | "rejected" | "cancelled" | "expired";
  paymentMethodId: "pix" | "credit_card";
  qrCode?: string;
  qrCodeBase64?: string;
};

type CardEncryption = {
  encryptedCard: string;
  hasErrors: boolean;
  errors?: Array<{ code?: string; message?: string }>;
};

declare global {
  interface Window {
    PagSeguro?: {
      encryptCard(input: { publicKey: string; holder: string; number: string; expMonth: string; expYear: string; securityCode: string }): CardEncryption;
    };
  }
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const EMPTY_CARD = { holder: "", number: "", expMonth: "", expYear: "", securityCode: "", installments: "1" };

export default function EventPayment({ slug, paymentId, amountCents, fullName }: { slug: string; paymentId: string; amountCents: number; fullName: string }) {
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [taxId, setTaxId] = useState("");
  const [card, setCard] = useState({ ...EMPTY_CARD, holder: fullName });
  const [sdkReady, setSdkReady] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/pagbank/public-key", { cache: "force-cache" })
      .then(async (response) => {
        const payload = await response.json() as { publicKey?: string; error?: string };
        if (!response.ok || !payload.publicKey) throw new Error(payload.error || "Chave pública indisponível.");
        if (active) setPublicKey(payload.publicKey);
      })
      .catch(() => {
        if (active) setMessage("O pagamento seguro PagBank ainda está carregando. Tente novamente em instantes.");
      });
    return () => { active = false; };
  }, []);

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{11}$/.test(taxId.replace(/\D/g, ""))) {
      setMessage("Informe os 11 números do CPF.");
      return;
    }
    let encryptedCard = "";
    if (method === "card") {
      if (!sdkReady || !publicKey || !window.PagSeguro) {
        setMessage("O pagamento seguro ainda está carregando. Aguarde um instante.");
        return;
      }
      const encrypted = window.PagSeguro.encryptCard({ publicKey, holder: card.holder, number: card.number.replace(/\D/g, ""), expMonth: card.expMonth, expYear: card.expYear, securityCode: card.securityCode });
      if (encrypted.hasErrors || !encrypted.encryptedCard) {
        setMessage("Confira número, validade, nome e código de segurança do cartão.");
        return;
      }
      encryptedCard = encrypted.encryptedCard;
    }
    setSubmitting(true);
    setMessage("Processando com segurança pelo PagBank…");
    try {
      const response = await fetch(`/api/eventos/${encodeURIComponent(slug)}/pagamento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId, method, taxId, encryptedCard, cardHolder: card.holder, installments: Number(card.installments) }),
      });
      const payload = await response.json() as PaymentResult & { error?: string };
      if (!response.ok || !payload.providerPaymentId) {
        setMessage(payload.error || "Não foi possível processar o pagamento.");
        return;
      }
      setResult(payload);
      setMessage("");
    } catch {
      setMessage("Sem conexão com o PagBank agora. Tente novamente em instantes.");
    } finally {
      setSubmitting(false);
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
    const rejected = ["rejected", "cancelled", "expired"].includes(result.status);
    return <div className={`event-registration-success event-payment-result is-${result.status}`} role="status">
      <span aria-hidden="true">{approved ? "✓" : rejected ? "!" : "…"}</span>
      <h2>{approved ? "Inscrição confirmada" : rejected ? "Pagamento não aprovado" : result.paymentMethodId === "pix" ? "Pix gerado" : "Pagamento em análise"}</h2>
      <p>{approved ? "Seu pagamento foi aprovado e sua vaga está confirmada." : rejected ? "O PagBank não aprovou este pagamento. Confira os dados e tente novamente." : result.paymentMethodId === "pix" ? "Pague pelo QR Code ou copie o código abaixo. A vaga será confirmada automaticamente após o pagamento." : "A confirmação será atualizada automaticamente assim que o PagBank concluir a análise."}</p>
      {result.qrCodeBase64 ? <Image className="pix-qr" src={`data:image/png;base64,${result.qrCodeBase64}`} width={220} height={220} unoptimized alt="QR Code PagBank para pagamento da inscrição por Pix" /> : null}
      {result.qrCode ? <button className="event-copy-pix" type="button" onClick={copyPix}>{copied ? "Código Pix copiado" : "Copiar código Pix"}</button> : null}
      <small>Pagamento PagBank {result.providerPaymentId}</small>
    </div>;
  }

  return <div className="event-embedded-payment">
    <Script src="https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js" strategy="afterInteractive" onLoad={() => setSdkReady(true)} onError={() => setMessage("Não foi possível carregar a proteção do cartão PagBank.")} />
    <header><span>Inscrição reservada</span><strong>{money.format(amountCents / 100)}</strong><p>Escolha Pix ou cartão em até 4 vezes. O pagamento é processado pelo PagBank e os dados do cartão não são armazenados pela Casa Forte.</p></header>
    <form className="event-pagbank-payment" onSubmit={submitPayment}>
      <div className="event-payment-methods" role="group" aria-label="Forma de pagamento">
        <button type="button" data-active={method === "pix"} onClick={() => setMethod("pix")}>Pix</button>
        <button type="button" data-active={method === "card"} onClick={() => setMethod("card")}>Cartão</button>
      </div>
      <label>CPF do participante<input required inputMode="numeric" autoComplete="off" maxLength={14} placeholder="000.000.000-00" value={taxId} onChange={(event) => setTaxId(event.target.value)} /></label>
      {method === "card" ? <div className="event-card-fields">
        <label className="wide">Nome impresso no cartão<input required autoComplete="cc-name" value={card.holder} onChange={(event) => setCard({ ...card, holder: event.target.value })} /></label>
        <label className="wide">Número do cartão<input required inputMode="numeric" autoComplete="cc-number" maxLength={23} value={card.number} onChange={(event) => setCard({ ...card, number: event.target.value })} /></label>
        <label>Mês<input required inputMode="numeric" autoComplete="cc-exp-month" maxLength={2} placeholder="MM" value={card.expMonth} onChange={(event) => setCard({ ...card, expMonth: event.target.value.replace(/\D/g, "") })} /></label>
        <label>Ano<input required inputMode="numeric" autoComplete="cc-exp-year" maxLength={4} placeholder="AAAA" value={card.expYear} onChange={(event) => setCard({ ...card, expYear: event.target.value.replace(/\D/g, "") })} /></label>
        <label>Código de segurança<input required inputMode="numeric" autoComplete="cc-csc" maxLength={4} value={card.securityCode} onChange={(event) => setCard({ ...card, securityCode: event.target.value.replace(/\D/g, "") })} /></label>
        <label>Parcelas<select value={card.installments} onChange={(event) => setCard({ ...card, installments: event.target.value })}>{[1, 2, 3, 4].map((quantity) => <option key={quantity} value={quantity}>{quantity}x de {money.format(amountCents / quantity / 100)}</option>)}</select></label>
      </div> : null}
      <button className="event-pay-button" type="submit" disabled={submitting || (method === "card" && (!sdkReady || !publicKey))}>{submitting ? "Processando…" : method === "pix" ? "Gerar Pix PagBank" : "Pagar com cartão"}</button>
      <p className="payment-inline-message" role="status">{message || "Pagamento protegido pelo PagBank. A Casa Forte não recebe nem armazena os dados do cartão."}</p>
    </form>
  </div>;
}
