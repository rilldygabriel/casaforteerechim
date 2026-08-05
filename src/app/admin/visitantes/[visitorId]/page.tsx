import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { getVisitorFollowupRoute, getVisitorFollowupStep } from "@/lib/visitor-followup";
import FollowupStepCard from "./followup-step-card";
import "./visitor-followup.css";

export const metadata: Metadata = { title: "Acompanhamento de visitante", robots: { index: false } };
export const dynamic = "force-dynamic";

function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export default async function VisitorFollowupPage({ params }: { params: Promise<{ visitorId: string }> }) {
  const { visitorId: rawId } = await params;
  const visitorId = Number(rawId);
  if (!Number.isSafeInteger(visitorId) || visitorId <= 0) notFound();

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const [{ data: profile }, { data: member }, { data: leader }] = await Promise.all([
    supabase.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle(),
    supabase.from("ministry_members").select("member_id").eq("member_id", user.id).eq("ministry_key", "connect_consolidacao").maybeSingle(),
    supabase.from("ministry_leaders").select("member_id").eq("member_id", user.id).eq("ministry_key", "connect_consolidacao").maybeSingle(),
  ]);
  if (!profile?.is_admin && !(profile?.approval_status === "approved" && (member || leader))) redirect("/admin");

  const [{ data: visitor }, { data: steps }] = await Promise.all([
    supabase.from("visitantes").select("id,nome,telefone,cidade,bairro,data_visita,convidado_por,status_acompanhamento").eq("id", visitorId).maybeSingle(),
    supabase.from("visitor_followup_steps").select("id,step_key,due_date,assigned_to,completed_by,completed_at,notes").eq("visitor_id", visitorId).order("due_date"),
  ]);
  if (!visitor) notFound();

  const peopleIds = [...new Set((steps ?? []).flatMap((step) => [step.assigned_to, step.completed_by]).filter(Boolean))] as string[];
  const service = getSupabaseServiceClient();
  const { data: people } = peopleIds.length
    ? await service.from("member_profiles").select("user_id,full_name").in("user_id", peopleIds)
    : { data: [] };
  const names = new Map((people ?? []).map((person) => [person.user_id, person.full_name]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const completed = (steps ?? []).filter((step) => step.completed_at).length;
  const whatsapp = phoneDigits(visitor.telefone);
  const route = getVisitorFollowupRoute(visitor.data_visita);

  return <main className="visitor-followup-page">
    <header className="visitor-followup-topbar"><Link href="/admin/visitantes">← Todos os visitantes</Link><Link href="/admin">Painel</Link></header>
    <section className="visitor-followup-hero">
      <p>Connect Consolidação</p><h1>{visitor.nome}</h1>
      <div><span>Visitou em {new Date(`${visitor.data_visita}T12:00:00`).toLocaleDateString("pt-BR")}</span><span>{visitor.cidade} · {visitor.bairro}</span></div>
      <nav><a href={`tel:${whatsapp}`}>Ligar</a><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">Abrir WhatsApp</a></nav>
    </section>
    <section className="visitor-followup-progress">
      <div><span>{route.label}</span><strong>{completed} de {(steps ?? []).length} etapas concluídas</strong></div>
      <progress value={completed} max={(steps ?? []).length || 1} />
      <p><strong>{route.description}</strong> Qualquer líder ou voluntário aprovado do Connect pode assumir e registrar cada contato. Pastores acompanham tudo pelo mesmo painel.</p>
    </section>
    <section className="visitor-followup-timeline" aria-label="Etapas do acompanhamento">
      {(steps ?? []).map((step, index) => {
        const content = getVisitorFollowupStep(step.step_key, visitor.data_visita);
        const message = `Olá, ${visitor.nome}! Somos da Igreja Casa Forte. ${content.whatsappMessage}`;
        return <FollowupStepCard key={step.id} stepNumber={index + 1} stepId={step.id} visitorId={visitor.id} title={content.title} description={content.description}
          dueLabel={new Date(`${step.due_date}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          status={step.completed_at ? "completed" : step.due_date <= today ? "overdue" : "pending"}
          assignedName={step.assigned_to ? names.get(step.assigned_to) || "Equipe Connect" : null}
          completedByName={step.completed_by ? names.get(step.completed_by) || "Equipe Connect" : null}
          completedLabel={step.completed_at ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(step.completed_at)) : null}
          notes={step.notes} whatsappUrl={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`} />;
      })}
    </section>
  </main>;
}
