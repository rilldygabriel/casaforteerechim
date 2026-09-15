import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { vercelCommitDeploymentReady } from "@/lib/site-code-agent-github";

const CONFIRMATION = /^CASA\s+(CONFIRMAR|CANCELAR)\s+([A-F0-9]{8})$/i;

export async function siteCodeConfirmationAnswer(conversationId: number, body: string): Promise<string | null> {
  const match = body.trim().match(CONFIRMATION);
  if (!match) return null;
  const service = getSupabaseServiceClient();
  const { data: request, error } = await service.from("site_ai_change_requests")
    .select("id,status,pull_request_head_sha,confirmation_expires_at")
    .eq("conversation_id", conversationId).eq("confirmation_code", match[2].toUpperCase()).maybeSingle();
  if (error) throw new Error("Não consegui conferir a prévia de estilo.");
  if (!request) return null;
  if (request.status !== "awaiting_confirmation") return "Essa prévia já foi usada, cancelada ou encerrada. Não executei outra vez.";
  if (!request.confirmation_expires_at || new Date(request.confirmation_expires_at).getTime() < Date.now()) {
    await service.from("site_ai_change_requests").update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", request.id).eq("status", "awaiting_confirmation");
    return "O código da prévia expirou. Nenhuma mudança foi publicada.";
  }
  if (match[1].toUpperCase() === "CANCELAR") {
    await service.from("site_ai_change_requests").update({ status: "cancelled", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", request.id).eq("status", "awaiting_confirmation");
    return "Prévia cancelada. A produção não foi alterada.";
  }
  if (!request.pull_request_head_sha || !await vercelCommitDeploymentReady(request.pull_request_head_sha)) {
    return "A prévia da Vercel ainda não terminou. Não publiquei; tente o mesmo código quando ela estiver pronta.";
  }
  const { data: claimed, error: claimError } = await service.from("site_ai_change_requests")
    .update({ status: "confirmed", updated_at: new Date().toISOString() })
    .eq("id", request.id).eq("status", "awaiting_confirmation").select("id").maybeSingle();
  if (claimError || !claimed) return "Essa confirmação já foi recebida. Nada será executado duas vezes.";
  return "Confirmação recebida. Vou publicar exatamente a prévia que você aprovou e avisar quando a Vercel concluir.";
}
