import { randomUUID } from "node:crypto";
import { generateText, gateway, jsonSchema, Output, transcribe } from "ai";

import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { handleCasaCommand, isAuthorizedCasaCommandSender, replyToCasaOwner } from "@/lib/whatsapp-admin-commands";
import { parseCasaCommand } from "@/lib/whatsapp-command-parser";
import { saveOwnerEventPhoto } from "@/lib/whatsapp-event-photo";

const LANGUAGE_MODEL = "openai/gpt-5.6-terra";
const TRANSCRIPTION_MODEL = "openai/whisper-1";
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

type OwnerQuery = "members" | "visitor_followups" | "event_registrations";
type BotDecision = { intent: "command" | "clarify" | "agenda_stats" | "owner_query" | "site_change"; command: string; reply: string; query: OwnerQuery | ""; subject: string };
type BotState = {
  state: "queued" | "processing" | "responding" | "completed" | "failed";
  businessPhoneNumberId: string;
  generationId?: string;
  startedAt?: string;
  transcript?: string;
  decision?: BotDecision;
  model?: string;
  usage?: unknown;
  error?: string;
};
type IncomingPayload = { casa_bot: BotState; audio?: { id?: string }; image?: { id?: string; caption?: string }; type?: string;
  casa_event_photo?: { path: string; state: "stored" }; [key: string]: unknown };

const decisionSchema = jsonSchema<BotDecision>({
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["command", "clarify", "agenda_stats", "owner_query", "site_change"] },
    command: { type: "string", maxLength: 1400 },
    reply: { type: "string", maxLength: 700 },
    query: { type: "string", enum: ["", "members", "visitor_followups", "event_registrations"] },
    subject: { type: "string", maxLength: 180 },
  },
  required: ["intent", "command", "reply", "query", "subject"],
}, {
  validate(value) {
    const item = value as Partial<BotDecision> | null;
    if (!item || !["command", "clarify", "agenda_stats", "owner_query", "site_change"].includes(String(item.intent)) ||
        typeof item.command !== "string" || typeof item.reply !== "string" ||
        typeof item.query !== "string" || !["", "members", "visitor_followups", "event_registrations"].includes(item.query) ||
        typeof item.subject !== "string" || item.command.length > 1400 || item.reply.length > 700 || item.subject.length > 180) {
      return { success: false, error: new Error("Resposta da IA inválida.") };
    }
    return { success: true, value: item as BotDecision };
  },
});

