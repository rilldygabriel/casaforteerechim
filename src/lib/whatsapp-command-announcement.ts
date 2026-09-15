import { revalidatePath } from "next/cache";
import webPush from "web-push";
import { createHash } from "node:crypto";

import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { sendWhatsappBroadcast, verifyWhatsappBroadcastTemplate } from "@/lib/whatsapp-broadcast";

export async function publishWhatsappCommandAnnouncement(input: { ownerUserId: string; title: string; body: string; campaign: string }) {
  await verifyWhatsappBroadcastTemplate();
  const service = getSupabaseServiceClient();
  const hash = createHash("sha256").update(input.campaign).digest("hex");
  const announcementId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const { data: existing } = await service.from("family_announcements")
    .select("id").eq("id", announcementId).maybeSingle();
  const { data: created, error } = existing
    ? { data: existing, error: null }
    : await service.from("family_announcements").insert({ id: announcementId, title: input.title, body: input.body, created_by: input.ownerUserId }).select("id").single();
  if (error || !created) throw new Error("Não foi possível publicar o aviso no site.");

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  let pushSent = 0;
  if (publicKey && privateKey && !existing) {
    webPush.setVapidDetails("mailto:contato@casaforteerechim.app.br", publicKey, privateKey);
    const { data: profiles, error: profilesError } = await service.from("member_profiles").select("user_id")
      .or("approval_status.eq.approved,is_admin.eq.true");
    if (profilesError) console.warn("casa_command_push_members_failed", { code: profilesError.code });
    const ids = (profiles ?? []).map((profile) => profile.user_id);
    if (ids.length) {
      const { data: subscriptions, error: subscriptionError } = await service.from("web_push_subscriptions")
        .select("endpoint,p256dh,auth_key").in("user_id", ids);
      if (subscriptionError) console.warn("casa_command_push_subscriptions_failed", { code: subscriptionError.code });
      for (let index = 0; index < (subscriptions ?? []).length; index += 10) {
        const batch = (subscriptions ?? []).slice(index, index + 10);
        const results = await Promise.allSettled(batch.map((subscription) => webPush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
          JSON.stringify({ title: input.title, body: input.body, tag: `aviso-${created.id}`, url: "/familia/notificacoes" }),
          { TTL: 60 * 60 * 24 * 7, urgency: "high" },
        )));
        pushSent += results.filter((result) => result.status === "fulfilled").length;
      }
    }
  }

  revalidatePath("/admin/notificacoes");
  revalidatePath("/familia");
  revalidatePath("/familia/notificacoes");
  const whatsapp = await sendWhatsappBroadcast(input.body, input.campaign);
  return { announcementId: created.id, pushSent, whatsapp };
}
