"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { sendDiscipleshipWhatsappOnce } from "@/lib/discipleship-whatsapp";
import { formatDiscipleshipDate, sendWhatsappNotification } from "@/lib/whatsapp";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function go(path: string, kind: "sucesso" | "erro", message: string): never {
  redirect(`${path}?${new URLSearchParams({ [kind]: message })}`);
}

async function currentUser() {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/familia/login");
  return user;
}

export async function requestDiscipleshipMeeting() {
  const user = await currentUser();
  const service = getSupabaseServiceClient();
  const { data: relationship } = await service.from("discipleship_relationships")
    .select("id,discipler_id").eq("disciple_id", user.id).is("ended_at", null).maybeSingle();
  if (!relationship) go("/familia/meus-discipulados", "erro", "Você ainda não possui um discipulador ativo.");

  const { data: existing } = await service.from("discipleship_scheduling_requests")
    .select("id").eq("relationship_id", relationship.id).eq("status", "pending").maybeSingle();
  if (existing) go("/familia/meus-discipulados", "erro", "Seu pedido já foi enviado ao discipulador.");

  const { error } = await service.from("discipleship_scheduling_requests").insert({
    relationship_id: relationship.id, requested_by: user.id,
  });
  if (error) go("/familia/meus-discipulados", "erro", "Não foi possível enviar o pedido agora.");

  await service.from("discipleship_conversation_messages").insert({
    relationship_id: relationship.id,
    sender_id: user.id,
    message_type: "request",
  });

  const { data: people } = await service.from("member_profiles")
    .select("user_id,full_name,phone").in("user_id", [user.id, relationship.discipler_id]);
  const disciple = people?.find((person) => person.user_id === user.id);
  const discipler = people?.find((person) => person.user_id === relationship.discipler_id);
  await sendWhatsappNotification(
    discipler?.phone,
    `${disciple?.full_name || "Seu discípulo"} pediu um novo discipulado. Entre no seu painel Casa Forte e ofereça até duas datas e horários.`,
  );

  revalidatePath("/familia/lideranca");
  revalidatePath(`/familia/lideranca/discipulos/${relationship.id}`);
  go("/familia/meus-discipulados", "sucesso", "Pedido enviado. Seu discipulador recebeu o aviso.");
}