async function downloadOwnerAudio(mediaId: string, businessPhoneNumberId: string) {
  if (!/^\d{8,25}$/.test(mediaId)) throw new Error("Áudio sem identificador válido.");
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("WhatsApp oficial sem token de mídia.");
  const metadata = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}?phone_number_id=${businessPhoneNumberId}`, {
    headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  if (!metadata.ok) throw new Error(`A Meta não liberou o áudio (${metadata.status}).`);
  const result = await metadata.json() as { url?: string; mime_type?: string; file_size?: number };
  if (!result.url || Number(result.file_size ?? 0) > MAX_AUDIO_BYTES || !result.mime_type?.startsWith("audio/")) {
    throw new Error("Áudio inválido ou acima do limite de 16 MB.");
  }
  const url = new URL(result.url);
  if (url.protocol !== "https:" || !["lookaside.fbsbx.com", "graph.facebook.com"].includes(url.hostname)) {
    throw new Error("Endereço de mídia da Meta inesperado.");
  }
  const media = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!media.ok || Number(media.headers.get("content-length") ?? 0) > MAX_AUDIO_BYTES) {
    throw new Error("Não foi possível baixar o áudio da Meta.");
  }
  const bytes = new Uint8Array(await media.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw new Error("Áudio vazio ou muito grande.");
  const resultTranscript = await transcribe({ model: gateway.transcriptionModel(TRANSCRIPTION_MODEL), audio: bytes });
  const transcript = resultTranscript.text.trim();
  if (!transcript) throw new Error("Não consegui entender o áudio. Envie novamente ou escreva o pedido.");
  return transcript.slice(0, 4000);
}

async function recentConversation(conversationId: number, incomingMessageId: string) {
  const { data } = await getSupabaseServiceClient().from("whatsapp_messages")
    .select("direction,body,message_type,wa_message_id")
    .eq("conversation_id", conversationId).in("message_type", ["text", "audio", "image"])
    .order("created_at", { ascending: false }).limit(8);
  return (data ?? []).filter((item) => item.wa_message_id !== incomingMessageId)
    .reverse().map((item) => ({ de: item.direction, texto: String(item.body ?? "").slice(0, 450) }));
}

async function pastoralAgendaStats() {
  const service = getSupabaseServiceClient();
  const [{ count: booked, error: bookedError }, { count: upcoming, error: upcomingError }] = await Promise.all([
    service.from("pastoral_availability_slots").select("id", { count: "exact", head: true }).eq("status", "booked"),
    service.from("pastoral_availability_slots").select("id", { count: "exact", head: true })
      .eq("status", "booked").gt("starts_at", new Date().toISOString()),
  ]);
  if (bookedError || upcomingError) throw new Error("Não consegui consultar as reservas da Agenda Pastoral.");
  return `Na Agenda Pastoral, ${booked ?? 0} horário(s) já foram reservados no total; ${upcoming ?? 0} ainda estão por acontecer. Não alterei nenhum horário.`;
}

async function ownerSiteQuery(decision: BotDecision) {
  const service = getSupabaseServiceClient();
  if (decision.query === "members") {
    const [all, approved, complete, pending] = await Promise.all([
      service.from("member_profiles").select("user_id", { count: "exact", head: true }),
      service.from("member_profiles").select("user_id", { count: "exact", head: true }).eq("approval_status", "approved"),
      service.from("member_profiles").select("user_id", { count: "exact", head: true }).eq("profile_completed", true),
      service.from("member_profiles").select("user_id", { count: "exact", head: true }).eq("approval_status", "pending"),
    ]);
    if (all.error || approved.error || complete.error || pending.error) throw new Error("Não consegui consultar os membros.");
    return `Cadastros da Família: ${all.count ?? 0} no total, ${approved.count ?? 0} aprovados, ${complete.count ?? 0} com perfil completo e ${pending.count ?? 0} aguardando aprovação.`;
  }
  if (decision.query === "visitor_followups") {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    const { count, error } = await service.from("visitor_followup_steps").select("id", { count: "exact", head: true })
      .is("completed_at", null).lte("due_date", today);
    if (error) throw new Error("Não consegui consultar o acompanhamento de visitantes.");
    return `A equipe Connect tem ${count ?? 0} etapa(s) de acompanhamento de visitantes vencidas ou para hoje e ainda não concluídas. Confira os detalhes no painel de visitantes.`;
  }
  if (decision.query === "event_registrations") {
    const subject = decision.subject.trim().toLocaleLowerCase("pt-BR");
    if (subject.length < 3) return "Qual é o nome do evento cujas inscrições você quer consultar?";
    const { data: events, error: eventError } = await service.from("events")
      .select("id,title,slug,start_date").eq("registration_enabled", true).is("archived_at", null)
      .order("start_date", { ascending: false }).limit(80);
    if (eventError) throw new Error("Não consegui consultar os eventos.");
    const matches = (events ?? []).filter((event) => `${event.title} ${event.slug} ${event.start_date}`.toLocaleLowerCase("pt-BR").includes(subject));
    if (matches.length !== 1) return matches.length
      ? `Encontrei mais de um evento com “${decision.subject.slice(0, 80)}”. Diga o título e a data para eu distinguir.`
      : `Não encontrei um evento de inscrição ativo com “${decision.subject.slice(0, 80)}”. Confira o nome no painel de eventos.`;
    const event = matches[0];
    const { data: registrations, count, error } = await service.from("event_registrations")
      .select("full_name,status", { count: "exact" }).eq("event_id", event.id).is("archived_at", null)
      .neq("status", "cancelled").order("created_at", { ascending: false }).limit(15);
    if (error) throw new Error("Não consegui consultar as inscrições.");
    const names = (registrations ?? []).map((registration) => registration.full_name).join(", ");
    const suffix = (count ?? 0) > 15 ? " (mostrei só os 15 mais recentes)" : "";
    return `${event.title} (${event.start_date}): ${count ?? 0} inscrição(ões) ativa(s). ${names ? `Nomes: ${names}${suffix}.` : "Ainda não há inscritos."}`;
  }
  return "Posso consultar membros, acompanhamento de visitantes e inscrições de um evento específico. Qual desses você deseja?";
}

async function understandRequest(text: string, history: Awaited<ReturnType<typeof recentConversation>>) {
  const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const result = await generateText({
    model: LANGUAGE_MODEL,
    output: Output.object({ schema: decisionSchema }),
    system: [
      "Você é o assistente privado da Igreja Casa Forte Erechim. Responda em português brasileiro.",
      "Interprete somente o pedido do pastor. Não invente datas, horários, local, pessoas, valores ou eventos.",
      "Para ações hoje executáveis, converta o pedido em UM comando CASA exatamente válido:",
      "CASA AGENDA; CASA AGENDA ABRIR; CASA AGENDA PAUSAR; CASA AGENDA NOVO AAAA-MM-DD | HH:MM | HH:MM | Rilldy/Lisi/Rilldy e Lisi | Local;",
      "CASA EVENTO Título | AAAA-MM-DD | HH:MM | Local | Descrição | INSCRICAO SIM/NAO | VALOR 0/250,00; CASA AVISO Título | Texto.",
      "Para evento com inscrição, pergunte se a inscrição é gratuita ou paga quando o pastor não informar. Se paga, pergunte o valor exato. Nunca invente preço. Use INSCRICAO SIM e VALOR 0 apenas quando ele disser explicitamente que será gratuito.",
      "Quando uma foto foi enviada pelo pastor, ela é guardada em rascunho privado e anexada automaticamente à próxima prévia de evento. Não descreva a foto sem vê-la.",
      "Use intent=command somente com todos os campos explícitos e command contendo o comando completo.",
      "Perguntas sobre QUANTOS horários foram preenchidos, reservados ou aceitos na Agenda Pastoral são intent=agenda_stats; command vazio. Nunca classifique uma consulta de contagem como site_change.",
      "Para consultas privadas do pastor, use intent=owner_query e query=members para números de membros; query=visitor_followups para pendências do Connect; query=event_registrations para inscritos em um evento. Ponha o nome do evento em subject. Não invente resposta; as informações serão consultadas no banco depois. command vazio.",
      "Para as outras intenções, query vazio e subject vazio. Responda de forma curta e direta.",
      "Se faltarem dados, use intent=clarify e faça UMA pergunta objetiva em reply; command vazio.",
      "Pedidos de mudar código, design, fotos gerais do site, vídeo, cadastros, pagamentos ou qualquer outra área não coberta são intent=site_change.",
      "Nunca interprete sim, ok ou confirmação informal como CASA CONFIRMAR. A confirmação com código é obrigatória.",
      "Não revele dados privados da igreja nem assuma que uma ação foi publicada.",
    ].join("\n"),
    prompt: JSON.stringify({ dataHoje: localDate, historico: history, pedido: text.slice(0, 4000) }),
  });
  return { decision: result.output, usage: result.usage };
}

export async function processQueuedCasaBotMessages(limit = 2) {
  const service = getSupabaseServiceClient();
  const { data: interrupted } = await service.from("whatsapp_messages")
    .select("id,raw_payload").eq("direction", "inbound")
    .contains("raw_payload", { casa_bot: { state: "processing" } }).limit(10);
  for (const item of interrupted ?? []) {
    const previous = item.raw_payload as IncomingPayload;
    if (previous.casa_bot.startedAt && Date.now() - new Date(previous.casa_bot.startedAt).getTime() > 5 * 60_000) {
      await service.from("whatsapp_messages").update({ raw_payload: { ...previous,
        casa_bot: { ...previous.casa_bot, state: "queued" } } }).eq("id", item.id)
        .contains("raw_payload", { casa_bot: { state: "processing" } });
    }
  }
  const { data: queued, error } = await service.from("whatsapp_messages")
    .select("id,conversation_id,wa_message_id,body,media_id,raw_payload")
    .eq("direction", "inbound").contains("raw_payload", { casa_bot: { state: "queued" } })
    .order("created_at").limit(limit);
  if (error) throw new Error("Não foi possível buscar as mensagens do robô.");
  let completed = 0;
  let failed = 0;
  for (const row of queued ?? []) {
    const payload = row.raw_payload as IncomingPayload;
    const state = payload?.casa_bot;
    if (!state?.businessPhoneNumberId) continue;
    const generationId = randomUUID();
    const processing: IncomingPayload = { ...payload, casa_bot: { ...state, state: "processing", generationId,
      model: payload.type === "audio" ? `${TRANSCRIPTION_MODEL} + ${LANGUAGE_MODEL}` : LANGUAGE_MODEL,
      startedAt: new Date().toISOString() } };
    let activePayload = processing;
    const { data: claimed } = await service.from("whatsapp_messages")
      .update({ raw_payload: processing }).eq("id", row.id)
      .contains("raw_payload", { casa_bot: { state: "queued" } }).select("id").maybeSingle();
    if (!claimed) continue;
    const { data: conversation } = await service.from("whatsapp_conversations")
      .select("phone").eq("id", row.conversation_id).maybeSingle();
    const phone = String(conversation?.phone ?? "");
    try {
      if (!await isAuthorizedCasaCommandSender(phone, state.businessPhoneNumberId)) throw new Error("Remetente não autorizado.");
      const text = payload.type === "audio"
        ? await downloadOwnerAudio(String(row.media_id ?? payload.audio?.id ?? ""), state.businessPhoneNumberId)
        : payload.type === "image" ? String(payload.image?.caption ?? "").trim().slice(0, 4000)
        : String(row.body ?? "").trim().slice(0, 4000);
      if (payload.type === "image") {
        const path = await saveOwnerEventPhoto(String(row.media_id ?? payload.image?.id ?? ""), state.businessPhoneNumberId);
        const stored: IncomingPayload = { ...processing, casa_event_photo: { path, state: "stored" },
          casa_bot: { ...processing.casa_bot, state: text ? "processing" : "responding" } };
        activePayload = stored;
        await service.from("whatsapp_messages").update({ body: text || "[Foto para evento recebida em rascunho privado]", raw_payload: stored }).eq("id", row.id);
        if (!text) {
          await replyToCasaOwner(phone, row.conversation_id,
            "Recebi sua foto e guardei em rascunho privado. Para criar o evento, mande título, data, horário, local, descrição e diga se haverá inscrição gratuita ou paga (se paga, o valor). Vou mostrar uma prévia antes de publicar.",
            row.wa_message_id, state.businessPhoneNumberId);
          await service.from("whatsapp_messages").update({ raw_payload: { ...stored,
            casa_bot: { ...stored.casa_bot, state: "completed" } } }).eq("id", row.id);
          completed += 1;
          continue;
        }
      }
      if (!text) throw new Error("Mensagem vazia.");
      const { decision, usage } = await understandRequest(text, await recentConversation(row.conversation_id, row.wa_message_id));
      const normalized = { ...activePayload, casa_bot: { ...activePayload.casa_bot, state: "responding" as const,
        transcript: payload.type === "audio" ? text : undefined, decision, usage } };
      await service.from("whatsapp_messages").update({ body: text, raw_payload: normalized }).eq("id", row.id);
      const command = decision.intent === "command" ? parseCasaCommand(decision.command) : null;
      if (command && ["draft", "agenda-list", "help"].includes(command.type)) {
        await handleCasaCommand({ phone, conversationId: row.conversation_id, incomingMessageId: row.wa_message_id,
          businessPhoneNumberId: state.businessPhoneNumberId, body: decision.command });
      } else {
        const answer = decision.intent === "agenda_stats" ? await pastoralAgendaStats() : decision.intent === "owner_query"
          ? await ownerSiteQuery(decision) : decision.intent === "site_change"
          ? `Entendi o pedido${payload.type === "audio" ? ` do áudio: “${text.slice(0, 220)}”` : ""}. Ainda não tenho um executor seguro para alterar código/design e publicar sozinho por este WhatsApp. Não fiz nenhuma mudança. Para agenda, eventos públicos e avisos, já posso preparar uma prévia para sua confirmação.`
          : decision.reply || "Pode me dizer o que deseja fazer e os detalhes necessários?";
        await replyToCasaOwner(phone, row.conversation_id, answer.slice(0, 900), row.wa_message_id, state.businessPhoneNumberId);
      }
      await service.from("whatsapp_messages").update({ raw_payload: { ...normalized, casa_bot: { ...normalized.casa_bot, state: "completed" } } }).eq("id", row.id);
      completed += 1;
    } catch (botError) {
      const message = botError instanceof Error ? botError.message : "Falha no processamento.";
      await service.from("whatsapp_messages").update({ raw_payload: { ...processing, casa_bot: { ...processing.casa_bot, state: "failed", error: message } } }).eq("id", row.id);
      failed += 1;
      console.error("casa_bot_message_failed", { messageId: row.wa_message_id, error: message });
      if (phone && await isAuthorizedCasaCommandSender(phone, state.businessPhoneNumberId)) {
        try { await replyToCasaOwner(phone, row.conversation_id, "Não consegui processar essa mensagem agora. Envie novamente, de preferência com os detalhes em texto.", row.wa_message_id, state.businessPhoneNumberId); }
        catch (replyError) { console.warn("casa_bot_failure_reply_failed", replyError instanceof Error ? replyError.message : "unknown"); }
      }
    }
  }
  return { queued: queued?.length ?? 0, completed, failed };
}
