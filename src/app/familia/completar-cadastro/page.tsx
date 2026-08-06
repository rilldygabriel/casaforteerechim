import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import CompleteGoogleSignupForm from "./complete-google-signup-form";

export const metadata: Metadata = {
  title: "Completar cadastro | Família",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CompleteGoogleSignupPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/familia/cadastro");
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("full_name,phone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profile?.phone?.replace(/\D/g, "").length >= 10) {
    redirect("/familia");
  }

  const suggestedName =
    profile?.full_name ||
    String(user.user_metadata?.full_name || user.user_metadata?.name || "");

  return (
    <main className="admin-auth-page">
      <section className="admin-auth-card family-auth-card family-signup-card">
        <Link href="/" aria-label="Voltar para o site da Casa Forte">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={220}
            height={85}
            priority
          />
        </Link>

        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Cadastro com Google
        </p>
        <h1>Só falta seu WhatsApp.</h1>
        <p>
          Confirme seus dados para a liderança identificar e aprovar seu acesso
          à Área da Família.
        </p>

        <CompleteGoogleSignupForm initialName={suggestedName} />
      </section>
    </main>
  );
}
