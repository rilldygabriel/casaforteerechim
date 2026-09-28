import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PAGBANK_TEST_OWNER } from "@/lib/pagbank-production-test";
import PagBankValidation from "./validation-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Validação privada PagBank | Casa Forte", robots: { index: false, follow: false } };
export default async function Page() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  if (user.id !== PAGBANK_TEST_OWNER) redirect("/admin");
  return <PagBankValidation />;
}
