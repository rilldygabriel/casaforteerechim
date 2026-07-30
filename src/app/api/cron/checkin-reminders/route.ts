import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  getCheckinEvent,
  getNextProgramDate,
} from "@/lib/programs";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WHATSAPP_GRAPH_API_VERSION =
  process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
const WHATSAPP_TEMPLATE_NAME = "notificacao_site_casa_forte";

function localWeekday() {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(new Date());
  return weekday === "Sun" ? 0 : weekday === "Wed" ? 3 : -1;
}

function whatsappRecipient(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const eventKey = request.nextUrl.searchParams.get("event") || "";
  const event = getCheckinEvent(eventKey);
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !event ||
    event.weekday !== localWeekday() ||
    !accessToken ||
    !serviceRoleKey
  ) {
    return NextResponse.json(
      { error: "Configuração de lembrete indisponível." },
      { status: 503 },
    );
  }

  const { url } = getSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const eventDate = getNextProgramDate(event.weekday);
  const { data: checkins, error } = await supabase
    .from("culto_checkins")
    .select("id,nome,telefone")
    .eq("event_key", event.key)
    .eq("event_date", eventDate)
    .eq("resposta", "presencial")
    .is("lembrete_enviado_em", null);

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível carregar os lembretes." },
      { status: 503 },
    );
  }

  let sent = 0;
  for (const checkin of checkins ?? []) {
    const recipient = whatsappRecipient(checkin.telefone ?? "");
    if (!recipient) continue;

    const firstName = String(checkin.nome).trim().split(/\s+/)[0];
    const message = `Olá, ${firstName}! Você fez o check-in para o culto de hoje. Te esperamos às ${event.time}. Será um culto abençoado!`;
    const response = await fetch(
      `https://graph.facebook.com/${WHATSAPP_GRAPH_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "template",
          template: {
            name: WHATSAPP_TEMPLATE_NAME,
            language: { code: "pt_BR" },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: message }],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error("checkin_reminder_failed", checkin.id, response.status);
      continue;
    }

    await supabase
      .from("culto_checkins")
      .update({ lembrete_enviado_em: new Date().toISOString() })
      .eq("id", checkin.id)
      .is("lembrete_enviado_em", null);
    sent += 1;
  }

  return NextResponse.json({ event: event.key, pending: checkins?.length, sent });
}
