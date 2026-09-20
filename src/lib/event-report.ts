export type PaidBurgerOrder = {
  fullName: string;
  simpleQuantity: number;
  doubleQuantity: number;
  grossCents: number;
  netCents: number;
  paymentMethod: string;
};

export function summarizeBurgerOrders(orders: readonly PaidBurgerOrder[]) {
  return orders.reduce(
    (summary, order) => ({
      paidOrders: summary.paidOrders + 1,
      simpleQuantity: summary.simpleQuantity + order.simpleQuantity,
      doubleQuantity: summary.doubleQuantity + order.doubleQuantity,
      totalItems: summary.totalItems + order.simpleQuantity + order.doubleQuantity,
      grossCents: summary.grossCents + order.grossCents,
      feeCents: summary.feeCents + Math.max(order.grossCents - order.netCents, 0),
      netCents: summary.netCents + order.netCents,
    }),
    { paidOrders: 0, simpleQuantity: 0, doubleQuantity: 0, totalItems: 0, grossCents: 0, feeCents: 0, netCents: 0 },
  );
}

export function paymentMethodLabel(method: string) {
  if (method === "pix") return "Pix";
  if (method === "cash") return "Dinheiro";
  if (["visa", "master", "amex", "elo", "hipercard"].includes(method)) return "Cartão";
  return method ? method.replaceAll("_", " ") : "Não informado";
}
