import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const GROUP_URL =
  "https://chat.whatsapp.com/Ix3EKdZymHEAhYpgVqUzQG?mode=gi_t";
const PASTOR_URL = "https://wa.me/5554992640253";

export const metadata: Metadata = {
  title: "Família",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function Familia() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/familia/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("member_profiles")
    .select("full_name,is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  async function signOut() {
    "use server";
    const serverSupabase = await getSupabaseServerClient();
    await serverSupabase.auth.signOut();
    redirect("/familia/login");
  }

  const canAccess =
    profile?.is_admin || profile?.approval_status === "approved";

  if (profileError || !profile) {
    return (
      <main className="inner-page family-page">
        <FamilyHeader signOut={signOut} />
        <FamilyAccessState
          eyebrow="Verificação de acesso"
          title="Não foi possível verificar seu cadastro."
          description="Nenhum dado foi alterado. Saia da conta e entre novamente. Se o problema continuar, fale com a Casa Forte."
          contact
        />
      </main>
    );
  }

  if (!canAccess) {
    const rejected = profile.approval_status === "rejected";

    return (
      <main className="inner-page family-page">
        <FamilyHeader signOut={signOut} />
        <FamilyAccessState
          eyebrow={rejected ? "Acesso não liberado" : "Cadastro confirmado"}
          title={
            rejected
              ? "Seu acesso ainda não foi liberado."
              : "Aguardando aprovação."
          }
          description={
            rejected
              ? "A liderança precisa revisar seu cadastro antes de liberar a Área da Família. Fale com a Casa Forte se precisar de ajuda."
              : "Seu cadastro chegou com segurança. Assim que a liderança aprovar, esta página será liberada automaticamente."
          }
          contact={rejected}
        />
      </main>
    );
  }

  return (
    <main className="inner-page family-page">
      <FamilyHeader signOut={signOut} />

      <section className="family-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Sou da Casa
        </p>
        <h1>
          Aqui você é
          <strong>família.</strong>
        </h1>
        <p>
          Este é o espaço de quem vive a Casa durante a semana e quer seguir
          crescendo junto.
        </p>
        <p className="family-welcome">
          Acesso de <strong>{profile.full_name || user.email}</strong>
        </p>
      </section>

      <section className="family-menu" aria-label="Menu da Família Casa Forte">
        <article className="family-menu-card">
          <span>01</span>
          <h2>Minha caminhada</h2>
          <p>Acompanhe seus próximos passos e continue crescendo na fé.</p>
          <a href={GROUP_URL} target="_blank" rel="noreferrer">
            Acessar grupo oficial
          </a>
        </article>
        <article className="family-menu-card">
          <span>02</span>
          <h2>Palavra da semana</h2>
          <p>Mensagens e conteúdos para fortalecer sua vida durante a semana.</p>
          <a
            href="https://youtube.com/@igrejacasaforte-erechim5031"
            target="_blank"
            rel="noreferrer"
          >
            Ver mensagens
          </a>
        </article>
        <article className="family-menu-card">
          <span>03</span>
          <h2>Meu Devocional</h2>
          <p>Um espaço para fortalecer sua fé e caminhar com a Casa.</p>
          <a
            href="https://ig.me/j/AbbdKixwGYdyTwoi/"
            target="_blank"
            rel="noreferrer"
          >
            Acessar canal do Pastor
          </a>
        </article>
        <article className="family-menu-card">
          <span>04</span>
          <h2>Agenda da Casa</h2>
          <p>Domingo às 19h, quarta às 19h30 e sexta às 19h30.</p>
          <Link href="/#proximos-passos">Ver programação</Link>
        </article>
        <article className="family-menu-card">
          <span>05</span>
          <h2>Pedidos de Oração</h2>
          <p>Envie seu pedido e permita que nossa equipe caminhe com você.</p>
          <Link href="/oracao">Enviar pedido</Link>
        </article>
        <article className="family-menu-card">
          <span>06</span>
          <h2>Falar com um Pastor</h2>
          <p>Conte com orientação, cuidado e acompanhamento pastoral.</p>
          <a href={PASTOR_URL} target="_blank" rel="noreferrer">
            Chamar no WhatsApp
          </a>
        </article>
        <article className="family-menu-card family-menu-featured">
          <span>07</span>
          <h2>Generosidade</h2>
          <p>
            Primícias: <strong>54993217227</strong>
            <br />
            Dízimos e ofertas: <strong>46534858000137</strong>
          </p>
          <Link href="/generosidade">Ver formas de contribuir</Link>
        </article>
      </section>
    </main>
  );
}

function FamilyHeader({
  signOut,
}: {
  signOut: () => Promise<void>;
}) {
  return (
    <header className="inner-header">
      <Link href="/" aria-label="Voltar para o início">
        <Image
          src="/images/logo-casa-forte.png"
          alt="Igreja Casa Forte"
          width={180}
          height={70}
        />
      </Link>
      <div className="family-header-actions">
        <Link className="inner-back" href="/">
          Voltar ao site
        </Link>
        <form action={signOut}>
          <button type="submit">Sair</button>
        </form>
      </div>
    </header>
  );
}

function FamilyAccessState({
  eyebrow,
  title,
  description,
  contact = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  contact?: boolean;
}) {
  return (
    <section className="family-access-state">
      <p className="section-eyebrow">
        <span aria-hidden="true" />
        {eyebrow}
      </p>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>
        <Link href="/">Voltar ao site</Link>
        {contact ? (
          <a href={PASTOR_URL} target="_blank" rel="noreferrer">
            Falar com a Casa
          </a>
        ) : null}
      </div>
    </section>
  );
}
