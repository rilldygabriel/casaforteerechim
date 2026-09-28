import { createHmac } from "node:crypto";

export const PAGBANK_TEST_OWNER = "34944370-8853-4c1b-866b-8c80b4e59829";
export const PAGBANK_TEST_AMOUNT = 100;
export const PAGBANK_TEST_END = Date.parse("2026-10-05T03:00:00Z");
export type TestMethod = "pix" | "card";
type Json = Record<string, unknown>;
const obj = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const str = (value: unknown) => typeof value === "string" ? value : "";

export function testReference(method: TestMethod) {
  return `casa-validacao-20260928-${method}`;
}

export function validTestCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) return false;
  for (let size = 9; size <= 10; size++) {
    const sum = [...value.slice(0, size)].reduce((n, c, i) => n + Number(c) * (size + 1 - i), 0);
    if (Number(value[size]) !== (sum % 11 < 2 ? 0 : 11 - sum % 11)) return false;
  }
  return true;
}

export function buildTestOrder(input: { method: TestMethod; name: string; email: string; taxId: string; encryptedCard?: string; holder?: string }) {
  if (!validTestCpf(input.taxId)) throw new Error("Informe um CPF válido.");
  const reference = testReference(input.method);
  if (input.method === "card" && (!input.encryptedCard || input.encryptedCard.length > 10000 || !input.holder)) throw new Error("Preencha e criptografe o cartão.");
  return {
    reference_id: reference,
    customer: { name: input.name, email: input.email, tax_id: input.taxId },
    items: [{ reference_id: reference, name: "Validacao tecnica PagBank - sem ingresso", quantity: 1, unit_amount: PAGBANK_TEST_AMOUNT }],
    charges: [{ reference_id: reference, description: "Validacao tecnica Casa Forte", amount: { value: PAGBANK_TEST_AMOUNT, currency: "BRL" }, payment_method: input.method === "pix"
      ? { type: "PIX", pix: { expiration_date: "2026-09-30T23:59:00-03:00" } }
      : { type: "CREDIT_CARD", installments: 1, capture: true, card: { encrypted: input.encryptedCard, store: false, holder: { name: input.holder, tax_id: input.taxId } } } }],
    notification_urls: ["https://www.casaforteerechim.app.br/api/webhooks/pagbank"],
  };
}

export function summarizeTestOrder(data: unknown, method: TestMethod, http: number) {
  const order = obj(data);
  const charges = Array.isArray(order.charges) ? order.charges.map(obj) : [];
  const charge = charges.find(c => c.reference_id === testReference(method));
  if (order.reference_id !== testReference(method) || !charge || Number(obj(charge.amount).value) !== PAGBANK_TEST_AMOUNT) throw new Error("Resposta não corresponde ao teste de R$ 1,00.");
  const pm = obj(charge.payment_method);
  if (pm.type !== (method === "pix" ? "PIX" : "CREDIT_CARD")) throw new Error("Meio de pagamento divergente.");
  return { method, orderId: str(order.id), chargeId: str(charge.id), reference: testReference(method), amountCents: PAGBANK_TEST_AMOUNT,
    status: str(charge.status), paidAt: str(charge.paid_at), paidCents: Number(obj(obj(charge.amount).summary).paid || 0),
    pixCode: str(obj(charge.qr_code).text), http, checkedAt: new Date().toISOString(),
    paymentResponse: { code: str(obj(charge.payment_response).code), message: str(obj(charge.payment_response).message) },
    environment: "production", note: "Teste isolado; sem ingresso ou lancamento no financeiro do site. Sem CPF, token, PAN ou CVV neste registro." };
}

export function testIdempotencyKey(method: TestMethod, token: string) {
  return createHmac("sha256", token).update(testReference(method)).digest("hex");
}
