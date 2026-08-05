import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getVisitorFollowupStep } from "@/lib/visitor-followup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const { data: visitors } = visitorIds.length ? await supabase.from("visitantes").select("id,nome,data_visita").in("id", visitorIds) : { data: [] };
  const visitorDetails = new Map((visitors ?? []).map((visitor) => [visitor.id, visitor]));
  const [{ data: members }, { data: leaders }, { data: admins }] = await Promise.all([
    supabase.from("ministry_members").select("member_id").eq("ministry_key", "connect_consolidacao"),
    supabase.from("ministry_leaders").select("member_id").eq("ministry_key", "connect_consolidacao"),
    supabase.from("member_profiles").select("user_id").eq("is_admin", true),
  ]);
  const recipientIds = [...new Set([...(members ?? []).map((x) => x.member_id), ...(leaders ?? []).map((x) => x.member_id), ...(admins ?? []).map((x) => x.user_id)])];
  const { data: subscriptions } = recipientIds.length ? await supabase.from("web_push_subscriptions").select("id,user_id,endpoint,p256dh,auth_key,failure_count").in("user_id", recipientIds) : { data: [] };
  let sent = 0, skipped = 0, failed = 0;
  for (const step of steps ?? []) {
    const { error: reserveError } = await supabase.from("visitor_followup_alerts").insert({ followup_step_id: step.id, alert_date: today });
    if (reserveError?.code === "23505") { skipped += 1; continue; }
    if (reserveError) { failed += 1; continue; }
    let recipients = 0;
    for (const subscription of subscriptions ?? []) {
      try {
        const visitor = visitorDetails.get(step.visitor_id);
        const stepTitle = getVisitorFollowupStep(step.step_key, visitor?.data_visita)?.title || "Contato";
        await webPush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } }, JSON.stringify({ title: "Acompanhamento pendente", body: `${visitor?.nome || "Visitante"}: ${stepTitle} ainda não foi registrada.`, tag: `visitor-followup-${step.id}-${today}`, url: `/admin/visitantes/${step.visitor_id}` }), { TTL: 86400, urgency: "high" });
        await supabase.from("web_push_subscriptions").update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq("id", subscription.id);
        sent += 1; recipients += 1;
      } catch (pushError) {
        const code = typeof pushError === "object" && pushError && "statusCode" in pushError ? Number(pushError.statusCode) : null;
        if (code === 404 || code === 410) await supabase.from("web_push_subscriptions").delete().eq("id", subscription.id);
        else await supabase.from("web_push_subscriptions").update({ failure_count: Math.min((subscription.failure_count ?? 0) + 1, 100) }).eq("id", subscription.id);
        failed += 1;
      }
    }
    await supabase.from("visitor_followup_alerts").update({ recipients_count: recipients }).eq("followup_step_id", step.id).eq("alert_date", today);
  }
  return NextResponse.json({ pending: steps?.length ?? 0, recipients: recipientIds.length, sent, skipped, failed });
}
