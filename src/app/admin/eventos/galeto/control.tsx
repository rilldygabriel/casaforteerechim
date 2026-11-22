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
    (filter === "all" || (filter === "sell" && row.sold !== null && row.sold < row.allocated) ||
      (filter === "settle" && row.sold !== null && row.settled < row.sold) ||
      (filter === "pickup" && row.sold !== null && row.picked_up < row.sold) || (filter === "review" && row.sold === null));
  function saved(row: GaletoAllocation) {
    setOverrides(previous => ({ ...previous, [row.id]: row }));
    refresh(() => router.refresh());
  }
  return <>
    <p className={styles.hint}>{totals.allocated} ingressos entregues a {allRows.length} pessoas. Resumo dos dados salvos:</p>
    <section className={styles.metrics} aria-label="Resumo dos ingressos">
      <Metric label="Vendidos" value={allRows.length > 0 && totals.salesUnknown === allRows.length ? "—" : totals.sold} />
      <Metric label="Falta vender" value={allRows.length > 0 && totals.salesUnknown === allRows.length ? "—" : totals.unsold} />
      <Metric label="Acertados" value={totals.settled} />
      <Metric label="Falta acertar" value={allRows.length > 0 && totals.salesUnknown === allRows.length ? "—" : totals.unsettled} />
      <Metric label="Retirados" value={totals.picked_up} />
      <Metric label="Falta retirar" value={allRows.length > 0 && totals.salesUnknown === allRows.length ? "—" : totals.uncollected} />
    </section>
    {totals.salesUnknown > 0 && <p className={styles.hint}>Vendas ainda não informadas para {totals.salesUnknown} pessoas. Os saldos “falta” consideram somente quem já tem a quantidade vendida informada.</p>}
    <p className={styles.hint}>Falta vender = entregues − vendidos. Falta acertar = vendidos − acertados. Falta retirar = vendidos − retirados.</p>
    <div className={styles.toolbar}>
      <button className={styles.primary} disabled={!!newItem} onClick={() => setNewItem({ id: crypto.randomUUID(), name: "", allocated: 1, sold: 0, settled: 0, picked_up: 0, settlement_reviewed: false, notes: "", version: 0, updated_at: "" })}>+ Adicionar pessoa</button>
      <button disabled={refreshing} onClick={() => refresh(() => router.refresh())}>{refreshing ? "Atualizando…" : "Atualizar lista"}</button>
    </div>
    {newItem && <AllocationCard row={newItem} isNew onSaved={row => { saved(row); setNewItem(null); }} onCancel={() => setNewItem(null)} />}
    <div className={styles.filters}>
      <label>Buscar pessoa<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Digite o nome…" /></label>
      <label>Mostrar<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas as pessoas</option><option value="sell">Falta vender</option><option value="settle">Falta acertar</option><option value="pickup">Falta retirar</option><option value="review">Vendas não informadas</option></select></label>
    </div>
    <p className={styles.resultCount}>{allRows.filter(matches).length} de {allRows.length} pessoas</p>
    <section className={styles.list} aria-label="Controle por pessoa">
      {allRows.map(row => <AllocationCard key={row.id} row={row} hidden={!matches(row)} onSaved={saved} />)}
      {!allRows.some(matches) && <p>Nenhuma pessoa encontrada com este filtro.</p>}
    </section>
    <details className={styles.history}><summary>Histórico das últimas alterações</summary>
      <p>Até 100 registros mais recentes. Correções ficam registradas aqui.</p>
      <ol>{history.map(change => <li key={change.id}><strong>{change.after_state.name}</strong>
        <span>{change.before_state ? `Ingressos: ${change.before_state.allocated} → ${change.after_state.allocated} · Vendidos: ${change.before_state.sold ?? "não informado"} → ${change.after_state.sold ?? "não informado"} · Acertos: ${change.before_state.settled} → ${change.after_state.settled} · Retiradas: ${change.before_state.picked_up} → ${change.after_state.picked_up}` : `Cadastro · ${change.after_state.allocated} ingressos`}</span>
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
  const busy = useRef(false);
  const item = draft ?? row;
  const count = (n: number | null) => n !== null && Number.isFinite(n) ? n : "";
  const sold = Number.isFinite(item.sold) ? item.sold : null;
  function change(patch: Partial<GaletoInput>) { setDraft(previous => ({ ...(previous ?? row), ...patch })); setMessage(""); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true); setMessage("");
    try {
      const result = await saveGaleto(item);
      if (result.ok && result.row) { onSaved(result.row); setDraft(null); setError(false); setMessage("Salvo. Totais atualizados."); }
      else { setError(true); setMessage(result.message); }
    } catch { setError(true); setMessage("Falha de conexão. Atualize a lista e confira antes de reenviar; seus campos foram preservados."); }
    finally { busy.current = false; setPending(false); }
  }
  return <article className={styles.card} hidden={hidden} aria-label={isNew ? "Adicionar pessoa" : row.name}>
    <div className={styles.cardHeading}><h2>{isNew ? "Adicionar pessoa" : row.name}</h2><span>{item.allocated} ingressos entregues</span></div>
    <div className={styles.balances} aria-live="polite">
      <span>Falta vender <strong>{sold === null ? "—" : Math.max(0, item.allocated - sold)}</strong></span>
      <span>Falta acertar <strong>{sold === null || !Number.isFinite(item.settled) ? "—" : Math.max(0, sold - item.settled)}</strong></span>
      <span>Falta retirar <strong>{sold === null || !Number.isFinite(item.picked_up) ? "—" : Math.max(0, sold - item.picked_up)}</strong></span>
    </div>
    <form onSubmit={submit}>
      <fieldset disabled={pending} className={styles.cardFields}>
        <div className={styles.quantityFields}>
          <label>Vendidos<input aria-label={`Vendidos · ${row.name || "nova pessoa"}`} type="number" min={0} max={item.allocated} step={1} required inputMode="numeric" placeholder="Informe" value={count(item.sold)} onChange={e => change({ sold: e.target.value === "" ? null : e.target.valueAsNumber })} /></label>
          <label>Acertados<input aria-label={`Acertados · ${row.name || "nova pessoa"}`} type="number" min={0} max={sold ?? item.allocated} step={1} required inputMode="numeric" value={count(item.settled)} onChange={e => change({ settled: e.target.valueAsNumber, settlement_reviewed: true })} /></label>
          <label>Retirados<input aria-label={`Retirados · ${row.name || "nova pessoa"}`} type="number" min={0} max={sold ?? item.allocated} step={1} required inputMode="numeric" value={count(item.picked_up)} onChange={e => change({ picked_up: e.target.valueAsNumber })} /></label>
        </div>
        <p className={styles.cardHint}>Preencha os totais acumulados, não apenas os deste lançamento. Retirados = refeições entregues.</p>
        <details open={isNew || undefined} className={styles.settings}><summary>Nome, ingressos e observações</summary>
          <label>Nome / apelido<input required maxLength={100} value={item.name} onChange={e => change({ name: e.target.value })} /></label>
          <label>Ingressos entregues<input type="number" min={0} max={10000} step={1} required value={count(item.allocated)} onChange={e => change({ allocated: e.target.valueAsNumber })} /></label>
          <label>Observações<textarea rows={2} maxLength={1000} value={item.notes} onChange={e => change({ notes: e.target.value })} /></label>
        </details>
        <button className={`${styles.primary} ${styles.saveCard}`} type="submit">{pending ? "Salvando…" : "Salvar"}</button>
        {draft && <button type="button" onClick={() => { setDraft(null); setMessage(""); }}>Descartar edição e usar dados atualizados</button>}
        {onCancel && <button type="button" onClick={onCancel}>Cancelar</button>}
      </fieldset>
      {draft && !message && <p className={styles.cardHint}>Prévia no card. Clique em Salvar para atualizar o resumo geral.</p>}
      <p className={error ? styles.error : styles.cardHint} role={error ? "alert" : "status"}>{message}</p>
    </form>
  </article>;
}
