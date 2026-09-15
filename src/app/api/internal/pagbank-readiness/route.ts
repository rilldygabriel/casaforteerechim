import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIT_KEY_HASH = "4aaed77a34131a56aa23fa672b3c3f75b3f169f83db8b1c5aaed137e0e647c66";
const PAGBANK_ORDERS_URL = "https://api.pagseguro.com/orders";

function authorized(request: Request) {
  const supplied = request.headers.get("x-pagbank-audit-key")?.trim() ?? "";
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = Buffer.from(AUDIT_KEY_HASH, "hex");
  return suppliedHash.length === expectedHash.length && timingSafeEqual(suppliedHash, expectedHash);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const token = process.env.PAGBANK_TOKEN?.trim();
  if (!token) {
    return Response.json({ configured: false, ready: false, reason: "missing_token" }, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const response = await fetch(PAGBANK_ORDERS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: "{}",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const body = object(await response.json().catch(() => ({})));
  const errors = Array.isArray(body.error_messages)
    ? body.error_messages.map(object)
    : [];
  const code = String(errors[0]?.code ?? body.code ?? "");
  const description = String(errors[0]?.description ?? errors[0]?.message ?? body.message ?? "");
  const authorizationBlocked = response.status === 403 || code === "ACCESS_DENIED";
  const invalidCredential = response.status === 401 || code === "UNAUTHORIZED";
  const result = {
    configured: true,
    ready: !authorizationBlocked && !invalidCredential,
    httpStatus: response.status,
    code,
    description,
    checkedAt: new Date().toISOString(),
  };

  console.info("pagbank_readiness_audit", result);
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
