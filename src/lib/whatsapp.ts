const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v23.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
const TEMPLATE_NAME = "notificacao_site_casa_forte";

export function normalizeWhatsappPhone(phone: string | null | undefined) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length < 10) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
}

export async function sendWhatsappNotification(phone: string | null | undefined, message: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const recipient = normalizeWhatsappPhone(phone);
  if (!accessToken || !recipient) {
    return { ok: false as const, error: !accessToken ? "WHATSAPP_ACCESS_TOKEN ausente" : "Telefone inválido" };
  }

  try {
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
            components: [{ type: "body", parameters: [{ type: "text", text: message.slice(0, 900) }] }],
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
