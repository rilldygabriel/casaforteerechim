import { createHash } from "node:crypto";
import webPush from "web-push";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOKEN_HASH = "e770334c4c242e48f4e0df706092c9e647b54956b95f6322a33579e0f9e13084";
const TITLE = "Hoje é dia de culto";
const MESSAGE = "Hoje é dia de culto, vamos que eu te vejo lá.";

function authorized(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  return createHash("sha256").update(token).digest("hex") === TOKEN_HASH;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  const service = getSupabaseServiceClient();
  const { data: admins, error: adminsError } = await service
    .from("member_profiles")
    .select("user_id,full_name")
    .eq("is_admin", true);
  if (adminsError || !admins?.length) {
    return Response.json({ error: "Administrador não encontrado" }, { status: 500 });
  }
  const author = admins.find((item) => /rilldy/i.test(item.full_name || "")) ?? admins[0];

  const { data: existingAnnouncement } = await service
    .from("family_announcements")
    .select("id")
    .eq("title", TITLE)
    .eq("body", MESSAGE)
    .gte("created_at", "2026-08-19T00:00:00-03:00")
    .maybeSingle();

  if (existingAnnouncement) {
    return Response.json({ announcement: { id: existingAnnouncement.id, created: false }, push: { sent: 0, failed: 0 }, skipped: true });
  }

  const { data: announcement, error: announcementError } = await service
    .from("family_announcements")
    .insert({ title: TITLE, body: MESSAGE, created_by: author.user_id })
    .select("id")
    .single();
  if (announcementError || !announcement) {
    return Response.json({ error: "Não foi possível publicar o aviso" }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();

  if (publicKey && privateKey) {
    webPush.setVapidDetails("mailto:contato@casaforteerechim.app.br", publicKey, privateKey);
    const { data: approvedProfiles } = await service
      .from("member_profiles")
      .select("user_id")
      .or("approval_status.eq.approved,is_admin.eq.true");
    const userIds = (approvedProfiles ?? []).map((item) => item.user_id);
    const { data: subscriptions } = userIds.length
      ? await service
          .from("web_push_subscriptions")
          .select("id,endpoint,p256dh,auth_key")
          .in("user_id", userIds)
      : { data: [] };

    for (let index = 0; index < (subscriptions ?? []).length; index += 10) {
      await Promise.all((subscriptions ?? []).slice(index, index + 10).map(async (subscription) => {
        try {
          await webPush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
            JSON.stringify({ title: TITLE, body: MESSAGE, tag: `aviso-${announcement.id}`, url: "/familia/notificacoes" }),
            { TTL: 60 * 60 * 12, urgency: "high" },
          );
          sent += 1;
        } catch (error) {
          failed += 1;
          const statusCode = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
          if (statusCode === 404 || statusCode === 410) {
            await service.from("web_push_subscriptions").delete().eq("id", subscription.id);
          }
        }
      }));
    }
  }

  return Response.json({ announcement: { id: announcement.id, created: true }, push: { sent, failed } });
}
