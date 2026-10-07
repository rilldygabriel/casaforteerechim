// Presentation-only pause requested by the pastor. Never use this in checkout,
// reconciliation or webhooks: the underlying payment records must stay intact.
export const PAUSED_REPORT_VALUE = "—";
export const REPORT_LAST_VISIBLE_DATE = "2026-10-03";
export const REPORT_PAUSE_START = "2026-10-04T03:00:00.000Z";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function isHistoricalReceipt(date?: string | null) {
  if (!date) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date <= REPORT_LAST_VISIBLE_DATE;
  const timestamp = Date.parse(date);
  return Number.isFinite(timestamp) && timestamp < Date.parse(REPORT_PAUSE_START);
}

export function receiptReportValue(amountCents: number, purpose?: string | null, date?: string | null) {
  return purpose === "event" || isHistoricalReceipt(date) ? money.format(amountCents / 100) : PAUSED_REPORT_VALUE;
}

export function paymentPurpose(relation: { purpose?: string } | { purpose?: string }[] | null) {
  return Array.isArray(relation) ? relation[0]?.purpose : relation?.purpose;
}

export function receiptReportDescription(description: string, purpose?: string | null, date?: string | null) {
  if (purpose === "event" || isHistoricalReceipt(date)) return description;
  // Legacy contribution descriptions contain the monetary breakdown themselves.
  return description.replace(/R\$\s*[\d.,]+/g, PAUSED_REPORT_VALUE);
}
