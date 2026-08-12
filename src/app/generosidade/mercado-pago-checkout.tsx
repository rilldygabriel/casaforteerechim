"use client";

import { useState } from "react";

const PURPOSES = [
  ["tithe", "Dízimo"],
  ["offering", "Oferta"],
  ["firstfruits", "Oferta de primícias"],
] as const;

export default function MercadoPagoCheckout({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

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
          purpose: form.get("purpose"),
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          amount: form.get("amount"),
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
    <div><p className="section-eyebrow"><span aria-hidden="true" />Pagamento online</p><h2>Contribua com Pix ou cartão</h2><p>Escolha a finalidade e o valor. O pagamento é processado no ambiente protegido do Mercado Pago.</p></div>
    <form onSubmit={submit}>
      <label>Finalidade<select name="purpose" required>{PURPOSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Valor<input name="amount" inputMode="decimal" placeholder="R$ 0,00" required /></label>
      <label>Seu nome<input name="name" autoComplete="name" minLength={2} maxLength={160} required /></label>
      <label>E-mail <small>Opcional</small><input name="email" type="email" autoComplete="email" /></label>
      <label className="wide">WhatsApp <small>Opcional</small><input name="phone" inputMode="tel" autoComplete="tel" placeholder="(54) 99999-9999" /></label>
      <button className="wide" type="submit" disabled={!configured || busy}>{configured ? busy ? "Abrindo…" : "Pagar com Mercado Pago" : "Mercado Pago em ativação"}</button>
      <p className="wide" role="status">{message || "Pix, cartão de crédito, saldo Mercado Pago e demais opções disponíveis na sua conta."}</p>
    </form>
  </section>;
}
