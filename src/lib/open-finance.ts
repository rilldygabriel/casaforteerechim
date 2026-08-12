import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const PLUGGY_API = "https://api.pluggy.ai";

type JsonObject = Record<string, unknown>;

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

function list(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === "object") : [];
}

function cents(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(Math.abs(amount) * 100) : 0;
}

function pluggyCredentials() {
  const clientId = process.env.PLUGGY_CLIENT_ID?.trim();
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Open Finance ainda não foi configurado.");
  return { clientId, clientSecret };
}

let cachedKey: { value: string; expiresAt: number } | null = null;

export function isOpenFinanceConfigured() {
  return Boolean(process.env.PLUGGY_CLIENT_ID?.trim() && process.env.PLUGGY_CLIENT_SECRET?.trim());
}

async function getApiKey() {
  if (cachedKey && cachedKey.expiresAt > Date.now() + 60_000) return cachedKey.value;
  const response = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pluggyCredentials()),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const result = object(await response.json());
  const apiKey = text(result.apiKey);
  if (!response.ok || !apiKey) throw new Error("Não foi possível autenticar a integração bancária.");
  cachedKey = { value: apiKey, expiresAt: Date.now() + 110 * 60_000 };
  return apiKey;
}

async function pluggyFetch(pathOrUrl: string, init: RequestInit = {}) {
  const url = new URL(pathOrUrl, PLUGGY_API);
  if (url.origin !== PLUGGY_API) throw new Error("Endereço inesperado do provedor financeiro.");
  const apiKey = await getApiKey();
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey, ...init.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  const result = object(await response.json());
  if (!response.ok) throw new Error(text(result.message, `O provedor financeiro respondeu ${response.status}.`));
  return result;
}

export async function createPluggyConnectToken(userId: string) {
  const result = await pluggyFetch("/connect_token", {
    method: "POST",
    body: JSON.stringify({ options: { clientUserId: `finance:${userId}`, avoidDuplicates: true } }),
  });
  const accessToken = text(result.accessToken) || text(result.connectToken);
  if (!accessToken) throw new Error("O provedor não devolveu o token de conexão.");
  return accessToken;
}

