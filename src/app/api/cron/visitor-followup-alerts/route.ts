import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  failure_count: number | null;
};

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return NextResponse.json({ error: "Push indisponível." }, { status: 503 });
  webPush.setVapidDetails("mailto:contato@casaforteerechim.app.br", publicKey, privateKey);
  const supabase = getSupabaseServiceClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const { data: steps, error } = await supabase.from("visitor_followup_steps").select("id,visitor_id,step_key,due_date").lte("due_date", today).is("completed_at", null);
  if (error) return NextResponse.json({ error: "Falha ao carregar etapas." }, { status: 503 });

  const visitorIds = [...new Set((steps ?? []).map((step) => step.visitor_id))];
  const [{ data: members }, { data: leaders }, { data: admins }] = await Promise.all([
    supabase.from("ministry_members").select("member_id").eq("ministry_key", "connect_consolidacao"),
    supabase.from("ministry_leaders").select("member_id").eq("ministry_key", "connect_consolidacao"),
    supabase.from("member_profiles").select("user_id").eq("is_admin", true),
  ]);
  const recipientIds = [...new Set([...(members ?? []).map((x) => x.member_id), ...(leaders ?? []).map((x) => x.member_id), ...(admins ?? []).map((x) => x.user_id)])];
  const { data: subscriptions } = recipientIds.length ? await supabase.from("web_push_subscriptions").select("id,user_id,endpoint,p256dh,auth_key,failure_count").in("user_id", recipientIds) : { data: [] };
  let skipped = 0, reservationFailures = 0;
  const reservedStepIds: number[] = [];
  for (const step of steps ?? []) {
    const { error: reserveError } = await supabase.from("visitor_followup_alerts").insert({ followup_step_id: step.id, alert_date: today });
    if (reserveError?.code === "23505") { skipped += 1; continue; }
    if (reserveError) { reservationFailures += 1; continue; }
    reservedStepIds.push(step.id);
  }

  if (!reservedStepIds.length) {
    return NextResponse.json({ pending: steps?.length ?? 0, pendingVisitors: visitorIds.length, recipients: recipientIds.length, sent: 0, skipped, failed: reservationFailures });
  }

  let sent = 0, failed = reservationFailures;
  const body = visitorIds.length === 1
    ? "Há uma pessoa aguardando acompanhamento. Acesse o Painel da Casa e confira as mensagens pendentes."
    : `Há ${visitorIds.length} pessoas aguardando acompanhamento. Acesse o Painel da Casa e confira as mensagens pendentes.`;

  const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
  for (const subscription of subscriptions ?? []) {
    const current = subscriptionsByUser.get(subscription.user_id) ?? [];
    current.push(subscription);
    subscriptionsByUser.set(subscription.user_id, current);
  }

  for (const userSubscriptions of subscriptionsByUser.values()) {
    let delivered = false;
    for (const subscription of userSubscriptions) {
      try {
        await webPush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
          JSON.stringify({ title: "Lembrete do Connect", body, tag: `visitor-followup-digest-${today}`, url: "/admin/visitantes" }),
          { TTL: 86400, urgency: "normal" },
        );
        await supabase.from("web_push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", subscription.id);
        sent += 1;
        delivered = true;
        break;
      } catch (pushError) {
        const code = typeof pushError === "object" && pushError && "statusCode" in pushError ? Number(pushError.statusCode) : null;
        if (code === 404 || code === 410) await supabase.from("web_push_subscriptions").delete().eq("id", subscription.id);
        else await supabase.from("web_push_subscriptions").update({ failure_count: Math.min((subscription.failure_count ?? 0) + 1, 100) }).eq("id", subscription.id);
      }
    }
    if (!delivered) failed += 1;
  }

  await supabase.from("visitor_followup_alerts").update({ recipients_count: 0 }).in("followup_step_id", reservedStepIds).eq("alert_date", today);
  await supabase.from("visitor_followup_alerts").update({ recipients_count: sent }).eq("followup_step_id", reservedStepIds[0]).eq("alert_date", today);
  return NextResponse.json({ pending: steps?.length ?? 0, pendingVisitors: visitorIds.length, recipients: recipientIds.length, sent, skipped, failed });
}
