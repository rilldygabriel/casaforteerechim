import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MINISTRIES } from "@/app/familia/servir/ministries";
import { removeMinistryAssignment } from "../actions";
import BulkAssignmentDialog from "../bulk-assignment-dialog";
import { getLeadershipAdmin, type MemberOption } from "../shared";
import "../leadership.css";

export const metadata: Metadata = { title: "Ministérios", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
type Assignment = { ministry_key: string; member_id: string };

export default async function MinistriesPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const supabase = await getLeadershipAdmin();
  const params = await searchParams;
  const [membersResult, leadersResult, participantsResult] = await Promise.all([
    supabase.from("member_profiles").select("user_id,full_name,email").eq("approval_status", "approved").order("full_name"),
    supabase.from("ministry_leaders").select("ministry_key,member_id"),
    supabase.from("ministry_members").select("ministry_key,member_id"),
  ]);
  const members = (membersResult.data ?? []) as MemberOption[];
  const memberById = new Map(members.map((member) => [member.user_id, member]));
  const leaders = (leadersResult.data ?? []) as Assignment[];
  const participants = (participantsResult.data ?? []) as Assignment[];
  const dialogMembers = members.map((member) => ({ userId: member.user_id, name: member.full_name, email: member.email }));

  return <main className="admin-visitors-page leadership-admin-page">
    <header className="admin-section-header"><Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link><nav><Link href="/admin">Voltar ao painel</Link></nav></header>
    <section className="admin-visitors-hero leadership-admin-hero"><p className="section-eyebrow"><span aria-hidden="true" />Classificação da Família</p><h1>Ministérios</h1><p>Organize líderes e participantes. Clique no nome de uma pessoa para consultar a ficha completa e a foto.</p></section>
    <nav className="leadership-tabs" aria-label="Áreas de classificação"><Link href="/admin/lideranca/discipuladores">Discipuladores</Link><Link href="/admin/lideranca/ministerios" aria-current="page">Ministérios <span>{MINISTRIES.length}</span></Link></nav>
    {(params.sucesso || params.erro) && <p className="leadership-feedback" data-kind={params.erro ? "error" : "success"} role="status">{params.erro ?? params.sucesso}</p>}
    <section className="leadership-ministries" aria-label="Ministérios da Casa">{MINISTRIES.map((ministry) => {
      const ministryLeaders = leaders.filter((item) => item.ministry_key === ministry.key);
      const ministryParticipants = participants.filter((item) => item.ministry_key === ministry.key);
      return <details className="leadership-ministry-card" key={ministry.key}><summary><div><span>Ministério</span><h2>{ministry.label}</h2></div><strong>{ministryLeaders.length} líder(es) · {ministryParticipants.length} participante(s)</strong></summary><div className="leadership-ministry-content">
        <div className="leadership-bulk-actions"><div><span>Liderança</span><strong>{ministryLeaders.length} selecionado(s)</strong><BulkAssignmentDialog ministryKey={ministry.key} ministryLabel={ministry.label} role="leader" members={dialogMembers} selectedMemberIds={ministryLeaders.map((item) => item.member_id)} /></div><div><span>Participantes</span><strong>{ministryParticipants.length} selecionado(s)</strong><BulkAssignmentDialog ministryKey={ministry.key} ministryLabel={ministry.label} role="member" members={dialogMembers} selectedMemberIds={ministryParticipants.map((item) => item.member_id)} /></div></div>
        <AssignmentGroup title="Liderança" empty="Nenhum líder definido." assignments={ministryLeaders} memberById={memberById} ministryKey={ministry.key} role="leader" />
        <AssignmentGroup title="Participantes" empty="Nenhum participante definido." assignments={ministryParticipants} memberById={memberById} ministryKey={ministry.key} role="member" />
      </div></details>;
    })}</section>
  </main>;
}

function AssignmentGroup({ title, empty, assignments, memberById, ministryKey, role }: { title: string; empty: string; assignments: Assignment[]; memberById: Map<string, MemberOption>; ministryKey: string; role: "leader" | "member" }) {
  return <section className="leadership-assignment-group"><h3>{title}</h3>{assignments.length === 0 ? <p>{empty}</p> : <div>{assignments.map((assignment) => { const member = memberById.get(assignment.member_id); if (!member) return null; return <article key={`${ministryKey}-${role}-${assignment.member_id}`}><Link className="leadership-profile-link" href={`/admin/membros/${assignment.member_id}`}>{member.full_name || member.email}<small>Abrir ficha com foto →</small></Link><form action={removeMinistryAssignment}><input type="hidden" name="memberId" value={assignment.member_id} /><input type="hidden" name="ministryKey" value={ministryKey} /><input type="hidden" name="role" value={role} /><button type="submit">Remover</button></form></article>; })}</div>}</section>;
}
