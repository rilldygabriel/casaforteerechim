export const ATTENDANCE_OPTIONS = [
  ["not_attending", "Ainda não frequento"],
  ["under_1_month", "Menos de 1 mês"],
  ["1_to_3_months", "De 1 a 3 meses"],
  ["3_to_6_months", "De 3 a 6 meses"],
  ["6_to_12_months", "De 6 meses a 1 ano"],
  ["1_to_2_years", "De 1 a 2 anos"],
  ["over_2_years", "Mais de 2 anos"],
] as const;

export const REGISTRATION_STATUSES = [
  ["awaiting_payment", "Aguardando pagamento"],
  ["pending", "Pendente"],
  ["contacting", "Em contato"],
  ["confirmed", "Confirmado"],
  ["withdrew", "Desistiu"],
  ["baptized", "Batizado"],
  ["cancelled", "Cancelado"],
  ["rejected", "Não elegível"],
] as const;

export const EVENT_STATUSES = [["confirmed", "Confirmado"], ["tentative", "A confirmar"], ["cancelled", "Cancelado"]] as const;
export const ATTENDANCE_VALUES = ATTENDANCE_OPTIONS.map(([value]) => value);
export const REGISTRATION_STATUS_VALUES = REGISTRATION_STATUSES.map(([value]) => value);
export const EVENT_STATUS_VALUES = EVENT_STATUSES.map(([value]) => value);

export type RegistrationInput = { fullName: string; phone: string; attendanceDuration: string; notes: string; consent: boolean };

export function validatePostEncounterRegistration(input: { fullName: string; phone: string; completedEncounter: string }) {
  if (input.fullName.trim().length < 3 || input.fullName.trim().length > 160) return "Informe seu nome completo.";
  const phone = normalizePhone(input.phone);
  if (phone.length < 10 || phone.length > 11) return "Informe um telefone ou WhatsApp válido com DDD.";
  if (input.completedEncounter !== "yes" && input.completedEncounter !== "no") return "Informe se você fez o Encontro com Deus na Casa.";
  return null;
}

export function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  return digits;
}

export function validateRegistration(input: RegistrationInput) {
  if (input.fullName.trim().length < 3 || input.fullName.trim().length > 160) return "Informe seu nome completo.";
  const phone = normalizePhone(input.phone);
  if (phone.length < 10 || phone.length > 11) return "Informe um telefone ou WhatsApp válido com DDD.";
  if (!ATTENDANCE_VALUES.includes(input.attendanceDuration as typeof ATTENDANCE_VALUES[number])) return "Selecione há quanto tempo você frequenta a Casa.";
  if (input.notes.trim().length > 1500) return "As observações devem ter no máximo 1.500 caracteres.";
  if (!input.consent) return "É necessário autorizar o uso dos dados para concluir a inscrição.";
  return null;
}

export function slugifyEvent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function optionLabel(options: readonly (readonly [string, string])[], value: string) {
  return options.find(([key]) => key === value)?.[1] ?? value;
}

export function eventRegistrationState(event: { registration_enabled: boolean; registration_status: string; registration_deadline: string | null; capacity: number | null; registration_count?: number }) {
  if (!event.registration_enabled || event.registration_status !== "open") return { open: false, label: "Inscrições encerradas" };
  if (event.registration_deadline && new Date(event.registration_deadline).getTime() < Date.now()) return { open: false, label: "Prazo encerrado" };
  if (event.capacity !== null && (event.registration_count ?? 0) >= event.capacity) return { open: false, label: "Vagas esgotadas" };
  return { open: true, label: "Inscrições abertas" };
}
