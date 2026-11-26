"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { galetoTotals, GALETO_MANAGERS, type GaletoAllocation, type GaletoChange, type GaletoInput } from "@/lib/galeto";
import { saveGaleto } from "./actions";
import styles from "./galeto.module.css";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function GaletoControl({ rows, history }: { rows: GaletoAllocation[]; history: GaletoChange[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [overrides, setOverrides] = useState<Record<string, GaletoAllocation>>({});
  const [newItem, setNewItem] = useState<GaletoAllocation | null>(null);
  const [refreshing, refresh] = useTransition();
  const allRows = rows.map(row => overrides[row.id]?.version > row.version ? overrides[row.id] : row);
  for (const row of Object.values(overrides)) if (!rows.some(item => item.id === row.id)) allRows.push(row);
  const totals = galetoTotals(allRows);
  const matches = (row: GaletoAllocation) => normalize(row.name).includes(normalize(search)) &&
    (filter === "all" || (filter === "settle" && row.settled < row.allocated - row.returned) ||
      (filter === "pickup" && row.picked_up < row.allocated - row.returned));
  function saved(row: GaletoAllocation) {
    setOverrides(previous => ({ ...previous, [row.id]: row }));
    refresh(() => router.refresh());
  }
  return <>
    <p className={styles.hint}>{totals.allocated} ingressos retirados por {allRows.length} pessoas. Resumo dos dados salvos:</p>
    <section className={styles.metrics} aria-label="Resumo dos ingressos">
      <Metric label="Ingressos retirados" value={totals.allocated} />
      <Metric label="Devolvidos" value={totals.returned} />
      <Metric label="Acertados" value={totals.settled} />
      <Metric label="Falta acertar" value={totals.unsettled} />
      <Metric label="Refeições retiradas" value={totals.picked_up} />
      <Metric label="Refeições a retirar" value={totals.uncollected} />
    </section>
    <p className={styles.hint}>Falta acertar = ingressos retirados − devolvidos − acertados. Refeições a retirar = ingressos retirados − devolvidos − refeições já retiradas. A retirada da refeição não confirma pagamento.</p>
    <div className={styles.toolbar}>
      <button className={styles.primary} disabled={!!newItem} onClick={() => setNewItem({ id: crypto.randomUUID(), name: "", allocated: 1, returned: 0, sold: null, settled: 0, picked_up: 0, settlement_reviewed: false, notes: "", version: 0, updated_at: "" })}>+ Adicionar pessoa</button>
      <button disabled={refreshing} onClick={() => refresh(() => router.refresh())}>{refreshing ? "Atualizando…" : "Atualizar lista"}</button>
    </div>
    {newItem && <AllocationCard row={newItem} isNew onSaved={row => { saved(row); setNewItem(null); }} onCancel={() => setNewItem(null)} />}
    <div className={styles.filters}>
      <label>Buscar pessoa<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Digite o nome…" /></label>
      <label>Mostrar<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas as pessoas</option><option value="settle">Falta acertar</option><option value="pickup">Refeições a retirar</option></select></label>
    </div>
    <p className={styles.resultCount}>{allRows.filter(matches).length} de {allRows.length} pessoas</p>
    <section className={styles.list} aria-label="Controle por pessoa">
      {allRows.map(row => <AllocationCard key={row.id} row={row} hidden={!matches(row)} onSaved={saved} />)}
      {!allRows.some(matches) && <p>Nenhuma pessoa encontrada com este filtro.</p>}
    </section>
    <details className={styles.history}><summary>Histórico das últimas alterações</summary>
      <p>Até 100 registros mais recentes. Correções ficam registradas aqui.</p>
      <ol>{history.map(change => <li key={change.id}><strong>{change.after_state.name}</strong>
        <span>{change.before_state ? `Ingressos retirados: ${change.before_state.allocated} → ${change.after_state.allocated} · Devolvidos: ${change.before_state.returned ?? 0} → ${change.after_state.returned ?? 0} · Acertados: ${change.before_state.settled} → ${change.after_state.settled} · Refeições retiradas: ${change.before_state.picked_up} → ${change.after_state.picked_up}` : `Cadastro · ${change.after_state.allocated} ingressos retirados · ${change.after_state.returned ?? 0} devolvidos`}</span>
        <small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(change.created_at))} · {change.actor_id === GALETO_MANAGERS[0] ? "Rilldy" : "Lisi"}</small>
      </li>)}</ol>
    </details>
  </>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}

