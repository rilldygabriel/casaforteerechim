"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";

const PluggyConnect = dynamic(
  () => import("react-pluggy-connect").then((module) => module.PluggyConnect),
  { ssr: false },
);

export default function OpenFinanceConnect({ configured, hasConnections }: { configured: boolean; hasConnections: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<"success" | "error">("success");

  async function beginConnection() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/financeiro/open-finance/token", { method: "POST" });
      const result = await response.json() as { ok?: boolean; accessToken?: string; message?: string };
      if (!response.ok || !result.accessToken) throw new Error(result.message || "Não foi possível abrir a conexão.");
      setToken(result.accessToken);
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível abrir a conexão.");
    } finally {
      setBusy(false);
    }
  }

  async function synchronize() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/financeiro/open-finance/sync", { method: "POST" });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok) throw new Error(result.message || "Não foi possível atualizar as contas.");
      setKind("success");
      setMessage(result.message || "Contas atualizadas.");
      router.refresh();
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar as contas.");
    } finally {
      setBusy(false);
    }
  }

  async function finishConnection(itemId: string) {
    setToken("");
    setBusy(true);
    setMessage("Conta autorizada. Buscando saldos e entradas…");
    try {
      const response = await fetch("/api/admin/financeiro/open-finance/connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const result = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok) throw new Error(result.message || "A primeira sincronização ainda não terminou.");
      setKind("success");
      setMessage(result.message || "Conta conectada.");
      router.refresh();
    } catch (error) {
      setKind("error");
      setMessage(error instanceof Error ? error.message : "A primeira sincronização ainda não terminou.");
    } finally {
      setBusy(false);
    }
  }

  if (!configured) {
    return <div className="finance-open-finance-actions"><p>A estrutura do site está pronta. Falta ativar o plano Open Finance e cadastrar as chaves privadas da Pluggy.</p><a href="https://pluggy.ai/" target="_blank" rel="noreferrer">Ativar integração na Pluggy</a></div>;
  }

  return (
    <div className="finance-open-finance-actions">
      <div className="finance-open-finance-buttons">
        <button type="button" onClick={beginConnection} disabled={busy}>+ Conectar conta bancária</button>
        {hasConnections ? <button type="button" className="secondary" onClick={synchronize} disabled={busy}>Atualizar agora</button> : null}
      </div>
      {busy ? <p>Processando com segurança…</p> : null}
      {message ? <p className={`finance-inline-message ${kind === "error" ? "error" : ""}`}>{message}</p> : null}
      {token ? <PluggyConnect connectToken={token} language="pt" theme="dark" includeSandbox={false} connectorTypes={["PERSONAL_BANK", "BUSINESS_BANK"]} products={["ACCOUNTS", "TRANSACTIONS"]} allowFullscreen forceOauthInBrowser onSuccess={({ item }) => finishConnection(item.id)} onError={({ message: errorMessage }) => { setToken(""); setKind("error"); setMessage(errorMessage || "A conexão não foi concluída."); }} onClose={() => setToken("")} /> : null}
    </div>
  );
}
