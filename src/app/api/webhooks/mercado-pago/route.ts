import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { synchronizeMercadoPagoPayment, validateMercadoPagoWebhook } from "@/lib/mercado-pago";

export const runtime = "nodejs";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const bodyData = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : {};
  const dataId = text(url.searchParams.get("data.id")) || text(bodyData.id) || text(url.searchParams.get("id"));
  const action = text(body.action) || text(body.type) || text(url.searchParams.get("topic"));
  const requestId = text(request.headers.get("x-request-id"));
  const signature = text(request.headers.get("x-signature"));
  const signatureValid = validateMercadoPagoWebhook({ dataId, requestId, signature });
  if (!signatureValid) return Response.json({ error: "Assinatura inválida." }, { status: 401 });

  const service = getSupabaseServiceClient();
  const auditRequestId = requestId || `${dataId}:${action}`;
  const { data: previous } = await service.from("mercado_pago_webhook_events")
    .select("id,status").eq("request_id", auditRequestId).maybeSingle();
  if (previous?.status === "processed" || previous?.status === "ignored") return Response.json({ ok: true, duplicate: true });

  const auditPayload = {
    request_id: auditRequestId,
    provider_object_id: dataId || null,
    action: action || null,
    signature_valid: true,
    status: "received",
    error_message: null,
  };
  const { data: audit, error: auditError } = previous
    ? await service.from("mercado_pago_webhook_events").update(auditPayload).eq("id", previous.id).select("id").single()
    : await service.from("mercado_pago_webhook_events").insert(auditPayload).select("id").single();
  if (auditError || !audit) return Response.json({ error: "Falha ao registrar notificação." }, { status: 500 });

  const isPayment = /^payment([._]|$)/i.test(action) || text(body.type) === "payment" || text(url.searchParams.get("topic")) === "payment";
  if (!isPayment || !/^\d+$/.test(dataId)) {
    await service.from("mercado_pago_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() }).eq("id", audit.id);
    return Response.json({ ok: true, ignored: true });
  }

  try {
    await synchronizeMercadoPagoPayment(dataId);
    await service.from("mercado_pago_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", audit.id);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida";
    await service.from("mercado_pago_webhook_events").update({ status: "failed", error_message: message, processed_at: new Date().toISOString() }).eq("id", audit.id);
    console.error("mercado_pago_webhook_error", message);
    return Response.json({ error: "Falha temporária ao processar notificação." }, { status: 500 });
  }
}
