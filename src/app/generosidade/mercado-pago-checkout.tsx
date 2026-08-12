"use client";

import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";

function cents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

type AllocationValues = { tithe: string; firstfruits: string; offering: string };
type PaymentDraft = AllocationValues & { requestId: string; name: string; totalCents: number };
type BrickSubmission = Parameters<NonNullable<ComponentProps<typeof Payment>["onSubmit"]>>[0];
type PaymentResult = {
  providerPaymentId: string;
  status: "approved" | "pending" | "rejected" | "cancelled" | "refunded";
  statusDetail?: string;
  paymentMethodId: string;
  qrCode?: string;
  qrCodeBase64?: string;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function resultCopy(result: PaymentResult) {
  if (result.status === "approved") return { icon: "✓", title: "Contribuição confirmada", text: "O pagamento foi aprovado e já está sendo identificado no painel financeiro." };
  if (result.status === "rejected") return { icon: "!", title: "Pagamento não aprovado", text: "Confira os dados ou escolha outra forma de pagamento e tente novamente." };
  return { icon: "…", title: result.paymentMethodId === "pix" ? "Pix gerado" : "Pagamento em análise", text: result.paymentMethodId === "pix" ? "Escaneie o QR Code ou copie o código Pix abaixo. Esta página pode permanecer aberta." : "O Mercado Pago está analisando o pagamento. A confirmação será atualizada automaticamente." };
}

export default function MercadoPagoCheckout({ configured, publicKey, defaultName = "", defaultEmail = "" }: { configured: boolean; publicKey: string; defaultName?: string; defaultEmail?: string }) {
  const [values, setValues] = useState<AllocationValues>({ tithe: "", firstfruits: "", offering: "" });
  const [name, setName] = useState(defaultName);
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const totalCents = cents(values.tithe) + cents(values.firstfruits) + cents(values.offering);

  useEffect(() => {
    if (publicKey) initMercadoPago(publicKey, { locale: "pt-BR", advancedFraudPrevention: true });
  }, [publicKey]);

  const initialization = useMemo(() => draft ? {
    amount: draft.totalCents / 100,
    payer: {
      email: defaultEmail || undefined,
      firstName: draft.name.trim().split(/\s+/)[0] || undefined,
      lastName: draft.name.trim().split(/\s+/).slice(1).join(" ") || undefined,
    },
  } : null, [defaultEmail, draft]);

  function choosePayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!configured || !publicKey) return;
    if (totalCents < 100) return setMessage("Informe pelo menos R$ 1,00 em uma das destinações.");
    if (name.trim().length < 2) return setMessage("Informe seu nome.");
    setDraft({ ...values, requestId: crypto.randomUUID(), name: name.trim(), totalCents });
  }

  async function submitPayment(submission: BrickSubmission) {
    if (!draft) throw new Error("Pagamento não iniciado.");
    setMessage("Processando com segurança…");
    const response = await fetch("/api/pagamentos/mercado-pago", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: draft.requestId,
        name: draft.name,
        tithe: draft.tithe,
        firstfruits: draft.firstfruits,
        offering: draft.offering,
        formData: submission.formData,
      }),
    });
    const payload = await response.json() as PaymentResult & { error?: string };
    if (!response.ok || !payload.providerPaymentId) {
      setMessage(payload.error || "Não foi possível processar o pagamento.");
      throw new Error(payload.error || "Não foi possível processar o pagamento.");
    }
    setResult(payload);
    setMessage("");
    document.querySelector(".mercado-pago-contribution")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function copyPix() {
    if (!result?.qrCode) return;
    await navigator.clipboard.writeText(result.qrCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  function restart() {
    setDraft(null);
    setResult(null);
    setMessage("");
    setCopied(false);
  }

  const summary = draft || { ...values, totalCents, name, requestId: "" };
  const copy = result ? resultCopy(result) : null;

  return <section className="mercado-pago-contribution">
    <div><p className="section-eyebrow"><span aria-hidden="true" />Pagamento online</p><h2>Primícia, dízimo e ofertas</h2><p>Informe somente os valores que desejar. Primícia, dízimo e oferta serão somados em um único Pix ou pagamento com cartão, sem sair do site.</p></div>
    {!draft ? <form onSubmit={choosePayment}>
      <div className="contribution-values wide">
        <label>Primícia<input name="firstfruits" inputMode="decimal" placeholder="R$ 0,00" value={values.firstfruits} onChange={(event) => setValues((current) => ({ ...current, firstfruits: event.target.value }))} /></label>
        <label>Dízimo<input name="tithe" inputMode="decimal" placeholder="R$ 0,00" value={values.tithe} onChange={(event) => setValues((current) => ({ ...current, tithe: event.target.value }))} /></label>
        <label>Oferta<input name="offering" inputMode="decimal" placeholder="R$ 0,00" value={values.offering} onChange={(event) => setValues((current) => ({ ...current, offering: event.target.value }))} /></label>
      </div>
      <label className="wide">Seu nome<input name="name" autoComplete="name" minLength={2} maxLength={160} value={name} onChange={(event) => setName(event.target.value)} required /></label>
      <div className="contribution-total wide"><span>Total em um único pagamento</span><strong>{money.format(totalCents / 100)}</strong></div>
      <button className="wide" type="submit" disabled={!configured || totalCents < 100}>{configured ? "Escolher Pix ou cartão" : "Mercado Pago em ativação"}</button>
      <p className="wide" role="status">{message || "Na próxima etapa, o Mercado Pago protege os dados do cartão e gera o Pix dentro desta página."}</p>
    </form> : result && copy ? <div className={`embedded-payment-result is-${result.status}`}>
      <span className="payment-result-icon" aria-hidden="true">{copy.icon}</span>
      <h3>{copy.title}</h3>
      <p>{copy.text}</p>
      {result.qrCodeBase64 ? <img className="pix-qr" src={`data:image/png;base64,${result.qrCodeBase64}`} width="220" height="220" alt="QR Code para pagar a contribuição por Pix" /> : null}
      {result.qrCode ? <button type="button" onClick={copyPix}>{copied ? "Código Pix copiado" : "Copiar código Pix"}</button> : null}
      <small>Identificação do pagamento: {result.providerPaymentId}</small>
      <button className="payment-secondary-button" type="button" onClick={restart}>Fazer outra contribuição</button>
    </div> : <div className="embedded-payment">
      <div className="embedded-payment-summary">
        <div><span>Total</span><strong>{money.format(summary.totalCents / 100)}</strong></div>
        <ul>
          {cents(summary.firstfruits) > 0 ? <li><span>Primícia</span><strong>{money.format(cents(summary.firstfruits) / 100)}</strong></li> : null}
          {cents(summary.tithe) > 0 ? <li><span>Dízimo</span><strong>{money.format(cents(summary.tithe) / 100)}</strong></li> : null}
          {cents(summary.offering) > 0 ? <li><span>Oferta</span><strong>{money.format(cents(summary.offering) / 100)}</strong></li> : null}
        </ul>
        <button className="payment-edit-button" type="button" onClick={restart}>Alterar valores</button>
      </div>
      {initialization ? <Payment
        initialization={initialization}
        customization={{
          paymentMethods: { creditCard: "all", bankTransfer: ["pix"], maxInstallments: 12 },
          visual: { style: { theme: "default" }, hideRedirectionPanel: true },
        }}
        locale="pt-BR"
        onSubmit={submitPayment}
        onError={(error) => {
          console.error("mercado_pago_brick_error", error);
          setMessage("Não foi possível carregar o pagamento. Atualize a página e tente novamente.");
        }}
      /> : null}
      <p className="payment-inline-message" role="status">{message || "Pagamento protegido pelo Mercado Pago. A Casa Forte não recebe nem armazena os dados do seu cartão."}</p>
    </div>}
  </section>;
}
