import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { MINISTRIES } from "./ministries";
import ServeMinistryButton from "./serve-ministry-button";

export const metadata: Metadata = {
  title: "Quero servir na Casa",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function ServirNaCasa() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/familia/login");
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  const canAccess =
    profile?.is_admin || profile?.approval_status === "approved";

  if (!canAccess) {
    redirect("/familia");
  }

  return (
    <main className="inner-page family-page">
      <header className="inner-header">
        <Link href="/" aria-label="Voltar para o início">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={180}
            height={70}
          />
        </Link>
        <Link className="inner-back" href="/familia">
          Voltar à Minha Família
        </Link>
      </header>

      <section className="family-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Servir na Casa
        </p>
        <h1>
          Quero começar a
          <strong> servir na Casa.</strong>
        </h1>
        <p className="family-hero-copy">
          Escolha o ministério onde você quer servir. Vamos avisar o líder na
          hora, pelo WhatsApp, com seu nome e contato.
        </p>
      </section>

      <section className="serve-grid" aria-label="Ministérios da Casa">
        {MINISTRIES.map((ministry) => (
          <article className="family-menu-card" key={ministry.key}>
            <h2>{ministry.label}</h2>
            <p>
              {ministry.leaders.length > 1
                ? `Líderes: ${ministry.leaders.map((leader) => leader.name).join(" e ")}`
                : `Líder: ${ministry.leaders[0].name}`}
            </p>
            <ServeMinistryButton
              ministryKey={ministry.key}
              label={ministry.label}
            />
          </article>
        ))}
      </section>
    </main>
  );
}
