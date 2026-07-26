import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import MemberSignupForm from "./member-signup-form";

export const metadata: Metadata = {
  title: "Cadastro da Família",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MemberSignupPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/familia");
  }

  return <MemberSignupForm />;
}
