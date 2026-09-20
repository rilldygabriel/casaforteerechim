"use client";

import { useState } from "react";
import Image from "next/image";

type TestResult = {
  amountCents: number;
  providerOrderId: string;
  providerPaymentId: string;
  pixQrCode: string;
  pixQrCodeBase64?: string;
  expiresInHours: number;
};

export default function PagBankTestClient() {
  const [taxId, setTaxId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/pagbank/test-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taxId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Não foi possível gerar o Pix.");
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o Pix.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ display: "grid", gap: 24, maxWidth: 760, margin: "40px auto", padding: 24 }}>
      <header>
        <p>VERIFICAÇÃO DE PRODUÇÃO</p>
        <h1>Teste Pix PagBank</h1>
        <p>Gera uma cobrança real e não paga de 1 hambúrguer simples por R$ 20,00. O CPF não é armazenado.</p>
      </header>
      <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
        <label style={{ display: "grid", gap: 8 }}>
          CPF do pagador
          <input
            aria-label="CPF do pagador"
            autoComplete="off"
            inputMode="numeric"
            maxLength={14}
            onChange={(event) => setTaxId(event.target.value)}
            placeholder="000.000.000-00"
            required
            value={taxId}
          />
        </label>
        <button disabled={loading} type="submit">{loading ? "GERANDO PIX…" : "GERAR PIX DE R$ 20,00"}</button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {result ? (
        <article aria-label="Pix PagBank gerado" style={{ display: "grid", gap: 16 }}>
          <h2>Pix criado pelo PagBank</h2>
          {result.pixQrCodeBase64 ? <Image alt="QR Code Pix PagBank" height={260} src={`data:image/png;base64,${result.pixQrCodeBase64}`} unoptimized width={260} /> : null}
          <label style={{ display: "grid", gap: 8 }}>
            Pix copia e cola
            <textarea aria-label="Pix copia e cola" readOnly rows={7} value={result.pixQrCode} />
          </label>
          <p>Pedido: {result.providerOrderId}</p>
          <p>Cobrança: {result.providerPaymentId}</p>
          <p>Expira em {result.expiresInHours} horas se não for pago.</p>
        </article>
      ) : null}
    </section>
  );
}
