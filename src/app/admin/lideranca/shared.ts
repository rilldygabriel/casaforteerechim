import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type MemberOption = {
  user_id: string;
  full_name: string;
  email: string;
};

export async function getLeadershipAdmin() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin || profile.approval_status !== "approved") {
    redirect("/familia");
  }

  return supabase;
}
