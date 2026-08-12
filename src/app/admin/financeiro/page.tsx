import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { isOpenFinanceConfigured } from "@/lib/open-finance";
import { isMercadoPagoConfigured } from "@/lib/mercado-pago";
import { createPayable, togglePayableStatus } from "./actions";
import OpenFinanceConnect from "./open-finance-connect";
import ServiceIncomeForm from "./service-income-form";
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
  const { data: profile } = await supabase.from("member_profiles").select("full_name,is_admin,can_manage_finance").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin && !profile?.can_manage_finance) redirect("/admin");

  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month! : currentMonthKey();
  const range = monthRange(month);
  const service = getSupabaseServiceClient();
  const [{ data: payables }, { data: incomeEntries }, { data: monthlyIncome }, { data: bankConnections }, { data: bankAccounts }, { data: serviceIncomeRecords }, { data: onlinePayments }, { data: monthlyOnlineContributions }, { data: ledgerEntries }] = await Promise.all([
    service.from("finance_payables").select("id,description,vendor,category,due_date,amount_cents,status,payment_date,notes").order("status").order("due_date"),
    service.from("finance_income_entries").select("id,transaction_date,description,amount_cents,source").order("transaction_date", { ascending: false }).limit(30),
    service.from("finance_income_entries").select("amount_cents").gte("transaction_date", range.start).lt("transaction_date", range.end),
    service.from("finance_bank_connections").select("id,institution_name,status,last_synced_at").order("created_at"),
    service.from("finance_bank_accounts").select("id,connection_id,name,current_balance_cents,currency_code").order("name"),
    service.from("finance_service_income_records").select("id,service_date,cash_cents,pix_cents,counted_by,created_at").gte("service_date", range.start).lt("service_date", range.end).order("service_date", { ascending: false }).order("created_at", { ascending: false }),
    service.from("mercado_pago_payments").select("id,purpose,payer_name,amount_cents,tithe_cents,offering_cents,firstfruits_cents,status,payment_method_id,payment_type_id,approved_at,created_at").order("created_at", { ascending: false }).limit(40),
    service.from("mercado_pago_payments").select("amount_cents,tithe_cents,offering_cents,firstfruits_cents").eq("purpose", "contribution").eq("status", "approved").gte("approved_at", `${range.start}T03:00:00.000Z`).lt("approved_at", `${range.end}T03:00:00.000Z`),
    service.from("finance_ledger_entries").select("id,transaction_date,description,category,account_name,amount_cents,direction,source").gte("transaction_date", range.start).lt("transaction_date", range.end).order("transaction_date", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  const allPayables = payables ?? [];
  const dueInMonth = allPayables.filter((item) => item.due_date >= range.start && item.due_date < range.end);
  const paidInMonth = allPayables.filter((item) => item.status === "paid" && item.payment_date && item.payment_date >= range.start && item.payment_date < range.end);
  const totalDue = dueInMonth.reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const paidDue = dueInMonth.filter((item) => item.status === "paid").reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const spent = paidInMonth.reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const pending = dueInMonth.filter((item) => item.status === "pending").reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const received = (monthlyIncome ?? []).reduce((sum, item) => sum + Number(item.amount_cents), 0);
  const connectionNames = new Map((bankConnections ?? []).map((connection) => [connection.id, connection.institution_name]));
  const serviceIncomeInMonth = serviceIncomeRecords ?? [];
  const serviceCashTotal = serviceIncomeInMonth.reduce((sum, record) => sum + Number(record.cash_cents), 0);
  const servicePixTotal = serviceIncomeInMonth.reduce((sum, record) => sum + Number(record.pix_cents), 0);
  const onlineContributionTotals = (monthlyOnlineContributions ?? []).reduce((totals, payment) => ({
    tithe: totals.tithe + Number(payment.tithe_cents),
    firstfruits: totals.firstfruits + Number(payment.firstfruits_cents),
    offering: totals.offering + Number(payment.offering_cents),
    total: totals.total + Number(payment.amount_cents),
  }), { tithe: 0, firstfruits: 0, offering: 0, total: 0 });
  const ledgerCredits = (ledgerEntries ?? []).filter((entry) => entry.direction === "credit").reduce((sum, entry) => sum + Number(entry.amount_cents), 0);
  const ledgerDebits = (ledgerEntries ?? []).filter((entry) => entry.direction === "debit").reduce((sum, entry) => sum + Number(entry.amount_cents), 0);

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

      <nav className="finance-section-nav" aria-label="Áreas do financeiro">
        <a href="#mercado-pago">Mercado Pago</a>
        <a href="#entradas-de-culto">Entradas de culto</a>
        <a href="#contas-a-pagar">Contas a pagar</a>
        <a href="#historico-financeiro">Histórico</a>
        <a href="#open-finance">Open Finance</a>
      </nav>

      <form className="finance-month-filter" method="get">
        <label>Mês do resumo <input name="month" type="month" defaultValue={month} /></label>
        <button type="submit">Ver mês</button>
      </form>
      {params.ok ? <p className="finance-flash success">{params.ok}</p> : null}
      {params.error ? <p className="finance-flash error">{params.error}</p> : null}

      <section className="finance-online-payments" id="mercado-pago">
        <header><div><span>Recebimentos online</span><h2>Mercado Pago</h2><p>Somente pagamentos iniciados pelo checkout do site aparecem nesta área e recebem classificação automática.</p></div><strong data-configured={isMercadoPagoConfigured()}>{isMercadoPagoConfigured() ? "API conectada" : "Aguardando credenciais"}</strong></header>
        <div className="finance-online-summary" aria-label="Contribuições online confirmadas no mês"><article><span>Dízimos</span><strong>{money.format(onlineContributionTotals.tithe / 100)}</strong></article><article><span>Primícias</span><strong>{money.format(onlineContributionTotals.firstfruits / 100)}</strong></article><article><span>Ofertas</span><strong>{money.format(onlineContributionTotals.offering / 100)}</strong></article><article><span>Total</span><strong>{money.format(onlineContributionTotals.total / 100)}</strong></article></div>
        <div className="finance-online-grid">{(onlinePayments ?? []).length ? (onlinePayments ?? []).map((payment) => <article key={payment.id} data-status={payment.status}><div><span>{payment.purpose === "event" ? "Evento" : payment.purpose === "contribution" ? "Contribuição" : payment.purpose === "tithe" ? "Dízimo" : payment.purpose === "firstfruits" ? "Primícias" : "Oferta"}</span><b>{payment.status === "approved" ? "Confirmado" : payment.status === "rejected" ? "Recusado" : payment.status === "refunded" ? "Estornado" : "Processando"}</b></div><h3>{payment.payer_name}</h3><strong>{money.format(Number(payment.amount_cents) / 100)}</strong>{payment.purpose === "contribution" ? <ul className="finance-payment-breakdown">{Number(payment.tithe_cents) > 0 ? <li><span>Dízimo</span><b>{money.format(Number(payment.tithe_cents) / 100)}</b></li> : null}{Number(payment.firstfruits_cents) > 0 ? <li><span>Primícias</span><b>{money.format(Number(payment.firstfruits_cents) / 100)}</b></li> : null}{Number(payment.offering_cents) > 0 ? <li><span>Oferta</span><b>{money.format(Number(payment.offering_cents) / 100)}</b></li> : null}</ul> : null}<p>{payment.payment_method_id ? `${payment.payment_method_id} · ` : ""}{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(payment.approved_at || payment.created_at))}</p></article>) : <p className="finance-empty">Os pagamentos aparecerão aqui assim que a primeira contribuição for iniciada.</p>}</div>
      </section>

      <section className="finance-service-income-panel" id="entradas-de-culto">
        <header className="finance-service-income-heading">
          <div><span>Entradas de culto</span><h2>Contagem das ofertas</h2><p>Informe somente a data e os valores recebidos. O responsável será identificado automaticamente pelo login.</p></div>
          <div className="finance-service-totals"><article><span>Dinheiro no mês</span><strong>{money.format(serviceCashTotal / 100)}</strong></article><article><span>Pix no mês</span><strong>{money.format(servicePixTotal / 100)}</strong></article><article><span>Total dos cultos</span><strong>{money.format((serviceCashTotal + servicePixTotal) / 100)}</strong></article></div>
        </header>
        <ServiceIncomeForm month={month} />
        <div className="finance-service-history">
          <header><div><span>Histórico</span><h3>Entradas cadastradas</h3></div><strong>{serviceIncomeRecords?.length ?? 0} registro(s)</strong></header>
          <div className="finance-service-records">{(serviceIncomeRecords ?? []).length ? (serviceIncomeRecords ?? []).map((record) => {
            const pixTotal = Number(record.pix_cents);
            return <article key={record.id}>
              <header><div><time>{formatDate(record.service_date)}</time><h4>Entrada do culto</h4></div><strong>{money.format((Number(record.cash_cents) + pixTotal) / 100)}</strong></header>
              <dl><div><dt>Dinheiro</dt><dd>{money.format(Number(record.cash_cents) / 100)}</dd></div><div><dt>Pix</dt><dd>{money.format(pixTotal / 100)}</dd></div></dl>
              <p><b>Contagem feita por:</b> {record.counted_by.join(", ")}</p>
            </article>;
          }) : <p className="finance-empty">Nenhuma entrada de culto cadastrada ainda.</p>}</div>
        </div>
      </section>

      <section className="finance-summary" aria-label="Resumo financeiro mensal">
        <Summary label="Entradas no mês" value={received} detail={`${monthlyIncome?.length ?? 0} recebimento(s) confirmado(s)`} />
        <Summary label="Gasto no mês" value={spent} detail="Pagamentos realizados neste mês" />
        <Summary label="Contas do mês" value={totalDue} detail={`${dueInMonth.length} conta(s) com vencimento`} />
        <Summary label="Já pago" value={paidDue} detail="Das contas que vencem neste mês" />
        <Summary label="Falta pagar" value={pending} detail={`${dueInMonth.filter((item) => item.status === "pending").length} conta(s) pendente(s)`} warning={pending > 0} />
      </section>

      <section className="finance-ledger-section" id="historico-financeiro">
        <header>
          <div><span>Histórico completo</span><h2>Entradas e saídas</h2><p>Lançamentos importados e discriminados do controle financeiro da igreja.</p></div>
          <div className="finance-ledger-totals"><article><span>Entradas</span><strong>{money.format(ledgerCredits / 100)}</strong></article><article><span>Saídas</span><strong>{money.format(ledgerDebits / 100)}</strong></article><article data-negative={ledgerCredits - ledgerDebits < 0}><span>Resultado</span><strong>{money.format((ledgerCredits - ledgerDebits) / 100)}</strong></article></div>
        </header>
        <div className="finance-ledger-list">{(ledgerEntries ?? []).length ? (ledgerEntries ?? []).map((entry) => (
          <article key={entry.id} data-direction={entry.direction}>
            <time>{formatDate(entry.transaction_date)}</time>
            <div><strong>{entry.description}</strong><small>{[entry.category, entry.account_name, entry.source === "mobills" ? "Mobills" : entry.source].filter(Boolean).join(" · ")}</small></div>
            <b>{entry.direction === "credit" ? "+" : "−"}{money.format(Number(entry.amount_cents) / 100)}</b>
          </article>
        )) : <p className="finance-empty">Nenhuma movimentação neste mês. Escolha outro mês acima para consultar o histórico.</p>}</div>
      </section>

      <section className="finance-open-finance-panel" id="open-finance">
        <div className="finance-open-finance-copy"><span>Open Finance</span><h2>Contas e entradas automáticas</h2><p>Conecte as contas de recebimento em modo somente leitura. O site importa saldos e créditos sem guardar senha bancária.</p></div>
        <OpenFinanceConnect configured={isOpenFinanceConfigured()} hasConnections={Boolean(bankConnections?.length)} />
        {(bankAccounts ?? []).length ? <div className="finance-bank-accounts">{(bankAccounts ?? []).map((account) => (
          <article key={account.id}><span>{connectionNames.get(account.connection_id) || "Instituição"}</span><strong>{account.name}</strong><b>{account.current_balance_cents === null ? "Saldo indisponível" : money.format(Number(account.current_balance_cents) / 100)}</b></article>
        ))}</div> : <p className="finance-open-finance-empty">Nenhuma conta bancária conectada ainda.</p>}
      </section>

      <section className="finance-create-panel" id="contas-a-pagar">
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
          <article key={entry.id}><time>{formatDate(entry.transaction_date)}</time><strong>{entry.description}<small>{entry.source === "open_finance" ? "Open Finance" : entry.source === "mercado_pago" ? "Mercado Pago" : "Extrato"}</small></strong><b>{money.format(Number(entry.amount_cents) / 100)}</b></article>
        )) : <p className="finance-empty">As entradas identificadas nos extratos aparecerão aqui.</p>}</div>
      </section>
    </main>
  );
}

function Summary({ label, value, detail, warning = false }: { label: string; value: number; detail: string; warning?: boolean }) {
  return <article data-warning={warning}><span>{label}</span><strong>{money.format(value / 100)}</strong><p>{detail}</p></article>;
}