export async function createDiscipleshipInvitation(formData: FormData) {
  const user = await currentUser();
  const relationshipId = String(formData.get("relationshipId") ?? "");
  const detailPath = `/familia/lideranca/discipulos/${relationshipId}`;
  if (!UUID.test(relationshipId)) go("/familia/lideranca", "erro", "Vínculo inválido.");

  const rawOptions = [1, 2].map((index) => String(formData.get(`option${index}`) ?? ""));
  const dates = rawOptions.map((value) => new Date(`${value}:00-03:00`));
  const now = Date.now();
  const max = now + 120 * 86400000;
  if (dates.some((date) => Number.isNaN(date.getTime()) || date.getTime() <= now || date.getTime() > max)) {
    go(detailPath, "erro", "Escolha duas datas futuras, dentro dos próximos 120 dias.");
  }
  if (new Set(dates.map((date) => date.toISOString())).size !== 2) {
    go(detailPath, "erro", "As duas opções precisam ter datas ou horários diferentes.");
  }

  const service = getSupabaseServiceClient();
  const [{ data: relationship }, { data: profile }] = await Promise.all([
    service.from("discipleship_relationships").select("id,discipler_id,disciple_id").eq("id", relationshipId).is("ended_at", null).maybeSingle(),
    service.from("member_profiles").select("is_admin").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!relationship || (relationship.discipler_id !== user.id && !profile?.is_admin)) {
    go(detailPath, "erro", "Você não possui permissão para enviar este convite.");
  }

  const { data: pendingInvitation } = await service.from("discipleship_invitations")
    .select("id").eq("relationship_id", relationshipId).eq("status", "pending").maybeSingle();
  if (pendingInvitation) {
    go(detailPath, "erro", "Já existe um convite aguardando resposta. Não enviamos outro WhatsApp.");
  }
  const { data: request } = await service.from("discipleship_scheduling_requests")
    .select("id").eq("relationship_id", relationshipId).eq("status", "pending").maybeSingle();
  const expiresAt = new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString();
  const { data: invitation, error } = await service.from("discipleship_invitations").insert({
    relationship_id: relationshipId,
    request_id: request?.id ?? null,
    created_by: user.id,
    expires_at: expiresAt,
  }).select("id").single();
  if (error || !invitation) go(detailPath, "erro", "Não foi possível criar o convite.");

  const { error: optionError } = await service.from("discipleship_invitation_options").insert(
    dates.map((date, index) => ({ invitation_id: invitation.id, starts_at: date.toISOString(), sort_order: index + 1 })),
  );
  if (optionError) {
    await service.from("discipleship_invitations").delete().eq("id", invitation.id);
    go(detailPath, "erro", "Não foi possível salvar as duas opções.");
  }
  if (request) await service.from("discipleship_scheduling_requests").update({ status: "answered", answered_at: new Date().toISOString() }).eq("id", request.id);

  const { data: disciple } = await service.from("member_profiles").select("full_name,phone").eq("user_id", relationship.disciple_id).maybeSingle();
  await service.from("discipleship_conversation_messages").insert({
    relationship_id: relationshipId,
    sender_id: user.id,
    message_type: "invitation",
    invitation_id: invitation.id,
  });
  await sendDiscipleshipWhatsappOnce({
    invitationId: invitation.id,
    recipientId: relationship.disciple_id,
    deliveryType: "invitation",
    phone: disciple?.phone,
    message: `${disciple?.full_name?.split(/\s+/)[0] || "Olá"}, seu discipulador enviou duas opções de horário. Abra “Meus discipulados” na Área da Família para escolher uma delas.`,
  });

  revalidatePath(detailPath);
  revalidatePath("/familia/meus-discipulados");
  go(detailPath, "sucesso", "As duas opções foram enviadas ao discípulo.");
}

export async function acceptDiscipleshipOption(formData: FormData) {
  const user = await currentUser();
  const invitationId = String(formData.get("invitationId") ?? "");
  const optionId = String(formData.get("optionId") ?? "");
  const path = "/familia/meus-discipulados";
  if (!UUID.test(invitationId) || !UUID.test(optionId)) go(path, "erro", "Opção inválida.");

  const service = getSupabaseServiceClient();
  const { data: invitation } = await service.from("discipleship_invitations")
    .select("id,status,relationship_id,discipleship_relationships!inner(disciple_id,discipler_id)")
    .eq("id", invitationId).eq("status", "pending").maybeSingle();
  const relationship = Array.isArray(invitation?.discipleship_relationships)
    ? invitation?.discipleship_relationships[0]
    : invitation?.discipleship_relationships;
  if (!invitation || !relationship || relationship.disciple_id !== user.id) go(path, "erro", "Este convite não está disponível.");

  const { data: option } = await service.from("discipleship_invitation_options")
    .select("id,starts_at").eq("id", optionId).eq("invitation_id", invitationId).gt("starts_at", new Date().toISOString()).maybeSingle();
  if (!option) go(path, "erro", "Este horário expirou. Peça novas opções ao seu discipulador.");

  const { data: accepted, error } = await service.from("discipleship_invitations").update({
    status: "accepted", accepted_option_id: option.id, accepted_at: new Date().toISOString(),
  }).eq("id", invitationId).eq("status", "pending").is("accepted_option_id", null).select("id").maybeSingle();
  if (error || !accepted) go(path, "erro", "Esse convite já foi respondido. Atualize a página.");

  const { data: people } = await service.from("member_profiles").select("user_id,full_name,phone")
    .in("user_id", [relationship.disciple_id, relationship.discipler_id]);
  const disciple = people?.find((person) => person.user_id === relationship.disciple_id);
  const discipler = people?.find((person) => person.user_id === relationship.discipler_id);
  const when = formatDiscipleshipDate(option.starts_at);
  const messages = [
    { id: relationship.discipler_id, phone: discipler?.phone, text: `${disciple?.full_name || "Seu discípulo"} aceitou o discipulado para ${when}. Você receberá lembretes um dia e duas horas antes.` },
    { id: relationship.disciple_id, phone: disciple?.phone, text: `Você confirmou seu discipulado com ${discipler?.full_name || "seu discipulador"} para ${when}. Você receberá lembretes um dia e duas horas antes.` },
  ];
  for (const message of messages) {
    await sendDiscipleshipWhatsappOnce({
      invitationId,
      recipientId: message.id,
      deliveryType: "confirmation",
      phone: message.phone,
      message: message.text,
    });
  }

  await service.from("discipleship_conversation_messages").insert({
    relationship_id: invitation.relationship_id,
    sender_id: user.id,
    message_type: "confirmation",
    invitation_id: invitationId,
    scheduled_at: option.starts_at,
  });

  revalidatePath(path);
  revalidatePath(`/familia/lideranca/discipulos/${invitation.relationship_id}`);
  go(path, "sucesso", `Discipulado confirmado para ${when}.`);
}

export async function createManualDiscipleshipBooking(formData: FormData) {
  const user = await currentUser();
  const relationshipId = String(formData.get("relationshipId") ?? "");
  const detailPath = `/familia/lideranca/discipulos/${relationshipId}`;
  if (!UUID.test(relationshipId)) go("/familia/lideranca", "erro", "Vínculo inválido.");

  const rawDate = String(formData.get("manualDate") ?? "");
  const startsAt = new Date(`${rawDate}:00-03:00`);
  const now = Date.now();
  if (Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= now || startsAt.getTime() > now + 120 * 86400000) {
    go(detailPath, "erro", "Escolha uma data futura dentro dos próximos 120 dias.");
  }

  const service = getSupabaseServiceClient();
  const [{ data: relationship }, { data: profile }, { data: pendingInvitation }] = await Promise.all([
    service.from("discipleship_relationships").select("id,discipler_id,disciple_id").eq("id", relationshipId).is("ended_at", null).maybeSingle(),
    service.from("member_profiles").select("is_admin").eq("user_id", user.id).maybeSingle(),
    service.from("discipleship_invitations").select("id").eq("relationship_id", relationshipId).eq("status", "pending").maybeSingle(),
  ]);
  if (!relationship || (relationship.discipler_id !== user.id && !profile?.is_admin)) {
    go(detailPath, "erro", "Você não possui permissão para cadastrar este discipulado.");
  }
  if (pendingInvitation) {
    go(detailPath, "erro", "Há um convite aguardando resposta. Resolva esse convite antes do cadastro manual.");
  }

  const { data: invitation, error: invitationError } = await service.from("discipleship_invitations").insert({
    relationship_id: relationshipId,
    created_by: user.id,
    invitation_type: "manual",
    expires_at: startsAt.toISOString(),
  }).select("id").single();
  if (invitationError || !invitation) go(detailPath, "erro", "Não foi possível criar o agendamento manual.");

  const { data: option, error: optionError } = await service.from("discipleship_invitation_options").insert({
    invitation_id: invitation.id,
    starts_at: startsAt.toISOString(),
    sort_order: 1,
  }).select("id").single();
  if (optionError || !option) {
    await service.from("discipleship_invitations").delete().eq("id", invitation.id);
    go(detailPath, "erro", "Não foi possível salvar a data do discipulado.");
  }

  const { error: acceptError } = await service.from("discipleship_invitations").update({
    status: "accepted",
    accepted_option_id: option.id,
    accepted_at: new Date().toISOString(),
  }).eq("id", invitation.id).eq("status", "pending");
  if (acceptError) go(detailPath, "erro", "Não foi possível confirmar o agendamento manual.");

  const { data: people } = await service.from("member_profiles").select("user_id,full_name,phone")
    .in("user_id", [relationship.disciple_id, relationship.discipler_id]);
  const disciple = people?.find((person) => person.user_id === relationship.disciple_id);
  const discipler = people?.find((person) => person.user_id === relationship.discipler_id);
  const when = formatDiscipleshipDate(startsAt.toISOString());

  await service.from("discipleship_conversation_messages").insert({
    relationship_id: relationshipId,
    sender_id: user.id,
    message_type: "manual_booking",
    invitation_id: invitation.id,
    scheduled_at: startsAt.toISOString(),
  });

  for (const recipient of [
    { id: relationship.discipler_id, phone: discipler?.phone, message: `Discipulado com ${disciple?.full_name || "seu discípulo"} cadastrado para ${when}.` },
    { id: relationship.disciple_id, phone: disciple?.phone, message: `Seu discipulado com ${discipler?.full_name || "seu discipulador"} foi marcado para ${when}.` },
  ]) {
    await sendDiscipleshipWhatsappOnce({
      invitationId: invitation.id,
      recipientId: recipient.id,
      deliveryType: "confirmation",
      phone: recipient.phone,
      message: recipient.message,
    });
  }

  revalidatePath(detailPath);
  revalidatePath("/familia/meus-discipulados");
  go(detailPath, "sucesso", `Discipulado cadastrado para ${when}.`);
}

export async function sendDiscipleshipConversationMessage(formData: FormData) {
  const user = await currentUser();
  const relationshipId = String(formData.get("relationshipId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  const allowedReturn = returnTo === "/familia/meus-discipulados"
    ? returnTo
    : `/familia/lideranca/discipulos/${relationshipId}`;
  if (!UUID.test(relationshipId)) go("/familia", "erro", "Conversa inválida.");

  const body = String(formData.get("message") ?? "").trim();
  if (!body || body.length > 2000) go(allowedReturn, "erro", "Escreva uma mensagem de até 2.000 caracteres.");

  const service = getSupabaseServiceClient();
  const { data: relationship } = await service.from("discipleship_relationships")
    .select("discipler_id,disciple_id").eq("id", relationshipId).is("ended_at", null).maybeSingle();
  if (!relationship || (relationship.discipler_id !== user.id && relationship.disciple_id !== user.id)) {
    go("/familia", "erro", "Você não participa desta conversa.");
  }

  const { error } = await service.from("discipleship_conversation_messages").insert({
    relationship_id: relationshipId,
    sender_id: user.id,
    message_type: "message",
    body,
  });
  if (error) go(allowedReturn, "erro", "Não foi possível enviar a mensagem agora.");

  revalidatePath("/familia/meus-discipulados");
  revalidatePath(`/familia/lideranca/discipulos/${relationshipId}`);
  go(allowedReturn, "sucesso", "Mensagem enviada.");
}
