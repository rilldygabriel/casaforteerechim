// Único remetente autorizado a controlar o site pelo WhatsApp oficial.
export const CASA_COMMAND_OWNER_PHONE = "5554993217227";

export function isCasaCommandOwnerPhone(phone: string) {
  const digits = String(phone).replace(/\D/g, "");
  return digits === CASA_COMMAND_OWNER_PHONE || digits === CASA_COMMAND_OWNER_PHONE.slice(2);
}
