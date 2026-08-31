const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
const TEMPLATE_NAME = "notificacao_site_casa_forte";

let webhookSubscriptionPromise: Promise<boolean> | null = null;

export function normalizeWhatsappPhone(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/**
 * A Meta não aceita quebras de linha, tabulações ou blocos longos de espaços
 * dentro de parâmetros variáveis de modelos do WhatsApp.
 */
export function sanitizeWhatsappTemplateParameter(message: string) {
  return message.replace(/\s+/g, " ").trim().slice(0, 900);
}

/**
 * Garante que a conta do WhatsApp Business continue vinculada a este app.
 * A chamada é idempotente e é feita uma vez por instância do servidor.
 */
export async function ensureWhatsappWebhookSubscription() {
  if (webhookSubscriptionPromise) return webhookSubscriptionPromise;

  webhookSubscriptionPromise = (async () => {
    const accountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim();
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
    if (!accountId || !accessToken) return false;

    try {
      const response = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${accountId}/subscribed_apps`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        },
      );
      const payload = await response.json().catch(() => ({}));
      const subscribed = response.ok && payload?.success === true;
      console.info("whatsapp_webhook_subscription", {
        subscribed,
        status: response.status,
      });
      if (!subscribed) webhookSubscriptionPromise = null;
      return subscribed;
    } catch (error) {
      webhookSubscriptionPromise = null;
      console.warn("whatsapp_webhook_subscription_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  })();

  return webhookSubscriptionPromise;
}

export async function sendWhatsappNotification(phone: string | null | undefined, message: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipient = normalizeWhatsappPhone(phone);
  if (!accessToken || !recipient) {
    return { ok: false as const, error: !accessToken ? "WHATSAPP_ACCESS_TOKEN ausente" : "Telefone inválido" };
  }

  try {
    await ensureWhatsappWebhookSubscription();
    const cleanMessage = sanitizeWhatsappTemplateParameter(message);
    if (!cleanMessage) return { ok: false as const, error: "Mensagem vazia" };
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: recipient,
          type: "template",
          template: {
            name: TEMPLATE_NAME,
            language: { code: "pt_BR" },
            components: [{ type: "body", parameters: [{ type: "text", text: cleanMessage }] }],
          },
        }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false as const, error: JSON.stringify(payload).slice(0, 500) };
    return { ok: true as const, messageId: payload?.messages?.[0]?.id as string | undefined };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Falha ao enviar WhatsApp" };
  }
}

export function formatDiscipleshipDate(date: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
