import { createHash } from "node:crypto";

export type StatementEntry = {
  transactionDate: string;
  description: string;
  amountCents: number;
};

export function parseCurrencyToCents(value: string) {
  const normalized = value
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function financeFingerprint(entry: StatementEntry) {
  const normalizedDescription = entry.description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256")
    .update(`${entry.transactionDate}|${entry.amountCents}|${normalizedDescription}`)
    .digest("hex");
}

export function saoPauloDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
