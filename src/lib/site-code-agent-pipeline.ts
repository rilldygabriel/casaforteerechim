import { start } from "workflow/api";

import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { isAuthorizedCasaCommandSender, replyToCasaOwner } from "@/lib/whatsapp-admin-commands";
import { mergeCodePullRequest, vercelCommitDeploymentReady } from "@/lib/site-code-agent-github";
import { prepareSiteCodeChange } from "@/workflows/site-code-agent";

const OWNER_USER_ID = "34944370-8853-4c1b-866b-8c80b4e59829";

export async function queueOwnerVisualChange(input: {
  phone: string; conversationId: number; incomingMessageId: string;
  businessPhoneNumberId: string; requestText: string;
}) {
  if (process.env.VERCEL_ENV !== "production" || !process.env.CASA_CODE_AGENT_GATEWAY_KEY) {
    return "O editor visual hospedado ainda não está ativo. Não fiz nenhuma alteração.";
  }
  if (!await isAuthorizedCasaCommandSender(input.phone, input.businessPhoneNumberId)) {
    throw new Error("Remetente não autorizado.");
  }
  const { data, error } = await getSupabaseServiceClient().rpc("queue_site_ai_code_request", {
    p_owner_user_id: OWNER_USER_ID,
    p_conversation_id: input.conversationId,
    p_origin_message_id: input.incomingMessageId,
    p_business_phone_number_id: input.businessPhoneNumberId,
    p_request_text: input.requestText.slice(0, 4000),
  });
  if (error) {
    if (error.message.includes("monthly_executor_budget_exhausted")) {
      return "O limite mensal do editor visual foi alcançado. Não vou iniciar mais execuções pagas neste mês.";
    }
    throw new Error("Não consegui registrar o pedido visual com segurança.");
  }
  return `Recebi seu pedido visual (${String(data).slice(0, 8)}). Vou preparar uma prévia isolada e enviar aqui um código para sua confirmação. Nada será publicado antes disso.`;
}

export async function processQueuedSiteCodeChanges() {
  if (process.env.VERCEL_ENV !== "production" || !process.env.CASA_CODE_AGENT_GATEWAY_KEY) return { disabled: true };
  const service = getSupabaseServiceClient();
  const { data: queued } = await service.from("site_ai_change_requests")
    .select("id,request_text").eq("status", "queued").order("created_at").limit(1);
  for (const row of queued ?? []) {
    const { data: claimed } = await service.from("site_ai_change_requests")
      .update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", row.id).eq("status", "queued").select("id").maybeSingle();
    if (!claimed) continue;
    try { await start(prepareSiteCodeChange, [row.id, row.request_text]); }
    catch (error) {
      await service.from("site_ai_change_requests").update({ status: "failed", error_code: "workflow_start_failed", completed_at: new Date().toISOString() })
        .eq("id", row.id).eq("status", "running");
      console.error("site_code_workflow_start_failed", error instanceof Error ? error.message : "unknown");
    }
  }
  const { data: confirmed } = await service.from("site_ai_change_requests")
    .select("id,pull_request_number,pull_request_head_sha").eq("status", "confirmed").order("created_at").limit(1);
  for (const row of confirmed ?? []) {
    if (!row.pull_request_number || !row.pull_request_head_sha) continue;
    const { data: claimed } = await service.from("site_ai_change_requests")
      .update({ status: "merging", updated_at: new Date().toISOString() })
      .eq("id", row.id).eq("status", "confirmed").select("id").maybeSingle();
    if (!claimed) continue;
    try {
      const merge = await mergeCodePullRequest(row.pull_request_number, row.pull_request_head_sha);
      await service.from("site_ai_change_requests").update({ merge_commit_sha: merge.sha, updated_at: new Date().toISOString() })
        .eq("id", row.id).eq("status", "merging");
    } catch (error) {
      await service.from("site_ai_change_requests").update({ status: "failed", error_code: "merge_failed", completed_at: new Date().toISOString() })
        .eq("id", row.id).eq("status", "merging");
      console.error("site_code_merge_failed", error instanceof Error ? error.message : "unknown");
    }
  }
  // A function can stop after claiming a confirmation or after GitHub accepts the merge.
  // Re-reading the PR makes both cases safe to recover without publishing a second version.
  const { data: interruptedMerges } = await service.from("site_ai_change_requests")
    .select("id,pull_request_number,pull_request_head_sha").eq("status", "merging")
    .is("merge_commit_sha", null).order("created_at").limit(1);
  for (const row of interruptedMerges ?? []) {
    if (!row.pull_request_number || !row.pull_request_head_sha) continue;
    try {
      const merge = await mergeCodePullRequest(row.pull_request_number, row.pull_request_head_sha);
      await service.from("site_ai_change_requests").update({ merge_commit_sha: merge.sha, updated_at: new Date().toISOString() })
        .eq("id", row.id).eq("status", "merging").is("merge_commit_sha", null);
    } catch (error) {
      console.error("site_code_merge_recovery_failed", error instanceof Error ? error.message : "unknown");
    }
  }
  const { data: merging } = await service.from("site_ai_change_requests")
    .select("id,conversation_id,origin_message_id,business_phone_number_id,merge_commit_sha")
    .eq("status", "merging").not("merge_commit_sha", "is", null).order("created_at").limit(3);
  for (const row of merging ?? []) {
    if (!row.merge_commit_sha || !await vercelCommitDeploymentReady(row.merge_commit_sha)) continue;
    const { data: conversation } = await service.from("whatsapp_conversations").select("phone")
      .eq("id", row.conversation_id).maybeSingle();
    const phone = String(conversation?.phone ?? "");
    if (!await isAuthorizedCasaCommandSender(phone, row.business_phone_number_id)) continue;
    const { data: claimed } = await service.from("site_ai_change_requests")
      .update({ status: "published", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", row.id).eq("status", "merging").select("id").maybeSingle();
    if (claimed) await replyToCasaOwner(phone, row.conversation_id,
      `A Vercel confirmou o deploy da mudança visual no site. Confira: https://www.casaforteerechim.app.br/ (versão ${row.merge_commit_sha.slice(0, 8)}).`,
      row.origin_message_id, row.business_phone_number_id);
  }
  return { queued: queued?.length ?? 0, confirmed: confirmed?.length ?? 0, merging: merging?.length ?? 0 };
}
