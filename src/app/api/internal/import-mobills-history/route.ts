import { NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const ONE_TIME_IMPORT_TOKEN = "mobills-20260812-cf-7f931b6d";

type ImportEntry = {
  transaction_date: string;
  description: string;
  category?: string | null;
  account_name?: string | null;
  amount_cents: number;
  direction: "credit" | "debit";
  source_fingerprint: string;
};

export async function POST(request: Request) {
  if (request.headers.get("x-import-token") !== ONE_TIME_IMPORT_TOKEN) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { entries?: ImportEntry[] } | null;
  const entries = body?.entries;
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > 1000) {
    return NextResponse.json({ error: "Carga inválida." }, { status: 400 });
  }

  const valid = entries.every((entry) =>
    /^\d{4}-\d{2}-\d{2}$/.test(entry.transaction_date) &&
    typeof entry.description === "string" && entry.description.length > 0 && entry.description.length <= 240 &&
    Number.isSafeInteger(entry.amount_cents) && entry.amount_cents > 0 &&
    (entry.direction === "credit" || entry.direction === "debit") &&
    /^[a-f0-9]{64}$/.test(entry.source_fingerprint)
  );
  if (!valid) return NextResponse.json({ error: "Há lançamentos inválidos na carga." }, { status: 400 });

  const service = getSupabaseServiceClient();
  const { data, error } = await service.from("finance_ledger_entries").upsert(
    entries.map((entry) => ({ ...entry, source: "mobills" })),
    { onConflict: "source_fingerprint" }
  ).select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data?.length ?? 0 });
}
