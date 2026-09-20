import { createHamburgerEventReportPdf } from "@/lib/event-report-pdf";
import { getEventAdminScope } from "@/lib/event-admin-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });

  const scope = await getEventAdminScope(user.id);
  if (!scope.hasAccess) return new Response("Sem permissão", { status: 403 });

  const eventId = new URL(request.url).searchParams.get("evento");
  if (!eventId || !scope.canManage(eventId)) return new Response("Sem permissão para este evento", { status: 403 });

  const { data: event } = await scope.service.from("events").select("id,title,slug,start_date").eq("id", eventId).is("archived_at", null).maybeSingle();
  if (!event || event.slug !== "hamburguer-da-casa-20-09") return new Response("Relatório indisponível para este evento", { status: 404 });

  const { data: payments, error: paymentsError } = await scope.service
    .from("mercado_pago_payments")
    .select("registration_id,amount_cents,net_received_cents,payment_method_id")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .not("registration_id", "is", null)
    .order("approved_at", { ascending: true });
  if (paymentsError) return new Response("Não foi possível preparar o relatório", { status: 500 });

  const registrationIds = (payments ?? []).map((payment) => payment.registration_id).filter((id): id is string => Boolean(id));
  const { data: registrations, error: registrationsError } = registrationIds.length
    ? await scope.service.from("event_registrations").select("id,full_name,simple_quantity,double_quantity").in("id", registrationIds).is("archived_at", null)
    : { data: [], error: null };
  if (registrationsError) return new Response("Não foi possível preparar o relatório", { status: 500 });

  const registrationById = new Map((registrations ?? []).map((registration) => [registration.id, registration]));
  const orders = (payments ?? []).flatMap((payment) => {
    const registration = payment.registration_id ? registrationById.get(payment.registration_id) : null;
    if (!registration) return [];
    return [{
      fullName: registration.full_name,
      simpleQuantity: Number(registration.simple_quantity),
      doubleQuantity: Number(registration.double_quantity),
      grossCents: Number(payment.amount_cents),
      netCents: Number(payment.net_received_cents ?? payment.amount_cents),
      paymentMethod: String(payment.payment_method_id ?? ""),
    }];
  });
  const bytes = await createHamburgerEventReportPdf({ eventTitle: event.title, eventDate: event.start_date, generatedAt: new Date(), orders });

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="relatorio-hamburguer-da-casa-${new Date().toISOString().slice(0, 10)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
