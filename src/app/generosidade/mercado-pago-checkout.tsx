"use client";

import { useState } from "react";

function cents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function MercadoPagoCheckout({ configured, defaultName = "" }: { configured: boolean; defaultName?: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [values, setValues] = useState({ tithe: "", firstfruits: "", offering: "" });
  const totalCents = cents(values.tithe) + cents(values.firstfruits) + cents(values.offering);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setMessage("Abrindo o ambiente seguro do Mercado Pago…");
    try {
      const response = await fetch("/api/pagamentos/mercado-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID(),
          name: form.get("name"),
          tithe: form.get("tithe"),
          firstfruits: form.get("firstfruits"),
          offering: form.get("offering"),
        }),
      });
      const result = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error || "Não foi possível iniciar o pagamento.");
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      setBusy(false);
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar o pagamento.");
    }
  }

  return <section className="mercado-pago-contribution">
    <div><p className="section-eyebrow"><span aria-hidden="true" />Pagamento online</p><h2>Uma contribuição, três destinações</h2><p>Informe somente os valores que desejar. Dízimo, primícias e oferta serão somados em um único Pix ou pagamento com cartão.</p></div>
    <form onSubmit={submit}>
      <div className="contribution-values wide">
        <label>Dízimo<input name="tithe" inputMode="decimal" placeholder="R$ 0,00" value={values.tithe} onChange={(event) => setValues((current) => ({ ...current, tithe: event.target.value }))} /></label>
        <label>Primícias<input name="firstfruits" inputMode="decimal" placeholder="R$ 0,00" value={values.firstfruits} onChange={(event) => setValues((current) => ({ ...current, firstfruits: event.target.value }))} /></label>
        <label>Oferta<input name="offering" inputMode="decimal" placeholder="R$ 0,00" value={values.offering} onChange={(event) => setValues((current) => ({ ...current, offering: event.target.value }))} /></label>
      </div>
      <label className="wide">Seu nome<input name="name" autoComplete="name" minLength={2} maxLength={160} defaultValue={defaultName} required /></label>
      <div className="contribution-total wide"><span>Total em um único pagamento</span><strong>{money.format(totalCents / 100)}</strong></div>
      <button className="wide" type="submit" disabled={!configured || busy || totalCents < 100}>{configured ? busy ? "Abrindo…" : "Continuar para Pix ou cartão" : "Mercado Pago em ativação"}</button>
      <p className="wide" role="status">{message || "O cartão é informado somente no Mercado Pago. Ao entrar na sua conta Mercado Pago, você pode reutilizar os meios de pagamento salvos por eles."}</p>
    </form>
  </section>;
}