function transactionDate(value: unknown) {
  const date = text(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function incomeFingerprint(providerTransactionId: string) {
  return createHash("sha256").update(`open_finance|pluggy|${providerTransactionId}`).digest("hex");
}

async function fetchAllTransactions(accountId: string) {
  const results: JsonObject[] = [];
  let next: string | null = `/v2/transactions?accountId=${encodeURIComponent(accountId)}`;
  for (let page = 0; next && page < 30; page += 1) {
    const response = await pluggyFetch(next);
    results.push(...list(response.results));
    next = text(response.next) || null;
  }
  return results;
}

export async function syncPluggyItem(itemId: string, createdBy?: string | null) {
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new Error("Identificador bancário inválido.");
  const service = getSupabaseServiceClient();
  const item = await pluggyFetch(`/items/${itemId}`);
  const connector = object(item.connector);
  const institutionName = text(connector.name) || text(item.connectorName) || "Instituição financeira";
  const connectorId = String(connector.id ?? item.connectorId ?? "") || null;
  const itemStatus = text(item.status).toUpperCase();
  const status = itemStatus === "UPDATED" || itemStatus === "LOGIN_SUCCESS" ? "active" : itemStatus.includes("ERROR") ? "error" : "pending";

  const { data: connection, error: connectionError } = await service.from("finance_bank_connections").upsert({
    provider: "pluggy",
    provider_item_id: itemId,
    institution_name: institutionName,
    connector_id: connectorId,
    status,
    error_code: text(item.error?.toString()) || null,
    created_by: createdBy || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "provider_item_id" }).select("id").single();
  if (connectionError || !connection) throw new Error("Não foi possível registrar a conexão bancária.");

  const accountsResponse = await pluggyFetch(`/accounts?itemId=${encodeURIComponent(itemId)}`);
  const accounts = list(accountsResponse.results);
  let transactionCount = 0;
  let incomeCount = 0;

  for (const account of accounts) {
    const providerAccountId = text(account.id);
    const accountType = text(account.type).toUpperCase();
    if (!providerAccountId || accountType !== "BANK") continue;
    const { data: savedAccount, error: accountError } = await service.from("finance_bank_accounts").upsert({
      connection_id: connection.id,
      provider_account_id: providerAccountId,
      name: text(account.name, "Conta bancária").slice(0, 180),
      type: accountType,
      subtype: text(account.subtype) || null,
      number_masked: text(account.number) || null,
      currency_code: text(account.currencyCode, "BRL"),
      current_balance_cents: Number.isFinite(Number(account.balance)) ? Math.round(Number(account.balance) * 100) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider_account_id" }).select("id").single();
    if (accountError || !savedAccount) throw new Error("Não foi possível salvar uma das contas bancárias.");

    const transactions = await fetchAllTransactions(providerAccountId);
    const normalized = transactions.map((transaction) => {
      const id = text(transaction.id);
      const amountCents = cents(transaction.amount);
      const date = transactionDate(transaction.date);
      const description = text(transaction.description) || text(transaction.descriptionRaw) || "Movimentação bancária";
      const direction = text(transaction.type).toUpperCase() === "CREDIT" ? "credit" : "debit";
      const transactionStatus = text(transaction.status).toUpperCase() === "PENDING" ? "pending" : "posted";
      return { id, amountCents, date, description: description.slice(0, 240), direction, transactionStatus, category: text(transaction.category).slice(0, 120) || null };
    }).filter((transaction) => transaction.id && transaction.amountCents > 0 && transaction.date);

    if (!normalized.length) continue;
    const { data: savedTransactions, error: transactionsError } = await service.from("finance_bank_transactions").upsert(
      normalized.map((transaction) => ({
        account_id: savedAccount.id,
        provider_transaction_id: transaction.id,
        transaction_date: transaction.date,
        description: transaction.description,
        amount_cents: transaction.amountCents,
        direction: transaction.direction,
        status: transaction.transactionStatus,
        category: transaction.category,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "provider_transaction_id" },
    ).select("id,provider_transaction_id,transaction_date,description,amount_cents,direction,status");
    if (transactionsError) throw new Error("Não foi possível sincronizar as movimentações bancárias.");
    transactionCount += savedTransactions?.length ?? 0;

    const credits = (savedTransactions ?? []).filter((transaction) => transaction.direction === "credit" && transaction.status === "posted");
    if (credits.length) {
      const { data: savedIncome, error: incomeError } = await service.from("finance_income_entries").upsert(
        credits.map((transaction) => ({
          transaction_date: transaction.transaction_date,
          description: transaction.description,
          amount_cents: transaction.amount_cents,
          fingerprint: incomeFingerprint(transaction.provider_transaction_id),
          source: "open_finance",
          bank_transaction_id: transaction.id,
          created_by: createdBy || null,
        })),
        { onConflict: "fingerprint", ignoreDuplicates: true },
      ).select("id");
      if (incomeError) throw new Error("Não foi possível atualizar as entradas do financeiro.");
      incomeCount += savedIncome?.length ?? 0;
    }
  }

  await service.from("finance_bank_connections").update({ status: "active", error_code: null, last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", connection.id);
  return { institutionName, accounts: accounts.length, transactions: transactionCount, newIncome: incomeCount };
}

export async function syncAllPluggyConnections() {
  const service = getSupabaseServiceClient();
  const { data, error } = await service.from("finance_bank_connections").select("provider_item_id,created_by").neq("status", "disconnected");
  if (error) throw new Error("Não foi possível listar as conexões bancárias.");
  const results = [];
  for (const connection of data ?? []) {
    try {
      results.push({ itemId: connection.provider_item_id, ok: true, result: await syncPluggyItem(connection.provider_item_id, connection.created_by) });
    } catch (error) {
      await service.from("finance_bank_connections").update({ status: "error", error_code: error instanceof Error ? error.message.slice(0, 240) : "sync_error", updated_at: new Date().toISOString() }).eq("provider_item_id", connection.provider_item_id);
      results.push({ itemId: connection.provider_item_id, ok: false });
    }
  }
  return results;
}

