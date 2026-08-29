import {
  authorizePastoralIntegration,
  cancelPastoralBookingById,
  cancelPastoralSlotById,
  configurePastoralAgenda,
  createPastoralSlot,
  markPastoralBookingReadById,
  personalAgendaAction,
  pastoralSnapshot,
} from "@/lib/pastoral-agenda";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Não autorizado." }, { status: 401 });
}

export async function GET(request: Request) {
  if (!authorizePastoralIntegration(request)) return unauthorized();
  const sourceCalendarId = new URL(request.url).searchParams.get("calendarId") ?? "";
  try { return Response.json(await pastoralSnapshot(sourceCalendarId)); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Falha na integração." }, { status: 400 }); }
}

export async function POST(request: Request) {
  if (!authorizePastoralIntegration(request)) return unauthorized();
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "configure") await configurePastoralAgenda(String(body.calendarId), String(body.title), Boolean(body.isActive));
    else if (action === "publish") await createPastoralSlot({ sourceCalendarId: String(body.calendarId), hostName: String(body.hostName), location: body.location ? String(body.location) : null, startsAt: String(body.startsAt), endsAt: String(body.endsAt) });
    else if (action === "cancel-slot") await cancelPastoralSlotById(String(body.slotId));
    else if (action === "cancel-booking") {
      const booking = await cancelPastoralBookingById(String(body.bookingId));
      if (booking?.source_event_id) await personalAgendaAction("booking-cancelled", { eventId: booking.source_event_id });
    }
    else if (action === "mark-read") await markPastoralBookingReadById(String(body.bookingId));
    else throw new Error("Ação inválida.");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Falha na integração." }, { status: 400 });
  }
}
