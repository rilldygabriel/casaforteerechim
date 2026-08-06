import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import "../role-panel.css";

export const metadata: Metadata = { title: "Meus discípulos", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function daysSince(date: string | undefined) { if (!date) return null; return Math.max(0, Math.floor((Date.now() - new Date(`${date}T12:00:00-03:00`).getTime()) / 86400000)); }

export default async function MyDisciplesPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const [{ data: profile }, { data: role }] = await Promise.all([
    supabase.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle(),
    supabase.from("discipler_roles").select("member_id").eq("member_id", user.id).maybeSingle(),
  ]);
  if (!profile || (!profile.is_admin && profile.approval_status !== "approved")) redirect("/familia");
  if (!profile.is_admin && !role) redirect("/admin");

  const { data: relationships } = await supabase.from("discipleship_relationships").select("id,disciple_id").eq("discipler_id", user.id).is("ended_at", null).order("created_at");
  const relationshipIds = (relationships ?? []).map((item) => item.id);
  const { data: sessions } = relationshipIds.length ? await supabase.from("discipleship_sessions").select("relationship_id,meeting_date").in("relationship_id", relationshipIds).order("meeting_date", { ascending: false }) : { data: [] };
  const service = getSupabaseServiceClient();
  const discipleIds = (relationships ?? []).map((item) => item.disciple_id);
  const { data: people } = discipleIds.length ? await service.from("member_profiles").select("user_id,full_name,email").in("user_id", discipleIds) : { data: [] };
  const peopleById = new Map((people ?? []).map((person) => [person.user_id, person]));
  const latestByRelationship = new Map<string, string>();
  for (const session of sessions ?? []) if (!latestByRelationship.has(session.relationship_id)) latestByRelationship.set(session.relationship_id, session.meeting_date);

  return <main className="admin-visitors-page"><header className="admin-section-header"><Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link><nav><Link href="/admin">Voltar ao painel</Link></nav></header><section className="admin-visitors-hero"><p className="section-eyebrow"><span aria-hidden="true" />Meu discipulado</p><h1>Meus discípulos</h1><p>Somente as pessoas confiadas ao seu cuidado aparecem aqui.</p></section><section className="role-panel-list"><article className="role-panel-card"><header><div><span>Acompanhamento pastoral</span><h2>Pessoas sob meu cuidado</h2></div><strong>{relationships?.length ?? 0} discípulo(s)</strong></header><div className="role-panel-people">{!relationships?.length ? <p className="role-panel-empty">Nenhum discípulo vinculado à sua conta ainda.</p> : relationships.map((relationship) => { const person = peopleById.get(relationship.disciple_id); const days = daysSince(latestByRelationship.get(relationship.id)); return <Link className="role-panel-person" href={`/familia/lideranca/discipulos/${relationship.id}`} key={relationship.id}><span>Discípulo(a)</span><h3>{person?.full_name || person?.email || "Membro da Família"}</h3><p>{days === null ? "Sem discipulado registrado" : days === 0 ? "Discipulado realizado hoje" : `Último discipulado há ${days} ${days === 1 ? "dia" : "dias"}`}</p><strong>Abrir acompanhamento →</strong></Link>; })}</div></article></section></main>;
}
