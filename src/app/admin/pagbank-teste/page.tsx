import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import PagBankTestClient from "./pagbank-test-client";

export const metadata: Metadata = {
  title: "Teste PagBank | Painel administrativo",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const OWNER_USER_ID = "34944370-8853-4c1b-866b-8c80b4e59829";

export default async function PagBankTestPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  if (user.id !== OWNER_USER_ID) redirect("/admin");
  return <PagBankTestClient />;
}
