export const TICKET_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseEventTicketToken(value: string) {
  const trimmed = value.trim();
  if (TICKET_TOKEN.test(trimmed)) return trimmed;
  try {
    const part = new URL(trimmed).pathname.split("/").filter(Boolean).at(-1) || "";
    return TICKET_TOKEN.test(part) ? part : "";
  } catch {
    return "";
  }
}
