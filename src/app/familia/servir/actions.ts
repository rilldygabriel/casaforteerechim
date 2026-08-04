"use server";

import { revalidatePath } from "next/cache";
import webPush from "web-push";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { findMinistry } from "./ministries";

const WHATSAPP_GRAPH_API_VERSION =
  process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
const WHATSAPP_TEMPLATE_NAME = "notificacao_site_casa_forte";
const WHATSAPP_TEMPLATE_LANGUAGE = "pt_BR";

export type ServeActionState = {
  kind: "idle" | "success" | "error";
  message: string;
};

async function notifyLeader(
  payload: { leaderName: string; leaderPhone: string; text: string },
  requestId: string,
) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!accessToken) {
    console.error("serve_request_whatsapp_token_missing", { requestId });
    return false;
  }

  try {
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
          to: payload.leaderPhone,
          type: "template",
          template: {
            name: WHATSAPP_TEMPLATE_NAME,
            language: { code: WHATSAPP_TEMPLATE_LANGUAGE },
            components: [
              {
                type: "body",
                parameters: [{ type: "text", text: payload.text }],
              },
            ],
          },
        }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("serve_request_whatsapp_failed", {
        requestId,
        leaderName: payload.leaderName,
        status: response.status,
        errorCode: result?.error?.code,
      });
      return false;
    }

    console.info("serve_request_whatsapp_sent", {
      requestId,
      leaderName: payload.leaderName,
      messageId: result?.messages?.[0]?.id || "without-message-id",
    });
    return true;
  } catch (error) {
    console.error("serve_request_whatsapp_unavailable", {
      requestId,
      leaderName: payload.leaderName,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}

export async function requestToServe(
  _previousState: ServeActionState,
  formData: FormData,
): Promise<ServeActionState> {
  const ministryKey = String(formData.get("ministryKey") ?? "");
  const ministry = findMinistry(ministryKey);

  if (!ministry) {
    return { kind: "error", message: "Ministério não encontrado." };
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      kind: "error",
      message: "Sua sessão expirou. Entre novamente na Área da Família.",
    };
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("full_name,phone,is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !profile ||
    (!profile.is_admin && profile.approval_status !== "approved")
  ) {
    return {
      kind: "error",
      message: "Seu acesso não está liberado para usar esta área.",
    };
  }

  if (!profile.full_name.trim() || !profile.phone.trim()) {
    return {
      kind: "error",
      message:
        "Complete seu nome e WhatsApp em “Ver meu perfil” antes de continuar.",
    };
  }

  const requestId = crypto.randomUUID();
  const service = getSupabaseServiceClient();
  const { data: existingAssignment } = await service
    .from("ministry_members")
    .select("member_id")
    .eq("member_id", user.id)
    .eq("ministry_key", ministry.key)
    .maybeSingle();

  if (existingAssignment) {
    return {
      kind: "success",
      message: `Você já faz parte do ${ministry.label}.`,
    };
  }

  const { error: requestError } = await service
    .from("ministry_membership_requests")
    .upsert(
      {
        member_id: user.id,
        ministry_key: ministry.key,
        status: "pending",
        reviewed_by: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,ministry_key" },
    );

  if (requestError) {
    console.error("serve_request_save_failed", {
      requestId,
      memberId: user.id,
      ministryKey: ministry.key,
      errorCode: requestError.code,
    });
    return {
      kind: "error",
      message: "Não foi possível registrar seu pedido agora. Tente novamente.",
    };
  }

  const messageText =
    `Olá! ${profile.full_name} tem interesse em servir no Ministério de ` +
    `${ministry.label}. Este é o WhatsApp dele(a): ${profile.phone}. ` +
    "Favor entrar em contato com essa pessoa.";

  const whatsappResults = await Promise.all(
    ministry.leaders.map((leader) =>
      notifyLeader(
        { leaderName: leader.name, leaderPhone: leader.phone, text: messageText },
        requestId,
      ),
    ),
  );

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  let pushSent = 0;

  if (publicKey && privateKey) {
    webPush.setVapidDetails(
      "mailto:contato@casaforteerechim.app.br",
      publicKey,
      privateKey,
    );
    const { data: leaders } = await service
      .from("ministry_leaders")
      .select("member_id")
      .eq("ministry_key", ministry.key);
    const leaderIds = (leaders ?? []).map((leader) => leader.member_id);
    const { data: subscriptions } = leaderIds.length
      ? await service
          .from("web_push_subscriptions")
          .select("id,endpoint,p256dh,auth_key")
          .in("user_id", leaderIds)
      : { data: [] };

    await Promise.all(
      (subscriptions ?? []).map(async (subscription) => {
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
              title: "Novo pedido para servir",
              body: `${profile.full_name} quer servir no ${ministry.label}.`,
              tag: `servir-${ministry.key}-${user.id}`,
              url: "/admin/meu-ministerio",
            }),
            { TTL: 60 * 60 * 24 * 7, urgency: "high" },
          );
          pushSent += 1;
        } catch (pushError) {
          const statusCode =
            typeof pushError === "object" &&
            pushError !== null &&
            "statusCode" in pushError
              ? Number(pushError.statusCode)
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

  revalidatePath("/admin");
  revalidatePath("/admin/meu-ministerio");
  revalidatePath("/familia/lideranca");

  console.info("serve_request_registered", {
    requestId,
    memberId: user.id,
    ministryKey: ministry.key,
    whatsappSent: whatsappResults.some(Boolean),
    pushSent,
  });

  return {
    kind: "success",
    message: `Seu pedido foi enviado à liderança do ${ministry.label}. Em breve alguém vai falar com você.`,
  };
}
