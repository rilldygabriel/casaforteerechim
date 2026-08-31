import { createHash } from "node:crypto";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { sendWhatsappBroadcast } from "@/lib/whatsapp-broadcast";

export const runtime = "nodejs";
export const maxDuration = 60;

const MANUAL_TOKEN_HASH = "ba6dc05fc3557bfc94094a67d3a9375b496b7436079210e5f4e475d41d9b2fec";
const CAMPAIGN = "discipler_team_meeting_2026_09_01";
const MESSAGE = "Olá, discipuladores! Passando para lembrar que amanhã, terça-feira, teremos reunião da equipe. Contamos com a presença de todos. Deus abençoe!";

function authorized(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return createHash("sha256").update(token).digest("hex") === MANUAL_TOKEN_HASH;
}

export async function GET() {
  const service = getSupabaseServiceClient();
  const { data: roles } = await service.from("discipler_roles").select("member_id");
  const { data: messages } = await service.from("whatsapp_messages")
    .select("status")
    .eq("body", MESSAGE);
  const counts = (messages ?? []).reduce<Record<string, number>>((summary, message) => {
    summary[message.status] = (summary[message.status] ?? 0) + 1;
    return summary;
  }, {});
  return Response.json({
    campaign: CAMPAIGN,
    recipients: new Set((roles ?? []).map((role) => role.member_id)).size,
    records: messages?.length ?? 0,
    counts,
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const result = await sendWhatsappBroadcast(MESSAGE, CAMPAIGN, "disciplers");
    return Response.json({ campaign: CAMPAIGN, ...result });
  } catch (error) {
    console.error("discipler_meeting_broadcast_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "O disparo não foi concluído." }, { status: 500 });
  }
}
