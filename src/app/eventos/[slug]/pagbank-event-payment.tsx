"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import Image from "next/image";
import styles from "./pagbank-event-payment.module.css";

type Result = { status: string; providerPaymentId?: string; paymentMethodId?: string; qrCode?: string; qrCodeBase64?: string; ticketUrl?: string; emailSent?: boolean; whatsappSent?: boolean };
type Sdk = { encryptCard: (data: Record<string, string>) => { hasErrors: boolean; encryptedCard?: string } };
const money = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export default function PagBankEventPayment({ slug, paymentId, amountCents, fullName, maxInstallments = 4 }: { slug: string; paymentId: string; amountCents: number; fullName: string; maxInstallments?: number }) {
  const [activeId, setActiveId] = useState(paymentId);
  const [method, setMethod] = useState<"pix" | "card">("pix");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const endpoint = `/api/eventos/${encodeURIComponent(slug)}/pagamento`;
  const query = useCallback(async () => {
    const response = await fetch(`${endpoint}?paymentId=${encodeURIComponent(activeId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível consultar o pagamento.");
    if (data.providerPaymentId || data.status === "approved") setResult(data);
    return data;
  }, [activeId, endpoint]);

  useEffect(() => {
    let cancelled = false;
    // Resume an existing charge before showing controls to create one.
    async function refresh() {
      try { await query(); }
      catch { if (!cancelled) setMessage("Não foi possível consultar agora. Use Verificar pagamento antes de pagar novamente."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void refresh();
    if (result?.status && !["pending", "in_process", "created"].includes(result.status)) return () => { cancelled = true; };
    const timer = window.setInterval(() => { if (!document.hidden && !lock.current) void refresh(); }, 8000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [query, result?.status]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      let encryptedCard: string | undefined;
      const holder = String(fields.get("holder") || fullName);
      if (method === "card") {
        const sdk = (window as Window & { PagSeguro?: Sdk }).PagSeguro;
        if (!sdk) throw new Error("Aguarde o carregamento seguro do cartão.");
        const response = await fetch("/api/pagbank/public-key");
        const data = await response.json();
        if (!response.ok || !data.publicKey) throw new Error("Não foi possível iniciar o cartão. Tente novamente.");
        const encrypted = sdk.encryptCard({ publicKey: data.publicKey, holder, number: String(fields.get("number")).replace(/\D/g, ""), expMonth: String(fields.get("month")), expYear: String(fields.get("year")), securityCode: String(fields.get("cvv")) });
        if (encrypted.hasErrors || !encrypted.encryptedCard) throw new Error("Confira os dados do cartão.");
        encryptedCard = encrypted.encryptedCard;
      }
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: activeId, method, taxId: fields.get("cpf"), cardHolder: holder, installments: Number(fields.get("installments") || 1), encryptedCard }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir o pagamento.");
      setResult(data); form.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível concluir agora."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function verify() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try { await query(); } catch (error) { setMessage(error instanceof Error ? error.message : "Consulta indisponível."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function retry() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/eventos/${encodeURIComponent(slug)}/refazer-pix`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId: activeId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível refazer o pagamento.");
      if (data.providerPaymentId) setResult(data);
      else { setActiveId(data.paymentId); setResult(null); setCopied(false); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível refazer o pagamento."); }
    finally { lock.current = false; setBusy(false); }
  }

  const approved = result?.status === "approved";
  const retryable = result && ["rejected", "cancelled", "expired"].includes(result.status);
  return <section className={styles.checkout} aria-label="Pagamento do evento pelo PagBank">
    <Script src="https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js" onReady={() => setSdkReady(true)} onError={() => setMessage("Não foi possível carregar o cartão. O Pix continua disponível.")} />
    <header><span>PAGAMENTO DO EVENTO · PAGBANK</span><h2>{approved ? "Inscrição confirmada" : "Conclua sua inscrição"}</h2><strong>{money(amountCents)}</strong><p>Pix ou cartão {maxInstallments === 1 ? "em 1 vez" : `em até ${maxInstallments} vezes`}, sem sair do site.</p></header>
    {loading ? <p role="status">Verificando sua inscrição…</p> : result ? <div role="status">
      <h3>{approved ? "Pagamento confirmado!" : retryable ? "Pagamento não concluído" : ["refunded", "charged_back"].includes(result.status) ? "Pagamento estornado" : result.paymentMethodId === "pix" ? "Aguardando o Pix" : "Pagamento em análise"}</h3>
      <p>{approved ? result.emailSent && result.whatsappSent ? "Seu ingresso foi enviado para seu e-mail e WhatsApp." : result.emailSent ? "Seu ingresso foi enviado para seu e-mail." : result.whatsappSent ? "Seu ingresso foi enviado para seu WhatsApp." : "Sua inscrição foi confirmada. Acesse seu ingresso abaixo." : retryable ? "Você pode tentar novamente abaixo." : "A confirmação aparecerá automaticamente nesta página. Não pague novamente se o valor já foi debitado."}</p>
      {!approved && !retryable && result.status === "pending" && result.qrCode ? <>
        {result.qrCodeBase64 && <Image src={`data:image/png;base64,${result.qrCodeBase64}`} width={240} height={240} unoptimized alt="QR Code Pix do evento pelo PagBank" />}
        <label>Pix copia e cola<textarea readOnly rows={3} value={result.qrCode} /></label>
        <button onClick={async () => { try { await navigator.clipboard.writeText(result.qrCode!); setCopied(true); } catch { setMessage("Selecione e copie o código acima."); } }}>{copied ? "Pix copiado" : "Copiar código Pix"}</button>
        <p className={styles.note}>Código válido por até 24 horas. Após vencer, você poderá gerar outro aqui.</p>
      </> : null}
      {approved && result.ticketUrl && <a className={styles.ticket} href={result.ticketUrl}>Abrir meu ingresso com QR Code</a>}
      {retryable && <button disabled={busy} onClick={retry}>{busy ? "Verificando…" : "Refazer pagamento / novo Pix"}</button>}
    </div> : <>
      <div className={styles.tabs} aria-label="Forma de pagamento"><button disabled={busy} aria-pressed={method === "pix"} onClick={() => setMethod("pix")}>Pix</button><button disabled={busy} aria-pressed={method === "card"} onClick={() => setMethod("card")}>Cartão de crédito</button></div>
      <form key={method} onSubmit={submit} autoComplete="off">
        <label>CPF do pagador<input name="cpf" required inputMode="numeric" maxLength={14} placeholder="000.000.000-00" /></label>
        {method === "card" && <>
          <label>Nome no cartão<input name="holder" defaultValue={fullName} autoComplete="cc-name" required maxLength={100} /></label>
          <label>Número do cartão<input name="number" autoComplete="cc-number" inputMode="numeric" required maxLength={23} /></label>
          <div className={styles.fields}><label>Mês<input name="month" inputMode="numeric" autoComplete="cc-exp-month" pattern="0?[1-9]|1[0-2]" placeholder="MM" required maxLength={2} /></label><label>Ano<input name="year" inputMode="numeric" autoComplete="cc-exp-year" pattern="20[0-9]{2}" placeholder="AAAA" required maxLength={4} /></label><label>CVV<input name="cvv" type="password" inputMode="numeric" autoComplete="cc-csc" pattern="[0-9]{3,4}" required maxLength={4} /></label></div>
          <label>Parcelas<select name="installments">{Array.from({ length: maxInstallments }, (_, i) => <option key={i} value={i + 1}>{i + 1}x · total {money(amountCents)}</option>)}</select></label>
        </>}
        <p className={styles.note}>CPF enviado somente ao PagBank para o pagamento. Cartão criptografado no navegador; número e CVV não ficam salvos na Casa.</p>
        <button disabled={busy || (method === "card" && !sdkReady)} type="submit">{busy ? "Aguarde, não feche esta página…" : method === "pix" ? `Gerar Pix · ${money(amountCents)}` : `Pagar com cartão · ${money(amountCents)}`}</button>
      </form>
    </>}
    {!approved && <button className={styles.secondary} disabled={busy || loading} onClick={verify}>Já paguei · verificar pagamento</button>}
    {message && <p role="alert">{message}</p>}
  </section>;
}
