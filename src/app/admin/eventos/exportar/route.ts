import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { ATTENDANCE_OPTIONS, REGISTRATION_STATUSES, optionLabel } from "@/lib/events";

function csv(value: unknown) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

export async function GET(request: Request) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Não autorizado", { status: 401 });
  const { data: profile } = await supabase.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin || profile.approval_status !== "approved") return new Response("Sem permissão", { status: 403 });
  const url = new URL(request.url);
  const eventId = url.searchParams.get("evento"); const status = url.searchParams.get("status"); const search = url.searchParams.get("busca")?.toLowerCase() ?? "";
  const { data } = await getSupabaseServiceClient().from("event_registrations").select("*,events(title,start_date)").is("archived_at", null).order("created_at", { ascending: false });
  const rows = (data ?? []).filter((item) => (!eventId || item.event_id === eventId) && (!status || item.status === status) && (!search || item.full_name.toLowerCase().includes(search) || item.phone_normalized.includes(search.replace(/\D/g, ""))));
  const lines = [["Nome completo", "Telefone", "Tempo na Casa", "Fez o Encontro com Deus", "Evento", "Data do evento", "Data da inscrição", "Status", "Observações"].map(csv).join(","), ...rows.map((item) => [item.full_name, item.phone, optionLabel(ATTENDANCE_OPTIONS, item.attendance_duration), item.completed_encounter === null ? "" : item.completed_encounter ? "Sim" : "Não", item.events?.title, item.events?.start_date, item.created_at, optionLabel(REGISTRATION_STATUSES, item.status), item.notes].map(csv).join(","))];
  return new Response(`\uFEFF${lines.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="inscricoes-eventos-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
