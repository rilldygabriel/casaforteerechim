import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getFinanceUser() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("member_profiles").select("is_admin,can_manage_finance").eq("user_id", user.id).maybeSingle();
  return profile?.is_admin || profile?.can_manage_finance ? user : null;
}
