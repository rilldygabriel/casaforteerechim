import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import "../members.css";

export const metadata: Metadata = { title: "Grupos de membros", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Group = { key: string; name: string; description: string; sort_order: number };
type Membership = { member_id: string; group_key: string };
type Member = { user_id: string; full_name: string | null; email: string };

export default async function MemberGroupsPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.is_admin || profile.approval_status !== "approved") redirect("/admin");

  const [groupsResult, membershipsResult, membersResult] = await Promise.all([
    supabase.from("member_groups").select("key,name,description,sort_order").eq("active", true).order("sort_order"),
    supabase.from("member_group_memberships").select("member_id,group_key"),
    supabase.from("member_profiles").select("user_id,full_name,email").order("full_name"),
  ]);

  const groups = (groupsResult.data ?? []) as Group[];
  const memberships = (membershipsResult.data ?? []) as Membership[];
  const members = (membersResult.data ?? []) as Member[];
  const memberById = new Map(members.map((member) => [member.user_id, member]));

  return (
    <main className="admin-visitors-page admin-member-groups-page">
      <header className="admin-section-header">
        <Link href="/admin" aria-label="Voltar ao início do painel">
          <Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={190} height={74} priority />
        </Link>
        <nav aria-label="Navegação administrativa">
          <Link href="/admin/membros">Voltar aos membros</Link>
        </nav>
      </header>

      <section className="admin-visitors-hero">
        <p className="section-eyebrow"><span aria-hidden="true" />Organização da Família</p>
        <h1>Grupos de membros</h1>
        <p>Veja quem pertence a cada grupo. Para alterar, abra a ficha da pessoa e marque as opções desejadas.</p>
      </section>

      <section className="admin-member-group-directory">
        {groups.map((group) => {
          const groupMembers = memberships
            .filter((membership) => membership.group_key === group.key)
            .map((membership) => memberById.get(membership.member_id))
            .filter((member): member is Member => Boolean(member));

          return (
            <article key={group.key} className="admin-member-group-directory-card">
              <header>
                <div><span>Grupo da Casa</span><h2>{group.name}</h2><p>{group.description}</p></div>
                <strong>{groupMembers.length}</strong>
              </header>
              <div className="admin-member-group-people">
                {groupMembers.length ? groupMembers.map((member) => (
                  <Link href={`/admin/membros/${member.user_id}`} key={member.user_id}>
                    <span>{member.full_name || member.email}</span>
                    <small>Abrir ficha →</small>
                  </Link>
                )) : <p>Nenhum membro classificado neste grupo.</p>}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
