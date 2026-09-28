export const EVENT_PAYMENT_PROVIDER = "pagbank" as const;
export const CONTRIBUTION_PAYMENT_PROVIDER = "mercado_pago" as const;

export function eventInstallmentLimit(slug: string) {
  return slug === "hamburguer-da-casa-20-09" ? 1 : 4;
}

export function validateEventPaymentInput(input: Record<string, unknown>, slug: string) {
  if (input.method !== "pix" && input.method !== "card") return "Escolha Pix ou cartão.";
  const cpf = String(input.taxId ?? "").replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return "Informe um CPF válido para o pagamento.";
  for (let size = 9; size <= 10; size++) {
    const sum = [...cpf.slice(0, size)].reduce((total, digit, i) => total + Number(digit) * (size + 1 - i), 0);
    if (Number(cpf[size]) !== (sum % 11 < 2 ? 0 : 11 - sum % 11)) return "Informe um CPF válido para o pagamento.";
  }
  if (input.method === "card") {
    const installments = Number(input.installments ?? 1);
    if (!Number.isInteger(installments) || installments < 1 || installments > eventInstallmentLimit(slug)) return "Número de parcelas inválido para este evento.";
    if (typeof input.encryptedCard !== "string" || input.encryptedCard.length < 50 || input.encryptedCard.length > 10000) return "Os dados do cartão não foram criptografados.";
    if (typeof input.cardHolder !== "string" || input.cardHolder.trim().length < 3) return "Informe o nome impresso no cartão.";
  }
  return null;
}

export function pagBankPaymentStatus(value: string) {
  switch (value.toUpperCase()) {
    case "PAID": return "approved";
    case "IN_ANALYSIS": case "AUTHORIZED": return "in_process";
    case "DECLINED": return "rejected";
    case "CANCELED": case "CANCELLED": return "cancelled";
    case "REFUNDED": return "refunded";
    case "CHARGED_BACK": return "charged_back";
    case "EXPIRED": return "expired";
    default: return "pending";
  }
}