function AllocationCard({ row, hidden, isNew, onSaved, onCancel }: {
  row: GaletoAllocation; hidden?: boolean; isNew?: boolean;
  onSaved: (row: GaletoAllocation) => void; onCancel?: () => void;
}) {
  // Preserve unsaved fields and their version while other cards refresh.
  const [draft, setDraft] = useState<GaletoInput | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmedValues, setConfirmedValues] = useState<string | null>(null);
  const busy = useRef(false);
  const item = draft ?? row;
  const valuesKey = JSON.stringify(item);
  const confirmed = confirmedValues === valuesKey;
  const count = (n: number | null) => n !== null && Number.isFinite(n) ? n : "";
  const retained = Number.isFinite(item.allocated) && Number.isFinite(item.returned) ? item.allocated - item.returned : null;
  const limit = retained === null ? undefined : Math.max(0, retained);
  function change(patch: Partial<GaletoInput>) { setDraft(previous => ({ ...(previous ?? row), ...patch })); setConfirmedValues(null); setMessage(""); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !confirmed) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const result = await saveGaleto(item, confirmed);
      if (result.ok && result.row) { onSaved(result.row); setDraft(null); setConfirmedValues(null); setError(false); setMessage("Salvo. Totais atualizados."); }
      else { setError(true); setMessage(result.message); }
    } catch { setError(true); setMessage("Falha de conexão. Atualize a lista e confira antes de reenviar; seus campos foram preservados."); }
    finally { busy.current = false; setPending(false); }
  }
  return <article className={styles.card} hidden={hidden} aria-label={isNew ? "Adicionar pessoa" : row.name}>
    <div className={styles.cardHeading}><h2>{isNew ? "Adicionar pessoa" : row.name}</h2><span>{count(item.allocated)} ingressos retirados</span></div>
    <div className={styles.balances} aria-live="polite">
      <span>Retirados − devolvidos <strong>{retained === null ? "—" : Math.max(0, retained)}</strong></span>
      <span>Falta acertar <strong>{retained === null || !Number.isFinite(item.settled) ? "—" : Math.max(0, retained - item.settled)}</strong></span>
      <span>Refeições a retirar <strong>{retained === null || !Number.isFinite(item.picked_up) ? "—" : Math.max(0, retained - item.picked_up)}</strong></span>
    </div>
    <form onSubmit={submit}>
      <fieldset disabled={pending} className={styles.cardFields}>
        <div className={styles.quantityFields}>
          <label>Ingressos retirados<input aria-label={`Ingressos retirados · ${row.name || "nova pessoa"}`} type="number" min={0} max={10000} step={1} required inputMode="numeric" value={count(item.allocated)} onChange={e => change({ allocated: e.target.valueAsNumber })} /></label>
          <label>Devolvidos<input aria-label={`Devolvidos · ${row.name || "nova pessoa"}`} type="number" min={0} max={Number.isFinite(item.allocated) ? item.allocated : undefined} step={1} required inputMode="numeric" value={count(item.returned)} onChange={e => change({ returned: e.target.valueAsNumber })} /></label>
          <label>Acertados<input aria-label={`Acertados · ${row.name || "nova pessoa"}`} type="number" min={0} max={limit} step={1} required inputMode="numeric" value={count(item.settled)} onChange={e => change({ settled: e.target.valueAsNumber, settlement_reviewed: true })} /></label>
          <label>Refeições retiradas<input aria-label={`Refeições retiradas · ${row.name || "nova pessoa"}`} type="number" min={0} max={limit} step={1} required inputMode="numeric" value={count(item.picked_up)} onChange={e => change({ picked_up: e.target.valueAsNumber })} /></label>
        </div>
        <p className={styles.cardHint}>Preencha os totais acumulados. Ingressos retirados = quantos a pessoa pegou para vender. Devolvidos = ingressos que devolveu. Refeições retiradas = galetos já entregues no dia.</p>
        <details open={isNew || undefined} className={styles.settings}><summary>Nome e observações</summary>
          <label>Nome / apelido<input required maxLength={100} value={item.name} onChange={e => change({ name: e.target.value })} /></label>
          <label>Observações<textarea rows={2} maxLength={1000} value={item.notes} onChange={e => change({ notes: e.target.value })} /></label>
        </details>
        <label className={styles.checkbox}><input type="checkbox" required checked={confirmed} onChange={e => setConfirmedValues(e.target.checked ? valuesKey : null)} />Conferi os números e autorizo salvar</label>
        <button className={`${styles.primary} ${styles.saveCard}`} type="submit" disabled={!confirmed || pending}>{pending ? "Salvando…" : "Salvar"}</button>
        {draft && <button type="button" onClick={() => { setDraft(null); setConfirmedValues(null); setMessage(""); }}>Descartar edição e usar dados atualizados</button>}
        {onCancel && <button type="button" onClick={onCancel}>Cancelar</button>}
      </fieldset>
      {draft && !message && <p className={styles.cardHint}>Prévia no card. Marque o aceite e clique em Salvar para atualizar o resumo geral.</p>}
      <p className={error ? styles.error : styles.cardHint} role={error ? "alert" : "status"}>{message}</p>
    </form>
  </article>;
}
