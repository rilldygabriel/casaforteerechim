export const MINISTRY_PASTOR_IDS = [
  "34944370-8853-4c1b-866b-8c80b4e59829",
  "4233f7fd-d931-445d-afab-d775d221a68e",
] as const;
export const isMinistryPastor = (id: string) => (MINISTRY_PASTOR_IDS as readonly string[]).includes(id);
export type MinistryProduct = { id: string; name: string; price_cents: number };
export type MinistryOrderItem = MinistryProduct & { quantity: number };
export type MinistryMethod = "pix" | "card" | "cash";
export const METHOD_LABELS = { pix: "Pix · PagSeguro", card: "Cartão · PagSeguro", cash: "Dinheiro · presencial" };
export function validateProducts(value: unknown): MinistryProduct[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) throw new Error("Cadastre de 1 a 10 produtos.");
  const ids = new Set<string>();
  return value.map(raw => {
    if (!raw || typeof raw !== "object") throw new Error("Produto inválido.");
    const product = raw as MinistryProduct;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(product.id) || ids.has(product.id)) throw new Error("Identificação de produto inválida.");
    ids.add(product.id);
    const name = String(product.name || "").trim();
    if (name.length < 2 || name.length > 100 || !Number.isSafeInteger(product.price_cents) || product.price_cents < 1 || product.price_cents > 9999999) throw new Error("Confira o nome e o preço de cada produto.");
    return { id: product.id, name, price_cents: product.price_cents };
  });
}
export function validateMethods(value: unknown): MinistryMethod[] {
  if (!Array.isArray(value) || !value.length || value.some(method => !["pix", "card", "cash"].includes(method))) throw new Error("Escolha pelo menos uma forma de recebimento.");
  return [...new Set(value)] as MinistryMethod[];
}
