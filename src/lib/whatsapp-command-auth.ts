// Único remetente autorizado a controlar o site pelo WhatsApp oficial.
export const CASA_COMMAND_OWNER_PHONE = "5554993217227";
// A Meta informou este wa_id para uma mensagem real enviada pelo número acima.
const CASA_COMMAND_OWNER_WA_ID = "555493217227";

export function isCasaCommandOwnerPhone(phone: string) {
  const digits = String(phone).replace(/\D/g, "");
  return digits === CASA_COMMAND_OWNER_PHONE ||
    digits === CASA_COMMAND_OWNER_PHONE.slice(2) ||
    digits === CASA_COMMAND_OWNER_WA_ID;
}
