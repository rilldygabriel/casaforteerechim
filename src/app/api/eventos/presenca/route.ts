import { NextResponse } from "next/server";
import { CHURCH_EVENTS, getSaoPauloDateKey, type ChurchEvent } from "@/lib/calendar-events";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

async function resolveEvent(eventKey: string): Promise<ChurchEvent | null> {
  const localEvent = CHURCH_EVENTS.find((item) => item.id === eventKey);
  if (localEvent) return localEvent;
  if (!eventKey.startsWith("database-")) return null;

  const id = eventKey.slice("database-".length);
  const service = getSupabaseServiceClient();
  const { data } = await service
    .from("events")
    .select("id,title,start_date,start_time,status,is_public,archived_at")
    .eq("id", id)
    .maybeSingle();
  if (!data || !data.is_public || data.archived_at) return null;
  return {
    id: eventKey,
    title: data.title,
    startDate: data.start_date,
    startTime: data.start_time?.slice(0, 5) ?? undefined,
    category: "Eventos especiais",
    status: data.status,
  };
}

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ confirmedEventKeys: [], authenticated: false }, { status: 401 });

  const { data, error } = await supabase
    .from("event_attendance_confirmations")
    .select("event_key")
    .eq("user_id", user.id)
    .eq("status", "confirmed");
  if (error) return NextResponse.json({ error: "Não foi possível consultar suas confirmações." }, { status: 500 });
  return NextResponse.json({ confirmedEventKeys: (data ?? []).map((item) => item.event_key), authenticated: true });
}

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na Área da Família para confirmar sua presença." }, { status: 401 });

  const body = await request.json().catch(() => null) as { eventKey?: unknown; confirmed?: unknown } | null;
  const eventKey = typeof body?.eventKey === "string" ? body.eventKey.trim() : "";
  const confirmed = body?.confirmed === true;
  if (!eventKey || eventKey.length > 160 || typeof body?.confirmed !== "boolean") {
    return NextResponse.json({ error: "Confirmação inválida." }, { status: 400 });
  }

  const [event, profileResult] = await Promise.all([
    resolveEvent(eventKey),
    supabase.from("member_profiles").select("approval_status").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!event || event.status === "cancelled") return NextResponse.json({ error: "Esta programação não está disponível." }, { status: 404 });
  if ((event.endDate ?? event.startDate) < getSaoPauloDateKey()) return NextResponse.json({ error: "Não é possível confirmar presença em uma programação que já terminou." }, { status: 400 });
  if (profileResult.data?.approval_status !== "approved") return NextResponse.json({ error: "Seu cadastro precisa estar aprovado para confirmar presença." }, { status: 403 });

  const service = getSupabaseServiceClient();
  const { error } = await service.from("event_attendance_confirmations").upsert({
    event_key: event.id,
    event_title: event.title,
    event_date: event.startDate,
    event_time: event.startTime ?? null,
    user_id: user.id,
    status: confirmed ? "confirmed" : "cancelled",
    updated_at: new Date().toISOString(),
  }, { onConflict: "event_key,user_id" });
  if (error) return NextResponse.json({ error: "Não foi possível salvar sua confirmação." }, { status: 500 });
  return NextResponse.json({ confirmed });
}
