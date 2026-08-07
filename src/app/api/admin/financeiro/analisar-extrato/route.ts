import { getVercelOidcToken } from "@vercel/oidc";
import { financeFingerprint, type StatementEntry } from "@/lib/finance";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const VERCEL_TEAM_ID = "team_Pw24QkatuwWyFJiYuYCKi12Z";
const VERCEL_PROJECT_ID = "prj_My9r71EBQYchsF5T97S35WFXV8Kg";

type StatementAnalysis = {
  periodStart: string | null;
  periodEnd: string | null;
  entries: StatementEntry[];
};

function responseText(value: unknown) {
  if (!value || typeof value !== "object" || !("output" in value) || !Array.isArray(value.output)) return "";
  for (const item of value.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const part of item.content) {
      if (part && typeof part === "object" && "type" in part && part.type === "output_text" && "text" in part && typeof part.text === "string") return part.text;
    }
  }
  return "";
}

function isAnalysis(value: unknown): value is StatementAnalysis {
  if (!value || typeof value !== "object") return false;
  const analysis = value as Record<string, unknown>;
  return (
    (analysis.periodStart === null || typeof analysis.periodStart === "string") &&
    (analysis.periodEnd === null || typeof analysis.periodEnd === "string") &&
    Array.isArray(analysis.entries) && analysis.entries.length <= 100 &&
    analysis.entries.every((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const candidate = entry as Record<string, unknown>;
      return typeof candidate.transactionDate === "string" && typeof candidate.description === "string" && Number.isSafeInteger(candidate.amountCents) && Number(candidate.amountCents) > 0;
    })
  );
}

function json(message: string, status: number, extra: Record<string, unknown> = {}) {
  return Response.json({ ok: status < 400, message, ...extra }, { status });
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json("Sua sessão expirou.", 401);
  const { data: profile } = await supabase.from("member_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) return json("Acesso restrito aos administradores.", 403);

  const formData = await request.formData();
  const file = formData.get("statement");
  if (!(file instanceof File)) return json("Escolha uma foto do extrato.", 400);
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024) {
    return json("Envie uma imagem JPG, PNG ou WEBP com até 8 MB.", 400);
  }

  const service = getSupabaseServiceClient();
  const { data: lastEntry } = await service.from("finance_income_entries")
    .select("transaction_date")
    .order("transaction_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: statementImport, error: importError } = await service.from("finance_statement_imports")
    .insert({ file_name: file.name.slice(0, 240), created_by: user.id })
    .select("id")
    .single();
  if (importError || !statementImport) return json("Não foi possível iniciar a análise.", 500);

  try {
    const image = Buffer.from(await file.arrayBuffer());
    const minimumDate = lastEntry?.transaction_date ?? "nenhum lançamento anterior";
    const oidcToken = await getVercelOidcToken({ team: VERCEL_TEAM_ID, project: VERCEL_PROJECT_ID, expirationBufferMs: 10_000 });
    const gatewayResponse = await fetch("https://ai-gateway.vercel.sh/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${oidcToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        store: false,
        reasoning: { effort: "none" },
        metadata: { feature: "finance-statement", admin_user_id: user.id },
        input: [{ role: "user", content: [
          { type: "input_text", text: `Leia este extrato bancário brasileiro com máxima precisão. Extraia somente créditos/entradas de dinheiro, nunca débitos, saldos, limites ou totais. A última data já lançada no sistema é ${minimumDate}; inclua movimentos dessa data em diante, pois o sistema eliminará duplicados. Datas devem ser AAAA-MM-DD, valores devem ser centavos inteiros positivos e descrições devem copiar de forma curta o texto do extrato. Se algo estiver ilegível, não invente e simplesmente omita. Informe também o início e o fim visíveis do período, ou null.` },
          { type: "input_image", image_url: `data:${file.type};base64,${image.toString("base64")}`, detail: "original" },
        ] }],
        text: { format: {
          type: "json_schema",
          name: "statement_entries",
          strict: true,
          schema: {
            type: "object",
            properties: {
              periodStart: { type: ["string", "null"] },
              periodEnd: { type: ["string", "null"] },
              entries: { type: "array", maxItems: 100, items: {
                type: "object",
                properties: {
                  transactionDate: { type: "string" },
                  description: { type: "string" },
                  amountCents: { type: "integer", minimum: 1 },
                },
                required: ["transactionDate", "description", "amountCents"],
                additionalProperties: false,
              } },
            },
            required: ["periodStart", "periodEnd", "entries"],
            additionalProperties: false,
          },
        } },
      }),
      signal: AbortSignal.timeout(55_000),
    });
    const gatewayResult = await gatewayResponse.json() as unknown;
    if (!gatewayResponse.ok) throw new Error(`AI Gateway respondeu ${gatewayResponse.status}`);
    const outputText = responseText(gatewayResult);
    const result = JSON.parse(outputText) as unknown;
    if (!isAnalysis(result)) throw new Error("Formato inesperado na leitura do extrato");

    const extracted = result.entries.filter((entry) =>
      /^\d{4}-\d{2}-\d{2}$/.test(entry.transactionDate) &&
      (!lastEntry?.transaction_date || entry.transactionDate >= lastEntry.transaction_date),
    ) as StatementEntry[];
    const fingerprints = extracted.map(financeFingerprint);
    const { data: existing } = fingerprints.length
      ? await service.from("finance_income_entries").select("fingerprint").in("fingerprint", fingerprints)
      : { data: [] as { fingerprint: string }[] };
    const existingSet = new Set((existing ?? []).map((item) => item.fingerprint));
    const entries = extracted.filter((entry) => !existingSet.has(financeFingerprint(entry)));

    await service.from("finance_statement_imports").update({
      status: "review",
      period_start: result.periodStart && /^\d{4}-\d{2}-\d{2}$/.test(result.periodStart) ? result.periodStart : null,
      period_end: result.periodEnd && /^\d{4}-\d{2}-\d{2}$/.test(result.periodEnd) ? result.periodEnd : null,
      extracted_count: entries.length,
      analyzed_at: new Date().toISOString(),
    }).eq("id", statementImport.id);

    return json("Análise concluída. Confira antes de salvar.", 200, {
      importId: statementImport.id,
      entries,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      lastEntryDate: lastEntry?.transaction_date ?? null,
    });
  } catch (error) {
    console.error("finance_statement_analysis_failed", { importId: statementImport.id, error });
    await service.from("finance_statement_imports").update({
      status: "failed",
      error_message: "Falha ao analisar a imagem.",
      analyzed_at: new Date().toISOString(),
    }).eq("id", statementImport.id);
    return json("Não consegui ler esse extrato. Tente uma foto mais nítida e reta.", 502);
  }
}
