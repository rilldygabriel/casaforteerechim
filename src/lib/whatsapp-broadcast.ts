import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  ensureWhatsappWebhookSubscription,
  normalizeWhatsappPhone,
  sanitizeWhatsappTemplateParameter,
} from "@/lib/whatsapp";

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
const TEMPLATE_NAME = "comunicado_casa_forte_marketing";

type TemplateInfo = {
  name?: string;
  status?: string;
  category?: string;
  language?: string;
};

export type WhatsappBroadcastResult = {
  recipients: number;
  accepted: number;
  rejected: number;
  skipped: number;
};

export type WhatsappBroadcastAudience = "members" | "disciplers";

async function getApprovedTemplate() {
  const accountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accountId || !accessToken) throw new Error("WhatsApp não configurado.");

  const url = new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/message_templates`,
  );
  url.searchParams.set("name", TEMPLATE_NAME);
  url.searchParams.set("fields", "name,status,category,language");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  const template = (payload?.data as TemplateInfo[] | undefined)?.find(
    (item) => item.name === TEMPLATE_NAME && item.language === "pt_BR",
  );

  if (
    !response.ok ||
    template?.status !== "APPROVED" ||
    template.category !== "MARKETING"
  ) {
    throw new Error("O modelo de marketing ainda não está disponível.");
  }

  return template;
}

export async function sendWhatsappBroadcast(
  message: string,
  campaign: string,
  audience: WhatsappBroadcastAudience = "members",
): Promise<WhatsappBroadcastResult> {
  const cleanMessage = sanitizeWhatsappTemplateParameter(message);
  if (!cleanMessage) throw new Error("Mensagem vazia.");

  const template = await getApprovedTemplate();
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!accessToken || !phoneNumberId) throw new Error("WhatsApp não configurado.");

  const service = getSupabaseServiceClient();
  await ensureWhatsappWebhookSubscription();
  let disciplerIds: string[] | null = null;
  if (audience === "disciplers") {
    const { data: roles, error: rolesError } = await service
      .from("discipler_roles")
      .select("member_id");
    if (rolesError) throw new Error("Não foi possível carregar os discipuladores.");
    disciplerIds = [...new Set((roles ?? []).map((role) => role.member_id))];
  }

  const profilesQuery = service.from("member_profiles").select("user_id,full_name,phone");
  const { data: profiles, error: profilesError } = disciplerIds
    ? disciplerIds.length
      ? await profilesQuery.in("user_id", disciplerIds)
      : { data: [], error: null }
    : await profilesQuery;
  if (profilesError) throw new Error("Não foi possível carregar os membros.");

  const recipientMap = new Map<string, string | null>();
  for (const profile of profiles ?? []) {
    const phone = normalizeWhatsappPhone(profile.phone);
    if (phone && !recipientMap.has(phone)) {
      recipientMap.set(phone, profile.full_name || null);
    }
  }
  const phones = Array.from(recipientMap.keys());
  if (!phones.length) return { recipients: 0, accepted: 0, rejected: 0, skipped: 0 };

  const { error: upsertError } = await service.from("whatsapp_conversations").upsert(
    phones.map((phone) => ({ phone, contact_name: recipientMap.get(phone) })),
    { onConflict: "phone", ignoreDuplicates: false },
  );
  if (upsertError) throw new Error("Não foi possível preparar os destinatários.");

  const { data: conversations, error: conversationsError } = await service
    .from("whatsapp_conversations")
    .select("id,phone")
    .in("phone", phones);
  if (conversationsError) throw new Error("Não foi possível preparar as conversas.");

  const conversationIds = (conversations ?? []).map((item) => item.id);
  const { data: existingMessages } = conversationIds.length
    ? await service
        .from("whatsapp_messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
        .eq("body", cleanMessage)
    : { data: [] as { conversation_id: number }[] };
  const alreadySent = new Set((existingMessages ?? []).map((item) => item.conversation_id));

  let accepted = 0;
  let rejected = 0;
  let skipped = 0;

  for (let index = 0; index < (conversations ?? []).length; index += 10) {
    const batch = (conversations ?? []).slice(index, index + 10);
    await Promise.all(
      batch.map(async (conversation) => {
        if (alreadySent.has(conversation.id)) {
          skipped += 1;
          return;
        }

        const placeholderId = `broadcast:${campaign}:${conversation.phone}`;
        const { error: reserveError } = await service.from("whatsapp_messages").insert({
          conversation_id: conversation.id,
          wa_message_id: placeholderId,
          direction: "outbound",
          message_type: "template",
          body: cleanMessage,
          status: "sent",
          raw_payload: {
            campaign,
            state: "reserved",
            category: template.category,
          },
        });
        if (reserveError) {
          rejected += 1;
          return;
        }

        try {
          const response = await fetch(
            `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: conversation.phone,
                type: "template",
                template: {
                  name: TEMPLATE_NAME,
                  language: { code: template.language || "pt_BR" },
                  components: [
                    {
                      type: "body",
                      parameters: [{ type: "text", text: cleanMessage }],
                    },
                  ],
                },
              }),
              signal: AbortSignal.timeout(15_000),
              cache: "no-store",
            },
          );
          const payload = await response.json().catch(() => ({}));
          const messageId = payload?.messages?.[0]?.id as string | undefined;
          if (!response.ok || !messageId) {
            rejected += 1;
            await service
              .from("whatsapp_messages")
              .update({
                status: "failed",
                error_message: String(payload?.error?.message || "Recusada pela Meta").slice(0, 300),
              })
              .eq("wa_message_id", placeholderId);
            return;
          }

          accepted += 1;
          await service
            .from("whatsapp_messages")
            .update({
              wa_message_id: messageId,
              raw_payload: { campaign, response: payload },
            })
            .eq("wa_message_id", placeholderId);
          await service
            .from("whatsapp_conversations")
            .update({
              last_message_at: new Date().toISOString(),
              last_message_preview: cleanMessage.slice(0, 180),
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversation.id);
        } catch (error) {
          rejected += 1;
          await service
            .from("whatsapp_messages")
            .update({
              status: "failed",
              error_message: error instanceof Error ? error.message : "Falha ao enviar",
            })
            .eq("wa_message_id", placeholderId);
        }
      }),
    );
  }

  return { recipients: phones.length, accepted, rejected, skipped };
}
