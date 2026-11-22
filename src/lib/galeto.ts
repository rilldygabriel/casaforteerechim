export const GALETO_MANAGERS = [
  "34944370-8853-4c1b-866b-8c80b4e59829",
  "4233f7fd-d931-445d-afab-d775d221a68e",
] as const;
export const canManageGaleto = (id: string) => (GALETO_MANAGERS as readonly string[]).includes(id);
export type GaletoAllocation = {
  id: string; name: string; allocated: number; settled: number; picked_up: number;
  settlement_reviewed: boolean; notes: string; version: number; updated_at: string;
};
export type GaletoChange = {
  id: string; allocation_id: string; actor_id: string; created_at: string;
  before_state: GaletoAllocation | null; after_state: GaletoAllocation;
};
export type GaletoInput = Omit<GaletoAllocation, "updated_at">;
export type GaletoResult = { ok: boolean; message: string };
export function validateGaleto(input: GaletoInput): GaletoInput {
  if (!input || typeof input !== "object" || typeof input.id !== "string" || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.id)) throw new Error("Registro inválido.");
  if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 100) throw new Error("Informe o nome, com até 100 caracteres.");
  if (typeof input.notes !== "string" || input.notes.length > 1000) throw new Error("Use até 1.000 caracteres nas observações.");
  if (typeof input.settlement_reviewed !== "boolean" || !Number.isSafeInteger(input.version) || input.version < 0) throw new Error("Registro inválido. Atualize a lista.");
  if (![input.allocated, input.settled, input.picked_up].every(n => Number.isSafeInteger(n) && n >= 0 && n <= 10000)) throw new Error("Informe quantidades inteiras, de 0 a 10.000.");
  if (input.settled > input.allocated || input.picked_up > input.allocated) throw new Error("Acertos e retiradas não podem ultrapassar os ingressos entregues.");
  if (!input.settlement_reviewed && input.settled > 0) throw new Error("Confirme a conferência do pagamento.");
  return { ...input, name: input.name.trim(), notes: input.notes.trim() };
}
export function galetoTotals(rows: GaletoAllocation[]) {
  return rows.reduce((sum, row) => ({
    allocated: sum.allocated + row.allocated, settled: sum.settled + row.settled,
    picked_up: sum.picked_up + row.picked_up,
    unreviewed: sum.unreviewed + (row.settlement_reviewed ? 0 : 1),
  }), { allocated: 0, settled: 0, picked_up: 0, unreviewed: 0 });
}
