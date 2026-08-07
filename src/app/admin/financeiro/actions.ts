"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { financeFingerprint, parseCurrencyToCents, saoPauloDateKey, type StatementEntry } from "@/lib/finance";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

async function requireAdmin() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("member_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/admin");
  return user;
}

function messageRedirect(kind: "ok" | "error", message: string, month = "") {
  const monthParam = /^\d{4}-\d{2}$/.test(month) ? `month=${month}&` : "";
  redirect(`/admin/financeiro?${monthParam}${kind}=${encodeURIComponent(message)}`);
}

export async function createPayable(formData: FormData) {
  const user = await requireAdmin();
  const description = String(formData.get("description") ?? "").trim();
  const vendor = String(formData.get("vendor") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "").trim();
  const amountCents = parseCurrencyToCents(String(formData.get("amount") ?? ""));
  const notes = String(formData.get("notes") ?? "").trim();
  const month = String(formData.get("returnMonth") ?? "");

  if (description.length < 2 || description.length > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || amountCents <= 0) {
    messageRedirect("error", "Revise a descrição, a data e o valor da conta.", month);
  }

  const { error } = await getSupabaseServiceClient().from("finance_payables").insert({
    description,
    vendor: vendor || null,
    category: category || null,
    due_date: dueDate,
    amount_cents: amountCents,
    notes: notes || null,
    created_by: user.id,
  });
  if (error) messageRedirect("error", "Não foi possível salvar esta conta.", month);
  revalidatePath("/admin/financeiro");
  messageRedirect("ok", "Conta adicionada com sucesso.", month);
}

export async function togglePayableStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");
  const month = String(formData.get("returnMonth") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["pending", "paid"].includes(nextStatus)) {
    messageRedirect("error", "Não foi possível atualizar esta conta.", month);
  }

  const paid = nextStatus === "paid";
  const { error } = await getSupabaseServiceClient().from("finance_payables").update({
    status: nextStatus,
    paid_at: paid ? new Date().toISOString() : null,
    payment_date: paid ? saoPauloDateKey() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) messageRedirect("error", "Não foi possível atualizar esta conta.", month);
  revalidatePath("/admin/financeiro");
  messageRedirect("ok", paid ? "Conta marcada como paga." : "Conta reaberta.", month);
}

export type StatementSaveState = { kind: "idle" | "success" | "error"; message: string };

export async function saveStatementEntries(
  _previous: StatementSaveState,
  formData: FormData,
): Promise<StatementSaveState> {
  const user = await requireAdmin();
  const importId = String(formData.get("importId") ?? "");
  let entries: StatementEntry[] = [];
  try {
    entries = JSON.parse(String(formData.get("entries") ?? "[]")) as StatementEntry[];
  } catch {
    return { kind: "error", message: "Os lançamentos analisados ficaram inválidos." };
  }
  const validEntries = entries.slice(0, 100).filter((entry) =>
    /^\d{4}-\d{2}-\d{2}$/.test(entry.transactionDate) &&
    typeof entry.description === "string" && entry.description.trim().length >= 2 &&
    Number.isSafeInteger(entry.amountCents) && entry.amountCents > 0,
  );
  if (!/^[0-9a-f-]{36}$/i.test(importId) || validEntries.length === 0) {
    return { kind: "error", message: "Escolha ao menos uma entrada para confirmar." };
  }

  const service = getSupabaseServiceClient();
  const payload = validEntries.map((entry) => ({
    transaction_date: entry.transactionDate,
    description: entry.description.trim().slice(0, 240),
    amount_cents: entry.amountCents,
    fingerprint: financeFingerprint(entry),
    source: "statement",
    statement_import_id: importId,
    created_by: user.id,
  }));
  const { data, error } = await service.from("finance_income_entries")
    .upsert(payload, { onConflict: "fingerprint", ignoreDuplicates: true })
    .select("id");
  if (error) return { kind: "error", message: "Não foi possível confirmar as entradas." };

  await service.from("finance_statement_imports").update({
    status: "saved",
    saved_count: data?.length ?? 0,
  }).eq("id", importId).eq("created_by", user.id);
  revalidatePath("/admin/financeiro");
  return {
    kind: "success",
    message: `${data?.length ?? 0} entrada${data?.length === 1 ? " foi salva" : "s foram salvas"}. Itens já existentes não foram duplicados.`,
  };
}
