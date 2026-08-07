"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveStatementEntries, type StatementSaveState } from "./actions";

type Entry = { transactionDate: string; description: string; amountCents: number };
type Analysis = { importId: string; entries: Entry[]; periodStart: string | null; periodEnd: string | null };

const initialState: StatementSaveState = { kind: "idle", message: "" };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function StatementAnalyzer() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saveState, saveAction, saving] = useActionState(saveStatementEntries, initialState);
  const selectedEntries = useMemo(
    () => analysis?.entries.filter((_, index) => selected.has(index)) ?? [],
    [analysis, selected],
  );

  useEffect(() => {
    if (saveState.kind === "success") router.refresh();
  }, [router, saveState]);

  async function analyze(formData: FormData) {
    setLoading(true);
    setMessage("");
    setAnalysis(null);
    try {
      const response = await fetch("/api/admin/financeiro/analisar-extrato", { method: "POST", body: formData });
      const result = await response.json() as { ok?: boolean; message?: string } & Partial<Analysis>;
      if (!response.ok || !result.importId || !result.entries) throw new Error(result.message || "Não foi possível analisar.");
      const next = { importId: result.importId, entries: result.entries, periodStart: result.periodStart ?? null, periodEnd: result.periodEnd ?? null };
      setAnalysis(next);
      setSelected(new Set(next.entries.map((_, index) => index)));
      setMessage(result.message || "Análise concluída.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível analisar o extrato.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="finance-statement-panel">
      <div>
        <span>Leitura inteligente</span>
        <h2>Analisar foto do extrato</h2>
        <p>A imagem é lida para encontrar somente entradas novas. Você confere tudo antes de salvar.</p>
      </div>
      <form action={analyze} className="finance-statement-upload">
        <label>
          Foto do extrato
          <input name="statement" type="file" accept="image/jpeg,image/png,image/webp" required />
        </label>
        <button type="submit" disabled={loading}>{loading ? "Analisando…" : "Analisar extrato"}</button>
      </form>
      {message ? <p className="finance-inline-message">{message}</p> : null}
      {analysis ? (
        <form action={saveAction} className="finance-analysis-review">
          <input type="hidden" name="importId" value={analysis.importId} />
          <input type="hidden" name="entries" value={JSON.stringify(selectedEntries)} />
          <header>
            <div><span>Conferência obrigatória</span><h3>{analysis.entries.length} entrada(s) nova(s)</h3></div>
            {(analysis.periodStart || analysis.periodEnd) ? <small>Período: {analysis.periodStart || "?"} até {analysis.periodEnd || "?"}</small> : null}
          </header>
          {analysis.entries.length ? (
            <div className="finance-analysis-entries">
              {analysis.entries.map((entry, index) => (
                <label key={`${entry.transactionDate}-${entry.amountCents}-${index}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(index)}
                    onChange={() => setSelected((current) => {
                      const next = new Set(current);
                      if (next.has(index)) next.delete(index); else next.add(index);
                      return next;
                    })}
                  />
                  <span><strong>{entry.description}</strong><small>{entry.transactionDate}</small></span>
                  <b>{currency.format(entry.amountCents / 100)}</b>
                </label>
              ))}
            </div>
          ) : <p>Nenhuma entrada nova foi encontrada nessa imagem.</p>}
          {saveState.message ? <p className={`finance-inline-message ${saveState.kind}`}>{saveState.message}</p> : null}
          {analysis.entries.length ? <button type="submit" disabled={saving || selectedEntries.length === 0}>{saving ? "Salvando…" : `Confirmar ${selectedEntries.length} lançamento(s)`}</button> : null}
        </form>
      ) : null}
    </section>
  );
}
