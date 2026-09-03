import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { sendDiscipleshipWhatsappOnce } from "@/lib/discipleship-whatsapp";
import { formatDiscipleshipDate } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type ReminderKind = "one_day" | "two_hours";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const service = getSupabaseServiceClient();
  const now = Date.now();
  const { data: rows, error } = await service.from("discipleship_invitation_options")
    .select("id,starts_at,invitation_id,discipleship_invitations!inner(id,status,accepted_option_id,relationship_id)")
    .gte("starts_at", new Date(now + 100 * 60_000).toISOString())
    .lte("starts_at", new Date(now + 24 * 60 * 60_000 + 20 * 60_000).toISOString());
  if (error) return NextResponse.json({ error: "Falha ao carregar agendamentos." }, { status: 503 });

  const due: { id: string; startsAt: string; invitationId: string; relationshipId: string; kind: ReminderKind }[] = [];
  for (const row of rows ?? []) {
    const value = row.discipleship_invitations as unknown;
    const invitation = (Array.isArray(value) ? value[0] : value) as { id: string; status: string; accepted_option_id: string | null; relationship_id: string } | undefined;
    if (!invitation || invitation.status !== "accepted" || invitation.accepted_option_id !== row.id) continue;
    const minutes = (new Date(row.starts_at).getTime() - now) / 60_000;
    const kind: ReminderKind | null = minutes >= 1420 && minutes <= 1460 ? "one_day" : minutes >= 100 && minutes <= 140 ? "two_hours" : null;
    if (kind) due.push({ id: row.id, startsAt: row.starts_at, invitationId: invitation.id, relationshipId: invitation.relationship_id, kind });
  }

  let sent = 0;
  for (const item of due) {
    const { data: relationship } = await service.from("discipleship_relationships").select("discipler_id,disciple_id").eq("id", item.relationshipId).is("ended_at", null).maybeSingle();
    if (!relationship) continue;
    const { data: people } = await service.from("member_profiles").select("user_id,full_name,phone").in("user_id", [relationship.discipler_id, relationship.disciple_id]);
    const disciple = people?.find((person) => person.user_id === relationship.disciple_id);
    const discipler = people?.find((person) => person.user_id === relationship.discipler_id);
    const when = formatDiscipleshipDate(item.startsAt);
    const timing = item.kind === "one_day" ? "amanhã" : "daqui a cerca de duas horas";
    const recipients = [
      { id: relationship.discipler_id, phone: discipler?.phone, message: `Lembrete: seu discipulado com ${disciple?.full_name || "seu discípulo"} será ${timing}, em ${when}.` },
      { id: relationship.disciple_id, phone: disciple?.phone, message: `Lembrete: seu discipulado com ${discipler?.full_name || "seu discipulador"} será ${timing}, em ${when}.` },
    ];
    for (const recipient of recipients) {
      const result = await sendDiscipleshipWhatsappOnce({
        invitationId: item.invitationId,
        recipientId: recipient.id,
        deliveryType: item.kind,
        phone: recipient.phone,
        message: recipient.message,
      });
      if (result.ok) sent += 1;
    }
  }
  return NextResponse.json({ checked: rows?.length ?? 0, due: due.length, sent });
}
