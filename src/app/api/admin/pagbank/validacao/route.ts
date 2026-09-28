import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/route";
import { buildTestOrder, PAGBANK_TEST_END, PAGBANK_TEST_OWNER, summarizeTestOrder, testIdempotencyKey, type TestMethod } from "@/lib/pagbank-production-test";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const reply = (body: unknown, status = 200) => applyAuthState(NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } }));
  if (request.headers.get("origin") !== "https://www.casaforteerechim.app.br" || process.env.VERCEL_ENV !== "production") return reply({ error: "Validação disponível somente no endereço oficial." }, 403);
  const { data: { user } } = await supabase.auth.getUser();
  if (user?.id !== PAGBANK_TEST_OWNER) return reply({ error: "Acesso restrito ao Pastor Rilldy." }, 403);
  const { data: profile } = await supabase.from("member_profiles").select("full_name,is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin || profile.approval_status !== "approved") return reply({ error: "Conta administrativa não autorizada." }, 403);
  if (Number(request.headers.get("content-length")) > 16000) return reply({ error: "Solicitação muito grande." }, 413);
  const body = await request.json().catch(() => null);
  if (!body || !["pix", "card"].includes(body.method) || !["create", "query"].includes(body.action)) return reply({ error: "Solicitação inválida." }, 400);
  const method = body.method as TestMethod;
  const token = process.env.PAGBANK_TOKEN?.trim();
  if (!token) return reply({ error: "PagBank não configurado." }, 503);
  let path = "/orders";
  let payload: ReturnType<typeof buildTestOrder> | undefined;
  if (body.action === "create") {
    if (Date.now() >= PAGBANK_TEST_END) return reply({ error: "Período de validação encerrado." }, 410);
    if (body.accepted !== true) return reply({ error: "Confirme o teste real de R$ 1,00." }, 400);
    try {
      payload = buildTestOrder({ method, name: profile.full_name, email: user.email || "", taxId: typeof body.taxId === "string" ? body.taxId.replace(/\D/g, "") : "", encryptedCard: typeof body.encryptedCard === "string" ? body.encryptedCard : undefined, holder: typeof body.holder === "string" ? body.holder.slice(0, 100) : undefined });
    } catch (error) { return reply({ error: error instanceof Error ? error.message : "Dados inválidos." }, 400); }
  } else {
    if (typeof body.orderId !== "string" || !/^ORDE_[A-Fa-f0-9-]{36}$/.test(body.orderId)) return reply({ error: "Pedido inválido." }, 400);
    path = `/orders/${body.orderId}`;
  }
  try {
    const response = await fetch(`https://api.pagseguro.com${path}`, { method: payload ? "POST" : "GET", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(25000), headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json", ...(payload ? { "x-idempotency-key": testIdempotencyKey(method, token) } : {}) }, body: payload ? JSON.stringify(payload) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      // Do not expose provider payloads: validation errors can echo CPF/card input.
      console.error("pagbank_production_test_error", { http: response.status, method });
      return reply({ error: `PagBank respondeu HTTP ${response.status}. Não repita o pagamento antes de conferir o resultado.`, http: response.status }, 502);
    }
    const result = summarizeTestOrder(data, method, response.status);
    console.info("pagbank_production_test", result);
    return reply(result);
  } catch {
    return reply({ error: "Não foi possível confirmar o resultado. Não faça outro pagamento; consulte o PagBank antes de tentar novamente." }, 502);
  }
}
