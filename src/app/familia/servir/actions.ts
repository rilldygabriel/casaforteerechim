"use server";

import { getSupabaseServerClient } from "@/lib/supabase/server";
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

export const INITIAL_SERVE_ACTION_STATE: ServeActionState = {
  kind: "idle",
  message: "",
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
  const messageText =
    `Olá! ${profile.full_name} tem interesse em servir no Ministério de ` +
    `${ministry.label}. Este é o WhatsApp dele(a): ${profile.phone}. ` +
    "Favor entrar em contato com essa pessoa.";

  const results = await Promise.all(
    ministry.leaders.map((leader) =>
      notifyLeader(
        { leaderName: leader.name, leaderPhone: leader.phone, text: messageText },
        requestId,
      ),
    ),
  );

  if (!results.some(Boolean)) {
    return {
      kind: "error",
      message:
        "Não foi possível avisar a liderança agora. Tente novamente em instantes.",
    };
  }

  return {
    kind: "success",
    message: `Avisamos a liderança do ${ministry.label}. Em breve alguém vai falar com você.`,
  };
}
