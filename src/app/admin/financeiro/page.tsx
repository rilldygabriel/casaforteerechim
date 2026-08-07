import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { createPayable, togglePayableStatus } from "./actions";
import StatementAnalyzer from "./statement-analyzer";
import "./finance.css";

export const metadata: Metadata = { title: "Financeiro | Painel administrativo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });

function currentMonthKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).format(new Date());
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;
  return { start: `${month}-01`, end: next };
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00Z`));
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ month?: string; ok?: string; error?: string }> }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("member_profiles").select("full_name,is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/admin");

  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : currentMonthKey();
  const range = monthRange(month);
  const service = getSupabaseServiceClient();
  const [{ data: payables }, { data: incomeEntries }] = await Promise.all([
    service.from("finance_payables").select("id,description,vendor,category,due_date,amount_cents,status,payment_date,notes").order("status").order("due_date"),
    service.from("finance_income_entries").select("id,transaction_date,description,amount_cents,source").order("transaction_date", { ascending: false }).limit(30),
  ]);
  const allPayables = payables ?? [];
  const dueInMonth = allPayables.filter((item) => item.due_date >= range.start && item.due_date < range.end);
  const paidInMonth = allPayables.filter((item) => item.status === "paid" && item.payment_date && item.payment_date >= range.start && item.payment_date < range.end);
  const totalDue = dueInMonth.reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const paidDue = dueInMonth.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const spent = paidInMonth.reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const pending = dueInMonth.filter((item) => item.status === "pending").reduce((sum, item) => sum + Number(item.amount_cents), 0);

  return (
    <main className="finance-page">
      <header className="finance-topbar">
        <Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link>
        <Link href="/admin">Voltar ao painel</Link>
      </header>
      <section className="finance-hero">
        <p className="section-eyebrow"><span aria-hidden="true" />Gestão administrativa</p>
        <h1>Financeiro</h1>
        <p>Contas, pagamentos e entradas da Casa reunidos em um único lugar.</p>
      </section>

      <form className="finance-month-filter" method="get">
        <label>Mês do resumo <input name="month" type="month" defaultValue={month} /></label>
        <button type="submit">Ver mês</button>
      </form>
      {params.ok ? <p className="finance-flash success">{params.ok}</p> : null}
      {params.error ? <p className="finance-flash error">{params.error}</p> : null}

      <section className="finance-summary" aria-label="Resumo financeiro mensal">
        <Summary label="Gasto no mês" value={spent} detail="Pagamentos realizados neste mês" />
        <Summary label="Contas do mês" value={totalDue} detail={`${dueInMonth.length} conta(s) com vencimento`} />
        <Summary label="Já pago" value={paidDue} detail="Das contas que vencem neste mês" />
        <Summary label="Falta pagar" value={pending} detail={`${dueInMonth.filter((item) => item.status === "pending").length} conta(s) pendente(s)`} warning={pending > 0} />
      </section>

      <section className="finance-create-panel">
        <div><span>Nova conta</span><h2>Cadastrar conta a pagar</h2><p>Informe os dados principais. Depois, dê o aceite no card quando o pagamento for feito.</p></div>
        <form action={createPayable}>
          <input type="hidden" name="returnMonth" value={month} />
          <label className="wide">Descrição<input name="description" maxLength={180} required /></label>
          <label>Fornecedor<input name="vendor" maxLength={160} /></label>
          <label>Categoria<input name="category" maxLength={100} placeholder="Ex.: água, aluguel" /></label>
          <label>Vencimento<input name="dueDate" type="date" required /></label>
          <label>Valor<input name="amount" inputMode="decimal" placeholder="0,00" required /></label>
          <label className="wide">Observação<textarea name="notes" maxLength={1000} rows={3} /></label>
          <button className="wide" type="submit">Salvar conta</button>
        </form>
      </section>

      <section className="finance-payables-section">
        <header><div><span>Contas a pagar</span><h2>Todas as contas</h2></div><strong>{allPayables.length} cadastrada(s)</strong></header>
        <div className="finance-payables-grid">
          {allPayables.length ? allPayables.map((item) => (
            <article key={item.id} data-paid={item.status === "paid"}>
              <header><span>{item.category || "Conta"}</span><strong>{item.status === "paid" ? "Pago" : "Pendente"}</strong></header>
              <h3>{item.description}</h3>
              {item.vendor ? <p>{item.vendor}</p> : null}
              <dl><div><dt>Vencimento</dt><dd>{formatDate(item.due_date)}</dd></div><div><dt>Valor</dt><dd>{money.format(Number(item.amount_cents) / 100)}</dd></div></dl>
              {item.notes ? <small>{item.notes}</small> : null}
              <form action={togglePayableStatus}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="nextStatus" value={item.status === "paid" ? "pending" : "paid"} />
                <input type="hidden" name="returnMonth" value={month} />
                <button type="submit"><i aria-hidden="true">✓</i>{item.status === "paid" ? "Marcar como pendente" : "Dar baixa como pago"}</button>
              </form>
            </article>
          )) : <p className="finance-empty">Nenhuma conta cadastrada ainda.</p>}
        </div>
      </section>

      <StatementAnalyzer />

      <section className="finance-income-section">
        <header><div><span>Entradas confirmadas</span><h2>Últimos lançamentos</h2></div></header>
        <div>{(incomeEntries ?? []).length ? (incomeEntries ?? []).map((entry) => (
          <article key={entry.id}><time>{formatDate(entry.transaction_date)}</time><strong>{entry.description}</strong><b>{money.format(Number(entry.amount_cents) / 100)}</b></article>
        )) : <p className="finance-empty">As entradas identificadas nos extratos aparecerão aqui.</p>}</div>
      </section>
    </main>
  );
}

function Summary({ label, value, detail, warning = false }: { label: string; value: number; detail: string; warning?: boolean }) {
  return <article data-warning={warning}><span>{label}</span><strong>{money.format(value / 100)}</strong><p>{detail}</p></article>;
}
