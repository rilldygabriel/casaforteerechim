import "server-only";

import webPush from "web-push";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

type PushBroadcast = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export async function sendPushToApprovedMembers(message: PushBroadcast) {
  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return { sent: 0, configured: false };

  webPush.setVapidDetails(
    "mailto:contato@casaforteerechim.app.br",
    publicKey,
    privateKey,
  );

  const service = getSupabaseServiceClient();
  const { data: approvedProfiles } = await service
    .from("member_profiles")
    .select("user_id")
    .or("approval_status.eq.approved,is_admin.eq.true");
  const userIds = (approvedProfiles ?? []).map((profile) => profile.user_id);

  if (!userIds.length) return { sent: 0, configured: true };

  const { data: subscriptions } = await service
    .from("web_push_subscriptions")
    .select("id,endpoint,p256dh,auth_key")
    .in("user_id", userIds);

  let sent = 0;
  const list = subscriptions ?? [];

  for (let index = 0; index < list.length; index += 10) {
    const batch = list.slice(index, index + 10);
    await Promise.all(
      batch.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth_key },
            },
            JSON.stringify(message),
            { TTL: 60 * 60 * 24 * 7, urgency: "high" },
          );
          sent += 1;
        } catch (error) {
          const statusCode =
            typeof error === "object" && error !== null && "statusCode" in error
              ? Number(error.statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            await service
              .from("web_push_subscriptions")
              .delete()
              .eq("id", subscription.id);
          }
        }
      }),
    );
  }

  return { sent, configured: true };
}
