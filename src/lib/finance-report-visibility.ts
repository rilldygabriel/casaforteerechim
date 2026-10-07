// Presentation-only pause requested by the pastor. Never use this in checkout,
// reconciliation or webhooks: the underlying payment records must stay intact.
export const PAUSED_REPORT_VALUE = "—";
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function receiptReportValue(amountCents: number, purpose?: string | null) {
  return purpose === "event" ? money.format(amountCents / 100) : PAUSED_REPORT_VALUE;
}

export function paymentPurpose(relation: { purpose?: string } | { purpose?: string }[] | null) {
  return Array.isArray(relation) ? relation[0]?.purpose : relation?.purpose;
}

export function receiptReportDescription(description: string, purpose?: string | null) {
  if (purpose === "event") return description;
  // Legacy contribution descriptions contain the monetary breakdown themselves.
  return description.replace(/R\$\s*[\d.,]+/g, PAUSED_REPORT_VALUE);
}
