"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { galetoTotals, GALETO_MANAGERS, type GaletoAllocation, type GaletoChange, type GaletoInput } from "@/lib/galeto";
import { saveGaleto } from "./actions";
import styles from "./galeto.module.css";

type Mode = "new" | "settle" | "pickup" | "edit";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const labels: Record<Mode, string> = { new: "Adicionar pessoa", settle: "Registrar acerto", pickup: "Registrar retirada", edit: "Editar / corrigir" };

export default function GaletoControl({ rows, history }: { rows: GaletoAllocation[]; history: GaletoChange[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState<{ item: GaletoInput; mode: Mode } | null>(null);
  const [message, setMessage] = useState("");
  const [refreshing, refresh] = useTransition();
  const totals = galetoTotals(rows);
  const shown = rows.filter(row => normalize(row.name).includes(normalize(search)) &&
    (filter === "all" || (filter === "settle" && row.settled < row.allocated) ||
      (filter === "pickup" && row.picked_up < row.allocated) || (filter === "review" && !row.settlement_reviewed)));
  function open(item: GaletoInput, mode: Mode) { setMessage(""); setEditing({ item, mode }); }
  function reload() { refresh(() => router.refresh()); }
  return <>
    <section className={styles.metrics} aria-label="Resumo dos ingressos">
      <Metric label="Ingressos entregues" value={totals.allocated} detail={`${rows.length} pessoas na lista`} />
      <Metric label="Acertos registrados" value={totals.settled} detail={`${totals.allocated - totals.settled} sem acerto registrado`} />
      <Metric label="Refeições retiradas" value={totals.picked_up} detail={`${totals.allocated - totals.picked_up} ainda por retirar`} />
    </section>
    {totals.unreviewed > 0 && <p className={styles.hint}>{totals.unreviewed} pessoas com pagamento ainda a conferir. “Sem acerto registrado” não significa que o pagamento não ocorreu.</p>}
    <div className={styles.toolbar}>
      <button className={styles.primary} onClick={() => open({ id: crypto.randomUUID(), name: "", allocated: 1, settled: 0, picked_up: 0, settlement_reviewed: false, notes: "", version: 0 }, "new")} disabled={!!editing}>+ Adicionar pessoa</button>
      <button onClick={reload} disabled={refreshing || !!editing}>{refreshing ? "Atualizando…" : "Atualizar lista"}</button>
    </div>
    <div role="status" aria-live="polite">{message && <p className={styles.feedback}>{message}</p>}</div>
    {editing && <Editor key={`${editing.item.id}-${editing.mode}`} item={editing.item} mode={editing.mode}
      onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage("Registro salvo. Os totais foram atualizados."); reload(); }} />}
    <div className={styles.filters}>
      <label>Buscar pessoa<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Digite o nome…" /></label>
      <label>Mostrar<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas as pessoas</option><option value="settle">Com acertos pendentes de registro</option><option value="pickup">Com refeições por retirar</option><option value="review">Pagamento a conferir</option></select></label>
    </div>
    <p className={styles.resultCount}>{shown.length} de {rows.length} pessoas</p>
    <section className={styles.list} aria-label="Controle por pessoa">
      {shown.map(row => <article className={styles.card} key={row.id}>
        <div className={styles.cardHeading}><h2>{row.name}</h2><span>{row.allocated} ingressos</span></div>
        <div className={styles.counts}>
          <div><span>Acertados</span><strong>{row.settled} <small>/ {row.allocated}</small></strong><p>{!row.settlement_reviewed ? "Pagamento a conferir" : row.settled === row.allocated ? "Tudo acertado" : `${row.allocated - row.settled} a acertar`}</p></div>
          <div><span>Refeições retiradas</span><strong>{row.picked_up} <small>/ {row.allocated}</small></strong><p>{row.picked_up === row.allocated ? "Tudo retirado" : `${row.allocated - row.picked_up} por retirar`}</p></div>
        </div>
        {row.notes && <p className={styles.notes}>{row.notes}</p>}
        <div className={styles.cardActions}>
          <button disabled={!!editing || row.settled >= row.allocated} onClick={() => open(row, "settle")}>Acertar</button>
          <button className={styles.primary} disabled={!!editing || row.picked_up >= row.allocated} onClick={() => open(row, "pickup")}>Retirar refeição</button>
          <button className={styles.edit} disabled={!!editing} onClick={() => open(row, "edit")}>Editar / corrigir</button>
        </div>
      </article>)}
      {!shown.length && <p>Nenhuma pessoa encontrada com este filtro.</p>}
    </section>
    <details className={styles.history}><summary>Histórico das últimas alterações</summary>
      <p>Até 100 registros mais recentes. Correções ficam registradas aqui.</p>
      <ol>{history.map(change => <li key={change.id}><strong>{change.after_state.name}</strong>
        <span>{change.before_state ? `Ingressos: ${change.before_state.allocated} → ${change.after_state.allocated} · Acertos: ${change.before_state.settled} → ${change.after_state.settled} · Retiradas: ${change.before_state.picked_up} → ${change.after_state.picked_up}` : `Cadastro · ${change.after_state.allocated} ingressos`}</span>
        <small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(change.created_at))} · {change.actor_id === GALETO_MANAGERS[0] ? "Rilldy" : "Lisi"}</small>
      </li>)}</ol>
    </details>
  </>;
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function Editor({ item, mode, onCancel, onSaved }: { item: GaletoInput; mode: Mode; onCancel: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState(item);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const panel = useRef<HTMLElement>(null);
  const maximum = mode === "settle" ? item.allocated - item.settled : item.allocated - item.picked_up;
  useEffect(() => { panel.current?.scrollIntoView({ behavior: "smooth", block: "center" }); panel.current?.focus({ preventScroll: true }); }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try {
      const next = mode === "settle" ? { ...draft, settled: item.settled + quantity, settlement_reviewed: true }
        : mode === "pickup" ? { ...draft, picked_up: item.picked_up + quantity } : draft;
      const result = await saveGaleto(next);
      if (result.ok) onSaved(); else setError(result.message);
    } catch { setError("Não foi possível confirmar o salvamento. Feche a edição e atualize a lista antes de tentar novamente."); }
    finally { busy.current = false; setPending(false); }
  }
  return <section ref={panel} tabIndex={-1} className={styles.editor} aria-label={labels[mode]}>
    <h2>{labels[mode]}{mode !== "new" ? ` · ${item.name}` : ""}</h2>
    <form onSubmit={submit}>
      <fieldset disabled={pending}>
        {mode === "new" || mode === "edit" ? <>
          <label>Nome / apelido<input required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
          <label>Total de ingressos entregues<input type="number" required min={Math.max(draft.settled, draft.picked_up)} max={10000} step={1} value={draft.allocated} onChange={e => setDraft({ ...draft, allocated: e.target.valueAsNumber })} /></label>
          {mode === "edit" && <>
            <label>Total de ingressos já acertados<input type="number" min={0} max={draft.allocated} step={1} required value={draft.settled} onChange={e => setDraft({ ...draft, settled: e.target.valueAsNumber, settlement_reviewed: true })} /></label>
            <label>Total de refeições já retiradas<input type="number" min={0} max={draft.allocated} step={1} required value={draft.picked_up} onChange={e => setDraft({ ...draft, picked_up: e.target.valueAsNumber })} /></label>
            <label className={styles.checkbox}><input type="checkbox" checked={draft.settlement_reviewed} onChange={e => setDraft({ ...draft, settlement_reviewed: e.target.checked })} /> Pagamento conferido</label>
            <p>Os campos acima são totais acumulados. Ajuste-os para corrigir um lançamento; o histórico será preservado.</p>
          </>}
        </> : <>
          <p>{mode === "settle" ? "Quantos ingressos esta pessoa está acertando agora?" : "Quantas refeições serão retiradas agora em nome desta pessoa?"}</p>
          <label>Quantidade neste lançamento<input type="number" required min={1} max={maximum} step={1} value={quantity} onChange={e => setQuantity(e.target.valueAsNumber)} /></label>
          <p>Após confirmar: <strong>{(mode === "settle" ? item.settled : item.picked_up) + (Number.isFinite(quantity) ? quantity : 0)} de {item.allocated} {mode === "settle" ? "acertados" : "retiradas"}</strong>.</p>
          {mode === "pickup" && <p>A retirada da refeição não altera o pagamento.</p>}
        </>}
        <label>Observações (opcional)<textarea rows={2} maxLength={1000} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Ex.: retirado por outra pessoa; acerto parcial…" /></label>
        <div className={styles.toolbar}><button className={styles.primary} type="submit">{pending ? "Salvando…" : mode === "pickup" ? "Confirmar retirada" : mode === "settle" ? "Confirmar acerto" : "Salvar"}</button><button type="button" onClick={onCancel}>Cancelar</button></div>
      </fieldset>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  </section>;
}
