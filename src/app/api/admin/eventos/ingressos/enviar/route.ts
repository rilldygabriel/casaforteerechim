import { NextRequest, NextResponse } from "next/server";
import { deliverHamburgerTickets } from "@/lib/event-ticket-delivery";
import { getEventAdminScope } from "@/lib/event-admin-server";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const respond = (body: Record<string, unknown>, init?: ResponseInit) => applyAuthState(NextResponse.json(body, init));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return respond({ error: "Entre no painel para enviar os ingressos." }, { status: 401 });
  try {
    const scope = await getEventAdminScope(user.id);
    const { data: event } = await scope.service.from("events").select("id,slug").eq("slug", "hamburguer-da-casa-20-09").is("archived_at", null).maybeSingle();
    if (!event || !scope.canManage(event.id)) return respond({ error: "Você não possui acesso a este evento." }, { status: 403 });
    const summary = await deliverHamburgerTickets(event.id);
    return respond({ ok: true, summary });
  } catch (error) {
    console.error("event_ticket_delivery_error", error);
    return respond({ error: "Não foi possível concluir o envio agora." }, { status: 500 });
  }
}
