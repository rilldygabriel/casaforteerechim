import "server-only";

import { TICKET_TOKEN } from "@/lib/event-ticket-token";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const SITE_URL = "https://www.casaforteerechim.app.br";
export { TICKET_TOKEN };

export function eventTicketUrl(token: string) {
  return `${SITE_URL}/ingressos/${encodeURIComponent(token)}`;
}

export async function ensureEventTicket(input: { eventId: string; registrationId: string }) {
  const service = getSupabaseServiceClient();
  const { data: existing } = await service
    .from("event_tickets")
    .select("public_token,status")
    .eq("registration_id", input.registrationId)
    .maybeSingle();

  if (existing) {
    if (existing.status === "cancelled") {
      const { data, error } = await service
        .from("event_tickets")
        .update({ status: "valid", redeemed_at: null, redeemed_by: null, updated_at: new Date().toISOString() })
        .eq("registration_id", input.registrationId)
        .select("public_token,status")
        .single();
      if (error) throw new Error("Não foi possível reativar o ingresso.");
      return { token: data.public_token, status: data.status, url: eventTicketUrl(data.public_token) };
    }
    return { token: existing.public_token, status: existing.status, url: eventTicketUrl(existing.public_token) };
  }

  const { data, error } = await service
    .from("event_tickets")
    .insert({ event_id: input.eventId, registration_id: input.registrationId })
    .select("public_token,status")
    .single();
  if (error) throw new Error("Não foi possível emitir o ingresso.");
  return { token: data.public_token, status: data.status, url: eventTicketUrl(data.public_token) };
}

export async function cancelEventTicket(registrationId: string) {
  const { error } = await getSupabaseServiceClient()
    .from("event_tickets")
    .update({ status: "cancelled", redeemed_at: null, redeemed_by: null, updated_at: new Date().toISOString() })
    .eq("registration_id", registrationId)
    .neq("status", "redeemed");
  if (error) console.error("event_ticket_cancel_error", error);
}
