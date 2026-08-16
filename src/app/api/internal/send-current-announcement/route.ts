import { createHash } from "node:crypto";
import webPush from "web-push";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { sendWhatsappBroadcast } from "@/lib/whatsapp-broadcast";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOKEN_HASH = "421e854745d9c08b70838798712f4b6f465667a92c3ca1e6ec2a053bc8308837";
const TITLE = "Hoje tem Culto na Casa";
const MESSAGE =
  "boa tarde, hoje é dia de mergulharmos na presença de Deus no culto.. te vejo as 19:00H chama todo mundo bóra adorar ao Rei dos reis..";
const CAMPAIGN = "aviso_culto_2026_08_16_19h";

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
    .maybeSingle();

  let announcementId = existingAnnouncement?.id as string | undefined;
  let pushSent = 0;
  let pushFailed = 0;

  if (!announcementId) {
    const { data: announcement, error: announcementError } = await service
      .from("family_announcements")
      .insert({ title: TITLE, body: MESSAGE, created_by: author.user_id })
      .select("id")
      .single();
    if (announcementError || !announcement) {
      return Response.json({ error: "Não foi possível publicar o aviso" }, { status: 500 });
    }
    announcementId = announcement.id;

    const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
    const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
    if (publicKey && privateKey) {
      webPush.setVapidDetails(
        "mailto:contato@casaforteerechim.app.br",
        publicKey,
        privateKey,
      );
      const { data: approvedProfiles } = await service
        .from("member_profiles")
        .select("user_id")
        .or("approval_status.eq.approved,is_admin.eq.true");
      const approvedUserIds = (approvedProfiles ?? []).map((item) => item.user_id);
      const { data: subscriptions } = approvedUserIds.length
        ? await service
            .from("web_push_subscriptions")
            .select("id,endpoint,p256dh,auth_key")
            .in("user_id", approvedUserIds)
        : { data: [] };

      for (let index = 0; index < (subscriptions ?? []).length; index += 10) {
        const batch = (subscriptions ?? []).slice(index, index + 10);
        await Promise.all(
          batch.map(async (subscription) => {
            try {
              await webPush.sendNotification(
                {
                  endpoint: subscription.endpoint,
                  keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
                },
                JSON.stringify({
                  title: TITLE,
                  body: MESSAGE,
                  tag: `aviso-${announcementId}`,
                  url: "/familia/notificacoes",
                }),
                { TTL: 60 * 60 * 12, urgency: "high" },
              );
              pushSent += 1;
            } catch (error) {
              pushFailed += 1;
              const statusCode =
                typeof error === "object" && error !== null && "statusCode" in error
                  ? Number(error.statusCode)
                  : 0;
              if (statusCode === 404 || statusCode === 410) {
                await service.from("web_push_subscriptions").delete().eq("id", subscription.id);
              }
            }
          }),
        );
      }
    }
  }

  try {
    const whatsapp = await sendWhatsappBroadcast(MESSAGE, CAMPAIGN);
    return Response.json({
      announcement: { id: announcementId, created: !existingAnnouncement },
      push: { sent: pushSent, failed: pushFailed },
      whatsapp,
    });
  } catch (error) {
    return Response.json(
      {
        announcement: { id: announcementId, created: !existingAnnouncement },
        push: { sent: pushSent, failed: pushFailed },
        error: error instanceof Error ? error.message : "Falha no WhatsApp",
      },
      { status: 502 },
    );
  }
}
