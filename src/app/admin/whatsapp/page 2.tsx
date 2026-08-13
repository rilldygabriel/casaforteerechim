import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { sendWhatsAppReply } from "./actions";
import "./whatsapp.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "WhatsApp | Painel administrativo", robots: { index: false, follow: false } };

export default async function WhatsAppInbox({ searchParams }: { searchParams: Promise<{ conversa?: string }> }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("member_profiles").select("is_admin").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin) redirect("/admin/login?erro=sem-permissao");
  const { data: conversations } = await supabase.from("whatsapp_conversations").select("id,phone,contact_name,last_message_at,last_message_preview,unread_count").order("last_message_at", { ascending: false });
  const requested = Number((await searchParams).conversa);
  const selected = conversations?.find((item) => item.id === requested) ?? conversations?.[0];
  const { data: messages } = selected ? await supabase.from("whatsapp_messages").select("id,direction,body,message_type,status,sent_at").eq("conversation_id", selected.id).order("sent_at") : { data: [] };
  if (selected?.unread_count) {
    await supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", selected.id);
  }

  return <main className="wa-admin-page">
    <header className="admin-section-header"><Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link><nav><Link href="/admin">Voltar ao painel</Link></nav></header>
    <section className="wa-admin-hero"><p className="section-eyebrow"><span />Atendimento pastoral</p><h1>WhatsApp</h1><p>Leia e responda às mensagens recebidas no número oficial da igreja.</p></section>
    <section className="wa-inbox">
      <aside><h2>Conversas</h2>{conversations?.length ? conversations.map((item) => <Link data-active={item.id === selected?.id} href={`/admin/whatsapp?conversa=${item.id}`} key={item.id}><strong>{item.contact_name || `+${item.phone}`}</strong><span>{item.last_message_preview || "Nova conversa"}</span>{item.unread_count > 0 ? <em>{item.unread_count}</em> : null}</Link>) : <p>Nenhuma mensagem recebida ainda.</p>}</aside>
      <div className="wa-thread">{selected ? <><header><h2>{selected.contact_name || `+${selected.phone}`}</h2><span>+{selected.phone}</span></header><div className="wa-messages">{messages?.map((item) => <article data-direction={item.direction} key={item.id}><p>{item.body || `[${item.message_type}]`}</p><small>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(item.sent_at))} · {item.status}</small></article>)}</div><form action={sendWhatsAppReply}><input type="hidden" name="conversationId" value={selected.id}/><textarea name="message" maxLength={4000} required placeholder="Escreva uma resposta..."/><button type="submit">Enviar pelo WhatsApp</button></form></> : <div className="wa-empty"><h2>Sua caixa de entrada está pronta</h2><p>As respostas aparecerão aqui assim que o webhook for conectado na Meta.</p></div>}</div>
    </section>
  </main>;
}
