import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { formatDiscipleshipDate } from "@/lib/whatsapp";
import { acceptDiscipleshipOption, requestDiscipleshipMeeting, sendDiscipleshipConversationMessage } from "./actions";
import { DiscipleshipSubmitButton } from "./submit-button";
import "./schedule.css";

export const metadata: Metadata = { title: "Meus discipulados", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function isFuture(date: string) {
  return new Date(date).getTime() > Date.now();
}

type ConversationMessage = {
  id: string;
  sender_id: string;
  message_type: "message" | "request" | "invitation" | "confirmation" | "manual_booking";
  body: string | null;
  scheduled_at: string | null;
  created_at: string;
};

export default async function MyDiscipleshipPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const query = await searchParams;
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/familia/login");
  const { data: profile } = await client.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!profile || (!profile.is_admin && profile.approval_status !== "approved")) redirect("/familia");

  const service = getSupabaseServiceClient();
  const { data: relationship } = await service.from("discipleship_relationships")
    .select("id,discipler_id,created_at").eq("disciple_id", user.id).is("ended_at", null).maybeSingle();

  let discipler: { full_name: string; photo_url: string | null } | null = null;
  let photoUrl: string | null = null;
  let latestSession: { meeting_date: string } | null = null;
  let request: { id: string; status: string } | null = null;
  let invitations: { id: string; status: string; accepted_option_id: string | null; created_at: string }[] = [];
  let options: { id: string; invitation_id: string; starts_at: string; sort_order: number }[] = [];
  let conversation: ConversationMessage[] = [];

  if (relationship) {
    const [personResult, sessionResult, requestResult, invitationResult, conversationResult] = await Promise.all([
      service.from("member_profiles").select("full_name,photo_url").eq("user_id", relationship.discipler_id).maybeSingle(),
      service.from("discipleship_sessions").select("meeting_date").eq("relationship_id", relationship.id).order("meeting_date", { ascending: false }).limit(1).maybeSingle(),
      service.from("discipleship_scheduling_requests").select("id,status").eq("relationship_id", relationship.id).eq("status", "pending").maybeSingle(),
      service.from("discipleship_invitations").select("id,status,accepted_option_id,created_at").eq("relationship_id", relationship.id).in("status", ["pending", "accepted"]).order("created_at", { ascending: false }).limit(12),
      service.from("discipleship_conversation_messages").select("id,sender_id,message_type,body,scheduled_at,created_at").eq("relationship_id", relationship.id).order("created_at", { ascending: true }).limit(100),
    ]);
    discipler = personResult.data;
    latestSession = sessionResult.data;
    request = requestResult.data;
    invitations = invitationResult.data ?? [];
    conversation = (conversationResult.data ?? []) as ConversationMessage[];
    const invitationIds = invitations.map((item) => item.id);
    if (invitationIds.length) {
      const { data } = await service.from("discipleship_invitation_options").select("id,invitation_id,starts_at,sort_order").in("invitation_id", invitationIds).order("sort_order");
      options = data ?? [];
    }
    if (discipler?.photo_url) {
      const { data } = await service.storage.from("member-profile-photos").createSignedUrl(discipler.photo_url, 3600);
      photoUrl = data?.signedUrl ?? null;
    }
  }

  const pendingInvitation = invitations.find((item) => item.status === "pending");
  const upcoming = invitations
    .filter((item) => item.status === "accepted" && item.accepted_option_id)
    .map((item) => ({ invitation: item, option: options.find((option) => option.id === item.accepted_option_id) }))
    .filter((item) => item.option && isFuture(item.option.starts_at))
    .sort((a, b) => new Date(a.option!.starts_at).getTime() - new Date(b.option!.starts_at).getTime());

  return <main className="inner-page my-discipleship-page">
    <header className="inner-header"><Link href="/"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={180} height={70} priority /></Link><Link className="inner-back" href="/familia">Voltar à Área da Família</Link></header>
    <section className="my-discipleship-hero"><p className="section-eyebrow"><span aria-hidden="true" />Minha caminhada</p><h1>Meus discipulados</h1><p>Acompanhe seus encontros, aceite horários e peça um novo discipulado quando precisar.</p></section>
    {(query.sucesso || query.erro) && <p className="my-discipleship-feedback" data-kind={query.erro ? "error" : "success"} role="status">{query.erro ?? query.sucesso}</p>}

    {!relationship ? <section className="my-discipleship-empty"><h2>Você ainda não possui discipulador</h2><p>Escolha uma pessoa disponível na Área da Família. Depois da validação pastoral, seus agendamentos aparecerão aqui.</p><Link href="/familia#escolher-discipulador">Escolher discipulador</Link></section> : <>
      <section className="my-discipleship-summary">
        <div className="my-discipleship-person">{photoUrl ? <Image src={photoUrl} alt={`Foto de ${discipler?.full_name}`} width={76} height={76} unoptimized /> : <span>{discipler?.full_name?.charAt(0) || "C"}</span>}<div><small>Meu discipulador</small><h2>{discipler?.full_name || "Discipulador cadastrado"}</h2></div></div>
        <div><small>Último discipulado</small><strong>{latestSession ? formatDate(latestSession.meeting_date) : "Ainda sem registro"}</strong><p>As observações pastorais são privadas e não aparecem aqui.</p></div>
      </section>

      {pendingInvitation && <section className="my-discipleship-invite"><header><span>Convite pendente</span><h2>Escolha uma das duas opções</h2><p>Ao confirmar, você e seu discipulador receberão uma única confirmação e os lembretes no WhatsApp.</p></header><div>{options.filter((option) => option.invitation_id === pendingInvitation.id && isFuture(option.starts_at)).map((option, index) => <form action={acceptDiscipleshipOption} key={option.id}><input type="hidden" name="invitationId" value={pendingInvitation.id} /><input type="hidden" name="optionId" value={option.id} /><span>Opção {index + 1}</span><strong>{formatDiscipleshipDate(option.starts_at)}</strong><DiscipleshipSubmitButton pendingLabel="Confirmando…">Aceitar este horário</DiscipleshipSubmitButton></form>)}</div></section>}

      <section className="my-discipleship-grid">
        <article><span>Próximo encontro</span><h2>{upcoming[0]?.option ? formatDiscipleshipDate(upcoming[0].option.starts_at) : "Nenhum horário confirmado"}</h2><p>{upcoming[0] ? "Você receberá lembretes no WhatsApp um dia e duas horas antes." : "Quando você aceitar uma opção, ela ficará registrada aqui."}</p></article>
        <article><span>Preciso conversar</span><h2>Preciso de discipulado</h2><p>Avise seu discipulador agora. Ele poderá responder oferecendo até duas datas e horários.</p><form action={requestDiscipleshipMeeting}><DiscipleshipSubmitButton disabled={Boolean(request)} pendingLabel="Enviando…">{request ? "Pedido já enviado" : "Enviar pedido ao discipulador"}</DiscipleshipSubmitButton></form></article>
      </section>

      <section className="my-discipleship-conversation">
        <header><span>Conversa privada</span><h2>Mensagens e agendamentos</h2><p>Aqui ficam a conversa com seu discipulador e todas as datas marcadas. As observações pastorais não aparecem nesta área.</p></header>
        <div className="my-discipleship-conversation-list" aria-live="polite">
          {conversation.length === 0 ? <p className="my-discipleship-conversation-empty">Ainda não há mensagens nesta conversa.</p> : conversation.map((message) => {
            const mine = message.sender_id === user.id;
            return <article key={message.id} data-mine={mine} data-event={message.message_type !== "message"}>
              <small>{mine ? "Você" : discipler?.full_name || "Seu discipulador"}</small>
              {message.message_type === "message" ? <p>{message.body}</p> : <strong>{conversationEventText(message)}</strong>}
              <time dateTime={message.created_at}>{formatConversationTime(message.created_at)}</time>
            </article>;
          })}
        </div>
        <form action={sendDiscipleshipConversationMessage} className="my-discipleship-conversation-form">
          <input type="hidden" name="relationshipId" value={relationship.id} />
          <input type="hidden" name="returnTo" value="/familia/meus-discipulados" />
          <label htmlFor="discipleship-message">Mensagem para seu discipulador</label>
          <textarea id="discipleship-message" name="message" rows={3} maxLength={2000} placeholder="Escreva sua mensagem…" required />
          <DiscipleshipSubmitButton pendingLabel="Enviando…">Enviar mensagem</DiscipleshipSubmitButton>
        </form>
      </section>
    </>}
  </main>;
}

function formatConversationTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

function conversationEventText(message: ConversationMessage) {
  if (message.message_type === "request") return "Você pediu um novo discipulado.";
  if (message.message_type === "invitation") return "Seu discipulador enviou duas opções de horário.";
  if (message.message_type === "confirmation" && message.scheduled_at) return `Discipulado confirmado para ${formatDiscipleshipDate(message.scheduled_at)}.`;
  if (message.message_type === "manual_booking" && message.scheduled_at) return `Discipulado marcado para ${formatDiscipleshipDate(message.scheduled_at)}.`;
  return "O agendamento foi atualizado.";
}
