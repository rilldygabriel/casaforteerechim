import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { sendWhatsappNotification } from "@/lib/whatsapp";

export type DiscipleshipDeliveryType = "invitation" | "confirmation" | "one_day" | "two_hours";

export async function sendDiscipleshipWhatsappOnce(input: {
  invitationId: string;
  recipientId: string;
  deliveryType: DiscipleshipDeliveryType;
  phone?: string | null;
  message: string;
}) {
  const service = getSupabaseServiceClient();
  const { data: claimed, error: claimError } = await service.rpc(
    "claim_discipleship_whatsapp_delivery",
    {
      p_invitation_id: input.invitationId,
      p_recipient_id: input.recipientId,
      p_delivery_type: input.deliveryType,
    },
  );

  if (claimError || !claimed) {
    return { ok: false as const, skipped: !claimError, error: claimError?.message ?? "Entrega já reservada." };
  }

  const result = await sendWhatsappNotification(input.phone, input.message);
  await service.from("discipleship_whatsapp_deliveries").update({
    status: result.ok ? "sent" : "failed",
    provider_message_id: result.ok ? result.messageId ?? null : null,
    error_message: result.ok ? null : result.error,
    attempted_at: new Date().toISOString(),
  }).eq("invitation_id", input.invitationId)
    .eq("recipient_id", input.recipientId)
    .eq("delivery_type", input.deliveryType)
    .eq("status", "pending");

  return result.ok
    ? { ok: true as const, skipped: false, messageId: result.messageId }
    : { ok: false as const, skipped: false, error: result.error };
}
