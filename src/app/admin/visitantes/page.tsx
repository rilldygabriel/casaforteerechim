import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import VisitorsList, { type VisitorRecord } from "./visitors-list";
import "../inbox-list.css";

export const metadata: Metadata = {
  title: "Visitantes",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

const VISITOR_FIELDS =
  "id,nome,telefone,cidade,bairro,acompanhamento,convidado_por,igreja_anterior,passo_fe,mensagem_pastor,experiencia_culto,voltar_culto,data_visita,status_acompanhamento,created_at,opened_at" as const;

export default async function AdminVisitorsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const [{ data: profile }, { data: ministryMember }, { data: ministryLeader }] =
    await Promise.all([
      supabase
        .from("member_profiles")
        .select("is_admin,approval_status")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("ministry_members")
        .select("member_id")
        .eq("member_id", user.id)
        .eq("ministry_key", "connect_consolidacao")
        .maybeSingle(),
      supabase
        .from("ministry_leaders")
        .select("member_id")
        .eq("member_id", user.id)
        .eq("ministry_key", "connect_consolidacao")
        .maybeSingle(),
    ]);

  const canManageVisitors = Boolean(
    profile?.is_admin ||
      (profile?.approval_status === "approved" && (ministryMember || ministryLeader)),
  );

  if (!canManageVisitors) {
    redirect("/admin");
  }

  const [{ data, error }, { data: followupSteps }] = await Promise.all([
    supabase.from("visitantes").select(VISITOR_FIELDS).order("created_at", { ascending: false }),
    supabase.from("visitor_followup_steps").select("visitor_id,due_date,completed_at"),
  ]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const followupSummary = Object.fromEntries(
    (data ?? []).map((visitor) => {
      const steps = (followupSteps ?? []).filter((step) => step.visitor_id === visitor.id);
      return [visitor.id, {
        completed: steps.filter((step) => step.completed_at).length,
        pending: steps.filter((step) => !step.completed_at).length,
        overdue: steps.filter((step) => !step.completed_at && step.due_date <= today).length,
      }];
    }),
  );

  return (
    <main className="admin-visitors-page">
      <header className="admin-section-header">
        <Link href="/admin" aria-label="Voltar ao início do painel">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={190}
            height={74}
            priority
          />
        </Link>
        <nav aria-label="Navegação administrativa">
          <Link href="/admin">Voltar ao painel</Link>
        </nav>
      </header>

      <section className="admin-visitors-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Acolhimento
        </p>
        <h1>Visitantes</h1>
        <p>
          Consulte as fichas enviadas pelo site e registre o andamento de cada
          acolhimento. O acesso é reservado à administração e à equipe do
          Connect Consolidação.
        </p>
      </section>

      <VisitorsList
        visitors={(data ?? []) as VisitorRecord[]}
        hasLoadError={Boolean(error)}
        followupSummary={followupSummary}
      />
    </main>
  );
}
