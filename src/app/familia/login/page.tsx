import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import MemberLoginForm from "./member-login-form";

export const metadata: Metadata = {
  title: "Entrar na Família",
  robots: {
    index: false,
    follow: false,
  },
};

type MemberLoginPageProps = {
  searchParams: Promise<{
    erro?: string;
  }>;
};

export default async function MemberLoginPage({
  searchParams,
}: MemberLoginPageProps) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/familia");
  }

  const params = await searchParams;
  const initialError =
    params.erro === "link-invalido"
      ? "Este link expirou ou não é mais válido."
      : "";

  return <MemberLoginForm initialError={initialError} />;
}
