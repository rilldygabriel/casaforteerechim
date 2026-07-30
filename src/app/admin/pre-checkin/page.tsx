import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatProgramDate, getNextSundayDate } from "@/lib/programs";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import "./pre-checkin.css";

export const metadata: Metadata = {
  title: "Pré-check-in dos cultos",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type CheckinRecord = {
  id: number;
  event_date: string;
  nome: string;
  telefone: string | null;
  resposta: "presencial" | "nao_vou" | "live";
  created_at: string;
};

const answerInfo = {
  presencial: { label: "Estará na Casa", className: "is-present" },
  nao_vou: { label: "Não poderá estar", className: "is-away" },
  live: { label: "Assistirá pela live", className: "is-live" },
} as const;

function whatsappUrl(phone: string) {
  const number = phone.startsWith("55") ? phone : `55${phone}`;
  return `https://wa.me/${number}`;
}

export default async function AdminPreCheckinPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    await supabase.auth.signOut({ scope: "local" });
    redirect("/admin/login?erro=sem-permissao");
  }

  const eventDate = getNextSundayDate();
  const { data, error } = await supabase
    .from("culto_checkins")
    .select("id,event_date,nome,telefone,resposta,created_at")
    .eq("event_date", eventDate)
    .order("created_at", { ascending: false });
  const checkins = (data ?? []) as CheckinRecord[];
  const counts = {
    presencial: checkins.filter((item) => item.resposta === "presencial").length,
    nao_vou: checkins.filter((item) => item.resposta === "nao_vou").length,
    live: checkins.filter((item) => item.resposta === "live").length,
  };

  return (
    <main className="admin-visitors-page admin-checkin-page">
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
          Programações
        </p>
        <h1>Pré-check-in</h1>
        <p>
          Culto Domingo na Casa — {formatProgramDate(eventDate)}. As respostas
          aparecem aqui assim que forem enviadas pelo site.
        </p>
      </section>

      <section className="admin-checkin-metrics" aria-label="Resumo do culto">
        <article className="is-present">
          <span>Na Casa</span>
          <strong>{counts.presencial}</strong>
        </article>
        <article className="is-away">
          <span>Não poderão</span>
          <strong>{counts.nao_vou}</strong>
        </article>
        <article className="is-live">
          <span>Pela live</span>
          <strong>{counts.live}</strong>
        </article>
      </section>

      <section className="admin-checkin-content">
        <header>
          <div>
            <p>Respostas recebidas</p>
            <h2>{checkins.length} no total</h2>
          </div>
        </header>

        {error ? (
          <p className="admin-checkin-empty" role="alert">
            Não foi possível carregar as respostas agora.
          </p>
        ) : checkins.length === 0 ? (
          <p className="admin-checkin-empty">
            Nenhuma resposta recebida para este culto ainda.
          </p>
        ) : (
          <ol className="admin-checkin-list">
            {checkins.map((checkin) => {
              const info = answerInfo[checkin.resposta];
              return (
                <li key={checkin.id}>
                  <div>
                    <strong>{checkin.nome}</strong>
                    <span className={info.className}>{info.label}</span>
                  </div>
                  {checkin.telefone ? (
                    <a
                      href={whatsappUrl(checkin.telefone)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {checkin.telefone}
                    </a>
                  ) : (
                    <span>Identificado pela Área de Membro</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
