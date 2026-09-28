"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import Script from "next/script";
import Link from "next/link";
import styles from "./validation.module.css";

type Method = "pix" | "card";
type Result = { method: Method; orderId: string; chargeId: string; amountCents: number; status: string; pixCode: string; http: number; checkedAt: string; paidCents: number };
type Sdk = { encryptCard: (input: Record<string, string>) => { hasErrors: boolean; encryptedCard?: string } };
const key = (method: Method) => `casa-pagbank-validacao-20260928-${method}`;
const subscribe = (callback: () => void) => { window.addEventListener("storage", callback); return () => window.removeEventListener("storage", callback); };
function storedSnapshot() { try { return JSON.stringify([localStorage.getItem(key("pix")), localStorage.getItem(key("card"))]); } catch { return "[]"; } }
const serverSnapshot = () => "[]";

export default function PagBankValidation() {
  const [method, setMethod] = useState<Method>("pix");
  const [results, setResults] = useState<Partial<Record<Method, Result>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sdkReady, setSdkReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const savedJson = useSyncExternalStore(subscribe, storedSnapshot, serverSnapshot);
  const savedResults = useMemo(() => {
    try {
      const saved: Partial<Record<Method, Result>> = {};
      const values = JSON.parse(savedJson);
      for (const [index, m] of (["pix", "card"] as const).entries()) {
        const raw = values[index];
        if (raw) { const parsed = JSON.parse(raw); if (parsed.method === m && typeof parsed.orderId === "string") saved[m] = parsed; }
      }
      return saved;
    } catch { return {}; }
  }, [savedJson]);
  const allResults = { ...savedResults, ...results };
  const result = allResults[method];

  async function call(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/pagbank/validacao", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Falha na validação.");
    setResults(previous => ({ ...previous, [data.method]: data }));
    try { localStorage.setItem(key(data.method), JSON.stringify(data)); } catch { /* Result remains visible. */ }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      let encryptedCard: string | undefined;
      const holder = String(values.get("holder") || "");
      if (method === "card") {
        const sdk = (window as Window & { PagSeguro?: Sdk }).PagSeguro;
        if (!sdk) throw new Error("Aguarde o carregamento seguro do cartão.");
        const response = await fetch("/api/pagbank/public-key", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.publicKey) throw new Error("Chave de criptografia indisponível.");
        const encrypted = sdk.encryptCard({ publicKey: data.publicKey, holder, number: String(values.get("number")).replace(/\D/g, ""), expMonth: String(values.get("month")), expYear: String(values.get("year")), securityCode: String(values.get("cvv")) });
        if (encrypted.hasErrors || !encrypted.encryptedCard) throw new Error("Confira os dados do cartão.");
        encryptedCard = encrypted.encryptedCard;
      }
      await call({ action: "create", method, taxId: values.get("cpf"), accepted: values.get("accepted") === "on", holder, encryptedCard });
      form.reset();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha na solicitação."); }
    finally { lock.current = false; setBusy(false); }
  }

  async function query() {
    if (!result || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await call({ action: "query", method, orderId: result.orderId }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Consulta indisponível."); }
    finally { lock.current = false; setBusy(false); }
  }

  function downloadLogs() {
    const blob = new Blob([JSON.stringify(allResults, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "pagbank-validacao-producao-2026-09-28.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <main className={styles.page}>
    <Script src="https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js" onReady={() => setSdkReady(true)} onError={() => setError("Não foi possível carregar o sistema de criptografia do cartão.")} />
    <Link href="/admin">← Voltar ao painel</Link>
    <header><p className={styles.eyebrow}>ACESSO PRIVADO · PRODUÇÃO</p><h1>Validar PagBank</h1><p>Dois testes reais de <strong>R$ 1,00 cada</strong>: Pix e cartão de crédito em 1x.</p><p>O valor vai para a conta da igreja. Não cria ingresso e não entra como venda de evento no site. Pode haver tarifa do PagBank.</p></header>
    <div className={styles.tabs} aria-label="Meio de pagamento">
      <button disabled={busy} aria-pressed={method === "pix"} onClick={() => { setMethod("pix"); setError(""); }}>1. Pix · R$ 1,00</button>
      <button disabled={busy} aria-pressed={method === "card"} onClick={() => { setMethod("card"); setError(""); }}>2. Cartão · R$ 1,00</button>
    </div>
    {result ? <section className={styles.card} aria-label="Resultado do teste">
      <h2>{result.status === "PAID" && result.paidCents === 100 ? "Pagamento confirmado pelo PagBank" : result.status === "WAITING" ? "Aguardando pagamento" : `Situação: ${result.status}`}</h2>
      <p>{method === "pix" ? "Pix" : "Cartão"} · R$ 1,00</p>
      {method === "pix" && result.status === "WAITING" && result.pixCode ? <>
        <label>Pix copia e cola<textarea readOnly rows={5} value={result.pixCode} /></label>
        <button onClick={async () => { try { await navigator.clipboard.writeText(result.pixCode); setCopied(true); } catch { setError("Selecione e copie o código acima."); } }}>{copied ? "Código copiado" : "Copiar Pix de R$ 1,00"}</button>
      </> : null}
      <button disabled={busy} onClick={query}>{busy ? "Consultando…" : "Já paguei · verificar pagamento"}</button>
      <p className={styles.small}>Pedido: {result.orderId}<br />Cobrança: {result.chargeId}</p>
    </section> : <form key={method} className={styles.card} onSubmit={submit} autoComplete="off">
      <h2>{method === "pix" ? "Gerar Pix de teste" : "Pagar com cartão de crédito"}</h2>
      <label>CPF do pagador<input name="cpf" inputMode="numeric" required maxLength={14} placeholder="000.000.000-00" /></label>
      {method === "card" ? <>
        <label>Nome impresso no cartão<input name="holder" required autoComplete="cc-name" maxLength={100} /></label>
        <label>Número do cartão<input name="number" inputMode="numeric" required autoComplete="cc-number" maxLength={23} /></label>
        <div className={styles.fields}><label>Mês<input name="month" inputMode="numeric" placeholder="MM" pattern="0?[1-9]|1[0-2]" required maxLength={2} autoComplete="cc-exp-month" /></label><label>Ano<input name="year" inputMode="numeric" placeholder="AAAA" pattern="20[0-9]{2}" required maxLength={4} autoComplete="cc-exp-year" /></label><label>CVV<input type="password" name="cvv" inputMode="numeric" pattern="[0-9]{3,4}" required maxLength={4} autoComplete="cc-csc" /></label></div>
        <p className={styles.small}>O cartão é criptografado no navegador pelo SDK do PagBank. Não salvamos número, CVV ou CPF no site. Use um cartão real; cartões fictícios são exclusivos do Sandbox.</p>
      </> : <p className={styles.small}>O CPF é enviado somente para gerar a cobrança no PagBank e não fica salvo no site.</p>}
      <label className={styles.check}><input name="accepted" type="checkbox" required />Autorizo {method === "pix" ? "gerar a cobrança Pix" : "o pagamento real no cartão"} de R$ 1,00 para testar o PagBank.</label>
      <button type="submit" disabled={busy || (method === "card" && !sdkReady)}>{busy ? "Aguarde, não feche esta página…" : method === "pix" ? "Gerar Pix de R$ 1,00" : "Pagar R$ 1,00 em 1x"}</button>
    </form>}
    {error && <p className={styles.error} role="alert">{error}</p>}
    {Object.keys(allResults).length > 0 && <button className={styles.secondary} onClick={downloadLogs}>Baixar registros técnicos sem dados sensíveis</button>}
    <p className={styles.small}>Homologação concluída em 28/09/2026. Novos pagamentos de eventos usam PagBank. Primícias, dízimos e ofertas permanecem no Mercado Pago.</p>
  </main>;
}
