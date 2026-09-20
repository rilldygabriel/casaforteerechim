import { NextRequest, NextResponse } from "next/server";
import { TICKET_TOKEN } from "@/lib/event-tickets";
import { getEventAdminScope } from "@/lib/event-admin-server";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request: NextRequest) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const respond = (body: Record<string, unknown>, init?: ResponseInit) => applyAuthState(NextResponse.json(body, init));
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return respond({ error: "Entre no painel para ler ingressos." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const token = String(body.token ?? "").trim();
    const redeem = body.redeem === true;
    if (!TICKET_TOKEN.test(token)) return respond({ error: "QR Code inválido." }, { status: 400 });

    const scope = await getEventAdminScope(user.id);
    const { data: ticket } = await scope.service.from("event_tickets")
      .select("id,event_id,registration_id,public_token,status,redeemed_at")
      .eq("public_token", token)
      .maybeSingle();
    if (!ticket || !scope.canManage(ticket.event_id)) return respond({ error: "Ingresso não encontrado para este evento." }, { status: 404 });

    const [{ data: event }, { data: registration }, { data: payment }] = await Promise.all([
      scope.service.from("events").select("title,slug").eq("id", ticket.event_id).maybeSingle(),
      scope.service.from("event_registrations").select("full_name,simple_quantity,double_quantity,order_total_cents,status,archived_at").eq("id", ticket.registration_id).maybeSingle(),
      scope.service.from("mercado_pago_payments").select("status,approved_at").eq("registration_id", ticket.registration_id).eq("status", "approved").order("approved_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!event || event.slug !== "hamburguer-da-casa-20-09" || !registration || registration.archived_at || !payment) {
      return respond({ error: "O pagamento deste ingresso não está confirmado." }, { status: 409 });
    }

    let currentTicket = ticket;
    if (redeem && ticket.status === "valid" && registration.status === "confirmed") {
      const now = new Date().toISOString();
      const { data: redeemedTicket, error } = await scope.service.from("event_tickets")
        .update({ status: "redeemed", redeemed_at: now, redeemed_by: user.id, updated_at: now })
        .eq("id", ticket.id)
        .eq("status", "valid")
        .select("id,event_id,registration_id,public_token,status,redeemed_at")
        .maybeSingle();
      if (error) throw error;
      if (redeemedTicket) currentTicket = redeemedTicket;
    }

    return respond({
      ok: true,
      ticket: {
        code: currentTicket.public_token.split("-")[0].toUpperCase(),
        status: currentTicket.status,
        redeemedAt: currentTicket.redeemed_at,
        eventTitle: event.title,
        fullName: registration.full_name,
        simpleQuantity: Number(registration.simple_quantity),
        doubleQuantity: Number(registration.double_quantity),
        totalCents: Number(registration.order_total_cents),
      },
    });
  } catch (error) {
    console.error("event_ticket_validation_error", error);
    return respond({ error: "Não foi possível conferir este ingresso agora." }, { status: 500 });
  }
}
