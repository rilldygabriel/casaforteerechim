export const ENTRY_KINDS = {
  sale: "Venda recebida", cash_donation: "Doação em dinheiro", expense: "Despesa paga",
  in_kind: "Material ou serviço doado", opening_balance: "Saldo inicial", withdrawal: "Retirada / repasse",
} as const;
export type EntryKind = keyof typeof ENTRY_KINDS;
export type FundEvent = { id: string; ministry_key: string; title: string; description: string; event_date: string; status: "planned" | "completed" | "archived" };
export type FundDream = { id: string; ministry_key: string; title: string; description: string; target_cents: number; status: "active" | "purchased" | "archived" };
export type FundEntry = { id: string; ministry_key: string; event_id: string | null; dream_id: string | null; kind: EntryKind; description: string; amount_cents: number; quantity: number; occurred_on: string; created_by: string; created_at: string; voided_at: string | null; void_reason: string | null };
export type FundTotal = { ministry_key: string; scope: "ministry" | "event" | "dream"; scope_id: string | null; sales_cents: number; donations_cents: number; expenses_cents: number; other_in_cents: number; withdrawals_cents: number; in_kind_cents: number; units: number; balance_cents: number };
export const EMPTY_TOTAL: FundTotal = { ministry_key:"",scope:"ministry",scope_id:null,sales_cents:0,donations_cents:0,expenses_cents:0,other_in_cents:0,withdrawals_cents:0,in_kind_cents:0,units:0,balance_cents:0 };
export const money = (cents: number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(cents)/100);
export const dateLabel = (date: string) => new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));
export function parseCents(value: string): number {
  const text=value.trim().replace(/^R\$\s*/,"");
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text) && !/^\d+\.\d{1,2}$/.test(text)) throw new Error("Informe um valor válido, por exemplo 1.250,50.");
  const normalized=text.includes(",")?text.replaceAll(".","").replace(",","."): /^\d{1,3}(?:\.\d{3})+$/.test(text)?text.replaceAll(".",""):text;
  const cents=Math.round(Number(normalized)*100);
  if (!Number.isSafeInteger(cents)||cents<0||cents>999999999) throw new Error("Valor fora do limite permitido.");
  return cents;
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)||value<"2000-01-01"||value>"2100-12-31"||new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)!==value) throw new Error("Informe uma data válida.");
  return value;
}
export function entryEffect(kind: EntryKind, amount: number) {
  return kind==="in_kind"?0:kind==="expense"||kind==="withdrawal"?-amount:amount;
}
export function dreamProgress(total: number, target: number) {
  return { percent: Math.min(100, Math.max(0, Math.round(total / target * 100))), remaining: Math.max(0,target-total) };
}
