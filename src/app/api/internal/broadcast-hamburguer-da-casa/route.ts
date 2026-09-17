import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import webPush from "web-push";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 60;

const CAMPAIGN = "hamburguer_da_casa_2026_09_20";
const TITLE = "Hambúrguer da Casa 🍔";
const BODY = "Domingo, 20/09, após o culto. Reserve agora: simples R$ 20 ou duplo R$ 30. Pague por Pix ou cartão.";
const EVENT_URL = "/eventos/hamburguer-da-casa-20-09";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

function announcementId() {
  const hash = createHash("sha256").update(CAMPAIGN).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function GET() {
  const service = getSupabaseServiceClient();
  const { data } = await service.from("family_announcements").select("id,created_at").eq("id", announcementId()).maybeSingle();
  return Response.json({ campaign: CAMPAIGN, published: Boolean(data), announcement: data ?? null });
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const service = getSupabaseServiceClient();
  const id = announcementId();
  const { data: existing } = await service.from("family_announcements").select("id").eq("id", id).maybeSingle();
  if (existing) return Response.json({ campaign: CAMPAIGN, alreadyPublished: true, sent: 0, failed: 0 });

  const { data: admins, error: adminError } = await service.from("member_profiles").select("user_id,phone").eq("is_admin", true).eq("approval_status", "approved");
  const owner = (admins ?? []).find((item) => String(item.phone ?? "").replace(/\D/g, "").endsWith("54993217227")) ?? admins?.[0];
  if (adminError || !owner?.user_id) return Response.json({ error: "Administrador responsável não encontrado." }, { status: 500 });

  const { error: announcementError } = await service.from("family_announcements").insert({ id, title: TITLE, body: `${BODY}\n\nhttps://www.casaforteerechim.app.br${EVENT_URL}`, created_by: owner.user_id });
  if (announcementError) return Response.json({ error: "Não foi possível publicar o aviso." }, { status: 500 });

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return Response.json({ campaign: CAMPAIGN, announcementId: id, sent: 0, failed: 0, warning: "Push não configurado." });

  webPush.setVapidDetails("mailto:contato@casaforteerechim.app.br", publicKey, privateKey);
  const { data: profiles } = await service.from("member_profiles").select("user_id").or("approval_status.eq.approved,is_admin.eq.true");
  const userIds = (profiles ?? []).map((item) => item.user_id);
  const { data: subscriptions } = userIds.length
    ? await service.from("web_push_subscriptions").select("id,endpoint,p256dh,auth_key").in("user_id", userIds)
    : { data: [] };

  let sent = 0;
  let failed = 0;
  for (let index = 0; index < (subscriptions ?? []).length; index += 10) {
    const batch = (subscriptions ?? []).slice(index, index + 10);
    await Promise.all(batch.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth_key } },
          JSON.stringify({ title: TITLE, body: BODY, tag: `aviso-${id}`, url: EVENT_URL }),
          { TTL: 60 * 60 * 24 * 4, urgency: "high" },
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const code = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
        if (code === 404 || code === 410) await service.from("web_push_subscriptions").delete().eq("id", subscription.id);
      }
    }));
  }

  revalidatePath("/admin/notificacoes");
  revalidatePath("/familia");
  revalidatePath("/familia/notificacoes");

  return Response.json({ campaign: CAMPAIGN, announcementId: id, recipients: subscriptions?.length ?? 0, sent, failed });
}
