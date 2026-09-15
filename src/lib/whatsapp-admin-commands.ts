import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { configurePastoralAgenda, createPastoralSlot, personalAgendaAction } from "@/lib/pastoral-agenda";
import { isCasaCommandOwnerPhone } from "@/lib/whatsapp-command-auth";
import { publishWhatsappCommandAnnouncement } from "@/lib/whatsapp-command-announcement";
import { casaCommandHelp, casaDraftPreview, parseCasaCommand, type CasaCommandDraft } from "@/lib/whatsapp-command-parser";

const OWNER_USER_ID = "34944370-8853-4c1b-866b-8c80b4e59829";
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1188719124331063";
const DRAFT_VALID_MS = 10 * 60_000;

function commandUuid(code: string) {
  const hash = createHash("sha256").update(`casa_event_${code}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

type StoredDraft = {
  state: "pending" | "queued" | "processing" | "completed" | "failed";
  kind: CasaCommandDraft["kind"];
  payload: CasaCommandDraft;
  ownerUserId: string;
  expiresAt: string;
  originMessageId: string;
  startedAt?: string;
  result?: string;
};

async function ownerAccountAuthorized() {
  const { data, error } = await getSupabaseServiceClient().from("member_profiles")
    .select("is_admin,approval_status").eq("user_id", OWNER_USER_ID).maybeSingle();
  return !error && Boolean(data?.is_admin && data.approval_status === "approved");
}

export async function isAuthorizedCasaCommandSender(phone: string, businessPhoneNumberId: string | undefined) {
  if (businessPhoneNumberId !== PHONE_NUMBER_ID || !isCasaCommandOwnerPhone(phone)) return false;
  return ownerAccountAuthorized();
}

async function reply(phone: string, conversationId: number, body: string, incomingMessageId: string) {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  if (!accessToken) throw new Error("WhatsApp oficial não configurado para responder.");
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone,
      context: { message_id: incomingMessageId }, type: "text", text: { preview_url: false, body } }),
    signal: AbortSignal.timeout(15_000), cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  const messageId = result?.messages?.[0]?.id as string | undefined;
  if (!response.ok || !messageId) throw new Error(`WhatsApp recusou a resposta (${response.status}).`);
  const service = getSupabaseServiceClient();
  const { error } = await service.from("whatsapp_messages").insert({
    conversation_id: conversationId, wa_message_id: messageId, direction: "outbound", message_type: "text",
    body, status: "sent", sent_at: new Date().toISOString(), raw_payload: { kind: "casa_command_reply", in_reply_to: incomingMessageId },
  });
  if (error) console.warn("casa_command_reply_not_logged", { code: error.code });
}

async function agendaOverview() {
  const service = getSupabaseServiceClient();
  const { data: setting, error: settingError } = await service.from("pastoral_calendar_settings")
    .select("source_calendar_id,is_active").order("created_at").limit(1).maybeSingle();
  if (settingError || !setting) return "A Agenda Pastoral ainda não está configurada.";
  const { data: slots, error } = await service.from("pastoral_availability_slots")
    .select("host_name,starts_at").eq("source_calendar_id", setting.source_calendar_id)
    .eq("status", "available").gt("starts_at", new Date().toISOString()).order("starts_at").limit(10);
  if (error) throw new Error("Não foi possível consultar os horários.");
  const dates = (slots ?? []).map((slot) => `${new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(slot.starts_at))} — ${slot.host_name}`);
  return `Agenda Pastoral: ${setting.is_active ? "aberta" : "pausada"}.\n${dates.length ? dates.join("\n") : "Nenhum horário livre agora."}\nVeja todos no painel: https://www.casaforteerechim.app.br/admin/agenda-pastoral`;
}

function parseLocalDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}:00-03:00`);
  if (Number.isNaN(value.getTime())) throw new Error("Data ou horário inválido.");
  return value;
}

async function calendarId() {
  const { data, error } = await getSupabaseServiceClient().from("pastoral_calendar_settings")
    .select("source_calendar_id").order("created_at").limit(1).maybeSingle();
  if (error || !data?.source_calendar_id) throw new Error("Agenda Pastoral não configurada.");
  return data.source_calendar_id as string;
}

async function executeDraft(draft: StoredDraft, code: string) {
  const service = getSupabaseServiceClient();
  const payload = draft.payload;
  if (payload.kind === "agenda-toggle") {
    await configurePastoralAgenda(await calendarId(), "Agenda pastoral", payload.active);
    revalidatePath("/admin/agenda-pastoral"); revalidatePath("/familia/agenda-pastoral");
    return payload.active ? "Agenda Pastoral reaberta no site." : "Novas reservas da Agenda Pastoral pausadas no site.";
  }
  if (payload.kind === "agenda-publish") {
    const startsAt = parseLocalDateTime(payload.date, payload.start);
    const endsAt = parseLocalDateTime(payload.date, payload.end);
    if (startsAt <= new Date() || endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > 4 * 60 * 60_000) throw new Error("O horário deve ser futuro e durar até quatro horas.");
    const sourceCalendarId = await calendarId();
    const conflict = await personalAgendaAction("check-conflict", { calendarId: sourceCalendarId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    if (conflict.conflict) throw new Error("Esse período conflita com a agenda privada.");
    await createPastoralSlot({ sourceCalendarId, hostName: payload.host, location: payload.location, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    revalidatePath("/admin/agenda-pastoral"); revalidatePath("/familia/agenda-pastoral");
    return `Horário ${payload.date} ${payload.start}–${payload.end} publicado para quem já tem acesso à Agenda Pastoral.`;
  }
  if (payload.kind === "event-create") {
    if (parseLocalDateTime(payload.date, payload.time) <= new Date()) throw new Error("A data do evento deve ser futura.");
    const eventId = commandUuid(code);
    const { data: existing, error: existingError } = await service.from("events").select("id").eq("slug", payload.slug).maybeSingle();
    if (existingError) throw new Error("Não foi possível conferir eventos existentes.");
    if (existing?.id === eventId) return `Evento público “${payload.title}” já estava criado no site. Nenhuma cópia foi publicada.`;
    if (existing) throw new Error("Já existe um evento com esse título/endereço. Confira no painel antes de publicar outro.");
    const { error } = await service.from("events").insert({
      id: eventId,
      title: payload.title, slug: payload.slug, description: payload.description, category: "Eventos especiais",
      start_date: payload.date, start_time: payload.time, location: payload.location, status: "confirmed",
      registration_enabled: false, registration_status: "closed", registration_fee_cents: 0,
      is_public: true, is_featured: false, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.code === "23505" ? "Esse evento já existe." : "Não foi possível criar o evento.");
    revalidatePath("/calendario"); revalidatePath("/eventos"); revalidatePath("/admin/eventos");
    return `Evento público “${payload.title}” criado no site, sem inscrição automática.`;
  }
  const result = await publishWhatsappCommandAnnouncement({ ownerUserId: draft.ownerUserId, title: payload.title, body: payload.body, campaign: `casa_command_${code}` });
  return `Aviso publicado no site. Push: ${result.pushSent} aparelho(s). WhatsApp: ${result.whatsapp.accepted} aceito(s) pela Meta, ${result.whatsapp.rejected} recusado(s), ${result.whatsapp.skipped} já enviado(s).`;
}

async function draftRow(conversationId: number, code: string) {
  const { data, error } = await getSupabaseServiceClient().from("whatsapp_messages")
    .select("id,status,raw_payload").eq("conversation_id", conversationId).eq("wa_message_id", `command:${code}`).maybeSingle();
  if (error) throw new Error("Não foi possível conferir a confirmação.");
  return data as { id: number; status: string; raw_payload: StoredDraft } | null;
}

export async function handleCasaCommand(input: { phone: string; conversationId: number; incomingMessageId: string; body: string }) {
  const parsed = parseCasaCommand(input.body);
  if (!parsed) return false;
  const service = getSupabaseServiceClient();
  let answer: string;
  if (parsed.type === "help") answer = casaCommandHelp();
  else if (parsed.type === "agenda-list") answer = await agendaOverview();
  else if (parsed.type === "invalid") answer = parsed.reason;
  else if (parsed.type === "draft") {
    const code = randomBytes(4).toString("hex").toUpperCase();
    answer = casaDraftPreview(parsed.draft, code);
    const record: StoredDraft = {
      state: "pending", kind: parsed.draft.kind, payload: parsed.draft, ownerUserId: OWNER_USER_ID,
      expiresAt: new Date(Date.now() + DRAFT_VALID_MS).toISOString(), originMessageId: input.incomingMessageId,
    };
    const { error } = await service.from("whatsapp_messages").insert({
      conversation_id: input.conversationId, wa_message_id: `command:${code}`, direction: "outbound",
      message_type: "command_draft", body: answer, status: "sent", raw_payload: record,
    });
    if (error) throw new Error("Não foi possível guardar a prévia do comando.");
  } else {
    const row = await draftRow(input.conversationId, parsed.code);
    if (!row || row.raw_payload?.ownerUserId !== OWNER_USER_ID || row.raw_payload.state !== "pending" || row.status !== "sent") {
      answer = "Código inexistente, já usado ou cancelado. Envie um novo comando para gerar outra prévia.";
    } else if (new Date(row.raw_payload.expiresAt).getTime() < Date.now()) {
      await service.from("whatsapp_messages").update({ status: "failed", raw_payload: { ...row.raw_payload, state: "failed", result: "expirado" } }).eq("id", row.id).eq("status", "sent");
      answer = "Esse código expirou. Envie o comando novamente.";
    } else if (parsed.type === "cancel") {
      await service.from("whatsapp_messages").update({ status: "failed", raw_payload: { ...row.raw_payload, state: "failed", result: "cancelado" } }).eq("id", row.id).eq("status", "sent");
      answer = "Prévia cancelada. Nenhuma alteração foi feita no site.";
    } else {
      const { data: claimed, error } = await service.from("whatsapp_messages")
        .update({ status: "read", raw_payload: { ...row.raw_payload, state: "queued" } })
        .eq("id", row.id).eq("status", "sent").select("id").maybeSingle();
      if (error || !claimed) answer = "Esse código já foi usado. Nada será executado duas vezes.";
      else answer = `Confirmação recebida. Estou executando o comando ${parsed.code}; envio o resultado aqui em seguida.`;
    }
  }
  await reply(input.phone, input.conversationId, answer, input.incomingMessageId);
  return true;
}

export async function processQueuedCasaCommands(limit = 3) {
  const service = getSupabaseServiceClient();
  const staleBefore = Date.now() - 5 * 60_000;
  const { data: stale } = await service.from("whatsapp_messages")
    .select("id,raw_payload").eq("message_type", "command_draft").eq("status", "delivered").limit(20);
  for (const item of stale ?? []) {
    const payload = item.raw_payload as StoredDraft;
    if (payload?.state === "processing" && payload.startedAt && new Date(payload.startedAt).getTime() < staleBefore) {
      await service.from("whatsapp_messages").update({ status: "read", raw_payload: { ...payload, state: "queued" } })
        .eq("id", item.id).eq("status", "delivered");
    }
  }
  const { data: queued, error } = await service.from("whatsapp_messages")
    .select("id,conversation_id,wa_message_id,raw_payload").eq("message_type", "command_draft")
    .eq("status", "read").order("created_at").limit(limit);
  if (error) throw new Error("Não foi possível buscar os comandos confirmados.");
  let completed = 0;
  let failed = 0;
  for (const row of queued ?? []) {
    const draft = row.raw_payload as StoredDraft;
    if (draft?.state !== "queued" || draft.ownerUserId !== OWNER_USER_ID) continue;
    const { data: claimed, error: claimError } = await service.from("whatsapp_messages")
      .update({ status: "delivered", raw_payload: { ...draft, state: "processing", startedAt: new Date().toISOString() } })
      .eq("id", row.id).eq("status", "read").select("id").maybeSingle();
    if (claimError || !claimed) continue;
    const code = String(row.wa_message_id).replace(/^command:/, "");
    const { data: conversation, error: conversationError } = await service.from("whatsapp_conversations")
      .select("phone").eq("id", row.conversation_id).maybeSingle();
    let resultText: string;
    let state: "completed" | "failed";
    try {
      if (conversationError || !conversation?.phone || !isCasaCommandOwnerPhone(conversation.phone)) {
        throw new Error("Comando recusado: remetente não autorizado.");
      }
      if (!await ownerAccountAuthorized()) throw new Error("A conta administrativa do proprietário não está aprovada.");
      resultText = await executeDraft(draft, code);
      state = "completed";
      completed += 1;
    } catch (executeError) {
      resultText = executeError instanceof Error ? executeError.message : "Falha ao executar o comando.";
      state = "failed";
      failed += 1;
      console.error("casa_command_execution_failed", { code, kind: draft.kind, error: resultText });
    }
    await service.from("whatsapp_messages")
      .update({ status: state === "completed" ? "sent" : "failed", raw_payload: { ...draft, state, result: resultText } })
      .eq("id", row.id).eq("status", "delivered");
    if (conversation?.phone && isCasaCommandOwnerPhone(conversation.phone)) {
      try { await reply(conversation.phone, row.conversation_id, `Comando ${code}: ${resultText}`, draft.originMessageId); }
      catch (replyError) { console.warn("casa_command_result_reply_failed", { code, error: replyError instanceof Error ? replyError.message : "unknown" }); }
    }
  }
  return { queued: queued?.length ?? 0, completed, failed };
}
