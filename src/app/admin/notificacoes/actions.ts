"use server";

import { revalidatePath } from "next/cache";
import webPush from "web-push";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { sendWhatsappBroadcast } from "@/lib/whatsapp-broadcast";

export type AnnouncementState = { kind: "idle" | "success" | "error"; message: string };

export async function sendFamilyAnnouncement(
  _previous: AnnouncementState,
  formData: FormData,
): Promise<AnnouncementState> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const sendWhatsApp = formData.get("sendWhatsApp") === "on";
  if (title.length < 3 || title.length > 100 || body.length < 3 || body.length > 2000) {
    return { kind: "error", message: "Revise o título e a mensagem antes de enviar." };
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { kind: "error", message: "Sua sessão expirou." };
  const { data: profile } = await supabase.from("member_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) return { kind: "error", message: "Apenas administradores podem enviar avisos." };

  const service = getSupabaseServiceClient();
  const { data: announcement, error } = await service
    .from("family_announcements")
    .insert({ title, body, created_by: user.id })
    .select("id")
    .single();
  if (error || !announcement) return { kind: "error", message: "Não foi possível salvar o aviso." };

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  let sent = 0;

  if (publicKey && privateKey) {
    webPush.setVapidDetails("mailto:contato@casaforteerechim.app.br", publicKey, privateKey);
    const { data: approvedProfiles } = await service
      .from("member_profiles")
      .select("user_id")
      .or("approval_status.eq.approved,is_admin.eq.true");
    const approvedUserIds = (approvedProfiles ?? []).map((item) => item.user_id);
    const { data: subscriptions } = await service
      .from("web_push_subscriptions")
      .select("id,endpoint,p256dh,auth_key")
      .in("user_id", approvedUserIds.length ? approvedUserIds : ["00000000-0000-0000-0000-000000000000"]);

    const subscriptionList = subscriptions ?? [];
    for (let index = 0; index < subscriptionList.length; index += 10) {
      const batch = subscriptionList.slice(index, index + 10);
      await Promise.all(batch.map(async (subscription) => {
        try {
          await webPush.sendNotification(
            { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
            JSON.stringify({ title, body, tag: `aviso-${announcement.id}`, url: "/familia/notificacoes" }),
            { TTL: 60 * 60 * 24 * 7, urgency: "high" },
          );
          sent += 1;
        } catch (pushError) {
          const statusCode = typeof pushError === "object" && pushError !== null && "statusCode" in pushError ? Number(pushError.statusCode) : 0;
          if (statusCode === 404 || statusCode === 410) {
            await service.from("web_push_subscriptions").delete().eq("id", subscription.id);
          }
        }
      }));
    }
  }

  revalidatePath("/admin/notificacoes");
  revalidatePath("/familia");
  revalidatePath("/familia/notificacoes");

  let whatsappMessage = "";
  if (sendWhatsApp) {
    try {
      const result = await sendWhatsappBroadcast(body, `announcement_${announcement.id}`);
      whatsappMessage = ` WhatsApp: ${result.accepted} aceito${result.accepted === 1 ? "" : "s"} pela Meta, ${result.rejected} recusado${result.rejected === 1 ? "" : "s"}.`;
    } catch {
      whatsappMessage = " O aviso foi publicado, mas o WhatsApp não concluiu o disparo.";
    }
  }

  return {
    kind: "success",
    message: `Aviso publicado para todos. ${sent} aparelho${sent === 1 ? " recebeu" : "s receberam"} a notificação agora.${whatsappMessage}`,
  };
}
