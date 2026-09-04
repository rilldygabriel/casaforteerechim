import { createHash } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { synchronizePagBankEventPayment, validatePagBankWebhook } from "@/lib/pagbank";

export const runtime = "nodejs";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = text(request.headers.get("x-authenticity-token"));
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const signatureValid = validatePagBankWebhook(rawBody, signature);
  const service = getSupabaseServiceClient();
  let body: Record<string, unknown>;
  try {
    body = object(JSON.parse(rawBody || "{}"));
  } catch {
    return Response.json({ error: "Notificação inválida." }, { status: 400 });
  }
  const paymentId = text(body.reference_id);
  const providerObjectId = text(body.id);

  const { data: previous } = await service.from("pagbank_webhook_events")
    .select("id,status").eq("payload_hash", payloadHash).maybeSingle();
  if (previous?.status === "processed" || previous?.status === "ignored") return Response.json({ ok: true, duplicate: true });

  const auditPayload = {
    payload_hash: payloadHash,
    provider_object_id: providerObjectId || null,
    signature_valid: signatureValid,
    status: signatureValid ? "received" : "failed",
    error_message: signatureValid ? null : "Assinatura inválida",
  };
  const { data: audit, error: auditError } = previous
    ? await service.from("pagbank_webhook_events").update(auditPayload).eq("id", previous.id).select("id").single()
    : await service.from("pagbank_webhook_events").insert(auditPayload).select("id").single();
  if (auditError || !audit) return Response.json({ error: "Falha ao registrar notificação." }, { status: 500 });
  if (!signatureValid) return Response.json({ error: "Assinatura inválida." }, { status: 401 });
  if (!UUID.test(paymentId)) {
    await service.from("pagbank_webhook_events").update({ status: "ignored", processed_at: new Date().toISOString() }).eq("id", audit.id);
    return Response.json({ ok: true, ignored: true });
  }
  try {
    await synchronizePagBankEventPayment(paymentId);
    await service.from("pagbank_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", audit.id);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Falha desconhecida";
    await service.from("pagbank_webhook_events").update({ status: "failed", error_message: message, processed_at: new Date().toISOString() }).eq("id", audit.id);
    console.error("pagbank_webhook_error", message);
    return Response.json({ error: "Falha temporária ao processar notificação." }, { status: 500 });
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
