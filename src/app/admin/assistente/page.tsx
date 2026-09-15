import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import "./assistant.css";

export const metadata = { title: "IA da Casa | Painel administrativo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function verifiedAdmin() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("member_profiles")
    .select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin || profile.approval_status !== "approved") redirect("/admin");
  return { supabase, user };
}

async function saveKnowledge(formData: FormData) {
  "use server";
  const { supabase, user } = await verifiedAdmin();
  const id = Number(formData.get("id") ?? 0);
  const question = String(formData.get("question") ?? "").trim();
  const answer = String(formData.get("answer") ?? "").trim();
  const sourceUrl = String(formData.get("source_url") ?? "").trim();
  const published = formData.get("published") === "on";
  if (question.length < 5 || question.length > 240 || answer.length < 5 || answer.length > 4000) {
    redirect("/admin/assistente?erro=tamanho");
  }
  if (sourceUrl && (!sourceUrl.startsWith("/") || sourceUrl.startsWith("//") || sourceUrl.length > 500)) {
    redirect("/admin/assistente?erro=fonte");
  }
  const value = { question, answer, source_url: sourceUrl || null, published,
    updated_by: user.id, updated_at: new Date().toISOString() };
  const operation = Number.isSafeInteger(id) && id > 0
    ? supabase.from("assistant_knowledge").update(value).eq("id", id)
    : supabase.from("assistant_knowledge").insert(value);
  const { error } = await operation;
  if (error) redirect("/admin/assistente?erro=salvar");
  revalidatePath("/admin/assistente");
  redirect("/admin/assistente?salvo=1");
}

export default async function AssistantKnowledgePage({ searchParams }: { searchParams: Promise<{ erro?: string; salvo?: string }> }) {
  const { supabase } = await verifiedAdmin();
  const { data: knowledge } = await supabase.from("assistant_knowledge")
    .select("id,question,answer,source_url,published,updated_at")
    .order("updated_at", { ascending: false }).limit(100);
  const { data: generations } = await supabase.from("assistant_generations")
    .select("id,question,status,created_at").order("created_at", { ascending: false }).limit(15);
  const params = await searchParams;
  return <main className="assistant-admin-page">
    <header className="admin-section-header"><Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link><nav><Link href="/admin">Voltar ao painel</Link></nav></header>
    <section className="assistant-admin-hero"><p className="section-eyebrow"><span aria-hidden="true" />Inteligência da Casa</p><h1>Ensine a IA da Casa</h1><p>Cadastre respostas verificadas. Só o que você marcar como público poderá ser usado para responder no site.</p></section>
    {params.salvo ? <p className="assistant-admin-success" role="status">Informação salva.</p> : null}
    {params.erro ? <p className="assistant-admin-error" role="alert">Não foi possível salvar. Confira o tamanho dos textos e use uma fonte do próprio site.</p> : null}
    <section className="assistant-admin-grid">
      <article className="assistant-admin-card"><p className="home-kicker">Nova informação</p><h2>Uma resposta de cada vez</h2><p>Não publique dados de membros, finanças ou anotações de discipulado.</p>
        <KnowledgeForm action={saveKnowledge} />
      </article>
      <article className="assistant-admin-card"><p className="home-kicker">Base de conhecimento</p><h2>O que a IA sabe</h2>
        {knowledge?.length ? <div className="assistant-admin-list">{knowledge.map((item) => <details key={item.id}>
          <summary><span>{item.question}</span><strong>{item.published ? "Público" : "Rascunho"}</strong></summary>
          <KnowledgeForm action={saveKnowledge} item={item} />
        </details>)}</div> : <p>Nenhuma resposta cadastrada.</p>}
      </article>
    </section>
    <section className="assistant-admin-history"><p className="home-kicker">Respostas da IA</p><h2>Últimas conversas no site</h2>
      <p>Use as perguntas recebidas para melhorar a base. Não copie dados pessoais para respostas públicas.</p>
      {generations?.length ? <div>{generations.map((item) => <Link href={`/admin/assistente/geracoes/${item.id}`} key={item.id}><span>{item.question}</span><small>{item.status} · {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</small></Link>)}</div> : <p>Ainda não há perguntas.</p>}
    </section>
  </main>;
}

function KnowledgeForm({ action, item }: { action: (data: FormData) => Promise<void>; item?: { id: number; question: string; answer: string; source_url: string | null; published: boolean } }) {
  return <form action={action} className="assistant-knowledge-form">
    {item ? <input type="hidden" name="id" value={item.id} /> : null}
    <label>Pergunta ou assunto<input name="question" required minLength={5} maxLength={240} defaultValue={item?.question} placeholder="Ex.: Qual é o horário do culto de domingo?" /></label>
    <label>Resposta verificada<textarea name="answer" required minLength={5} maxLength={4000} rows={5} defaultValue={item?.answer} placeholder="Escreva apenas informações confirmadas da Casa." /></label>
    <label>Fonte no site (opcional)<input name="source_url" maxLength={500} defaultValue={item?.source_url ?? ""} placeholder="/calendario" /></label>
    <label className="assistant-publish-check"><input type="checkbox" name="published" defaultChecked={item?.published ?? false} />Liberar esta resposta para o chat público</label>
    <button type="submit">{item ? "Salvar alterações" : "Cadastrar informação"}</button>
  </form>;
}
