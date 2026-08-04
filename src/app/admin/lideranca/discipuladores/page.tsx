import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { addDiscipler, removeDiscipler } from "../actions";
import { getLeadershipAdmin, type MemberOption } from "../shared";
import "../leadership.css";

export const metadata: Metadata = { title: "Discipuladores", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DisciplersPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const supabase = await getLeadershipAdmin();
  const params = await searchParams;
  const [membersResult, disciplersResult] = await Promise.all([
    supabase.from("member_profiles").select("user_id,full_name,email").eq("approval_status", "approved").order("full_name"),
    supabase.from("discipler_roles").select("member_id"),
  ]);
  const members = (membersResult.data ?? []) as MemberOption[];
  const memberById = new Map(members.map((member) => [member.user_id, member]));
  const disciplerIds = new Set((disciplersResult.data ?? []).map((item) => item.member_id));

  return (
    <main className="admin-visitors-page leadership-admin-page">
      <header className="admin-section-header">
        <Link href="/admin"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority /></Link>
        <nav aria-label="Navegação administrativa"><Link href="/admin">Voltar ao painel</Link></nav>
      </header>
      <section className="admin-visitors-hero leadership-admin-hero">
        <p className="section-eyebrow"><span aria-hidden="true" />Classificação da Família</p>
        <h1>Discipuladores</h1>
        <p>Defina quem exerce o discipulado. Clique em qualquer pessoa para abrir sua ficha completa, com foto e dados.</p>
      </section>
      <nav className="leadership-tabs" aria-label="Áreas de classificação">
        <Link href="/admin/lideranca/discipuladores" aria-current="page">Discipuladores <span>{disciplerIds.size}</span></Link>
        <Link href="/admin/lideranca/ministerios">Ministérios</Link>
      </nav>
      {(params.sucesso || params.erro) && <p className="leadership-feedback" data-kind={params.erro ? "error" : "success"} role="status">{params.erro ?? params.sucesso}</p>}
      <section className="leadership-panel" aria-labelledby="discipler-title">
        <header>
          <div><span>Área de discipulado</span><h2 id="discipler-title">Discipuladores</h2><p>Essa função é independente de qualquer ministério.</p></div>
          <form action={addDiscipler} className="leadership-add-form">
            <label htmlFor="discipler-member">Escolha uma pessoa</label>
            <div><select id="discipler-member" name="memberId" required><option value="">Selecionar membro</option>{members.filter((member) => !disciplerIds.has(member.user_id)).map((member) => <option value={member.user_id} key={member.user_id}>{member.full_name || member.email}</option>)}</select><button type="submit">Salvar discipulador</button></div>
          </form>
        </header>
        <div className="leadership-saved-list">
          {disciplerIds.size === 0 ? <p className="leadership-empty">Nenhum discipulador classificado.</p> : Array.from(disciplerIds).map((memberId) => {
            const member = memberById.get(memberId); if (!member) return null;
            return <article key={memberId}><Link className="leadership-profile-link" href={`/admin/membros/${memberId}`}><strong>{member.full_name || member.email}</strong><small>Abrir ficha completa com foto →</small></Link><form action={removeDiscipler}><input type="hidden" name="memberId" value={memberId} /><button type="submit">Remover função</button></form></article>;
          })}
        </div>
      </section>
    </main>
  );
}
