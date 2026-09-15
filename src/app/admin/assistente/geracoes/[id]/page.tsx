import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import "../../assistant.css";

export const metadata = { title: "Conversa da IA | Painel administrativo", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function GenerationPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("member_profiles")
    .select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin || profile.approval_status !== "approved") redirect("/admin");
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const { data: generation } = await supabase.from("assistant_generations")
    .select("id,question,answer,model,status,usage,created_at,completed_at")
    .eq("id", Number(id)).maybeSingle();
  if (!generation) notFound();
  return <main className="assistant-admin-page"><div className="assistant-admin-history"><Link href="/admin/assistente">← Voltar à IA da Casa</Link>
    <p className="home-kicker">Conversa #{generation.id}</p><h1>Pergunta recebida</h1><p>{generation.question}</p>
    <h2>Resposta</h2><p>{generation.answer || "Sem resposta concluída."}</p>
    <small>{generation.status} · {generation.model} · {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(generation.created_at))}</small>
  </div></main>;
}
