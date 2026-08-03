import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";
import { getNextProgramDate } from "@/lib/programs";
import { getPushEvent } from "@/lib/push-events";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localWeekday() {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
  }).format(new Date());
  return weekday === "Sun" ? 0 : weekday === "Wed" ? 3 : weekday === "Fri" ? 5 : -1;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const event = getPushEvent(request.nextUrl.searchParams.get("event") || "");
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (
    !event ||
    event.weekday !== localWeekday() ||
    !publicKey ||
    !privateKey ||
    !serviceRoleKey
  ) {
    return NextResponse.json(
      { error: "Configuração de notificação indisponível." },
      { status: 503 },
    );
  }

  webPush.setVapidDetails(
    "mailto:contato@casaforteerechim.app.br",
    publicKey,
    privateKey,
  );

  const { url } = getSupabaseConfig();
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const eventDate = getNextProgramDate(event.weekday);
  const { data: subscriptions, error } = await supabase
    .from("web_push_subscriptions")
    .select("id,endpoint,p256dh,auth_key,failure_count")
    .contains("enabled_events", [event.key]);

  if (error) {
    console.error("web_push_subscriptions_load_failed", error.code);
    return NextResponse.json(
      { error: "Não foi possível carregar as notificações." },
      { status: 503 },
    );
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const subscription of subscriptions ?? []) {
    const { error: reservationError } = await supabase
      .from("web_push_deliveries")
      .insert({
        subscription_id: subscription.id,
        event_key: event.key,
        event_date: eventDate,
      });

    if (reservationError?.code === "23505") {
      skipped += 1;
      continue;
    }

    if (reservationError) {
      failed += 1;
      console.error("web_push_delivery_reserve_failed", reservationError.code);
      continue;
    }

    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth_key,
          },
        },
        JSON.stringify({
          title: "Casa Forte",
          body: `Hoje tem ${event.title} às ${event.time}. Não ande sozinho. Vem pra casa!`,
          tag: `${event.key}-${eventDate}`,
          url: "/#proximos-passos",
        }),
        { TTL: 60 * 60 * 3, urgency: "high" },
      );

      await Promise.all([
        supabase
          .from("web_push_deliveries")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("subscription_id", subscription.id)
          .eq("event_key", event.key)
          .eq("event_date", eventDate),
        supabase
          .from("web_push_subscriptions")
          .update({
            last_success_at: new Date().toISOString(),
            failure_count: 0,
          })
          .eq("id", subscription.id),
      ]);
      sent += 1;
    } catch (pushError) {
      const statusCode =
        typeof pushError === "object" &&
        pushError !== null &&
        "statusCode" in pushError &&
        typeof pushError.statusCode === "number"
          ? pushError.statusCode
          : null;

      await supabase
        .from("web_push_deliveries")
        .update({ status: "failed", error_code: statusCode })
        .eq("subscription_id", subscription.id)
        .eq("event_key", event.key)
        .eq("event_date", eventDate);

      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from("web_push_subscriptions")
          .delete()
          .eq("id", subscription.id);
      } else {
        await supabase
          .from("web_push_subscriptions")
          .update({ failure_count: Math.min((subscription.failure_count ?? 0) + 1, 100) })
          .eq("id", subscription.id);
      }
      failed += 1;
      console.error("web_push_delivery_failed", subscription.id, statusCode);
    }
  }

  return NextResponse.json({
    event: event.key,
    total: subscriptions?.length ?? 0,
    sent,
    failed,
    skipped,
  });
}
