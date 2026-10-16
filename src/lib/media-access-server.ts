import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { canManageMediaAccess } from "@/lib/media-access-policy";
import { MediaError } from "@/lib/media-library-server";

export async function requireMediaAccessManager() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new MediaError("Entre novamente para gerenciar os acessos.", 401);
  const { data: profile, error } = await supabase.from("member_profiles")
    .select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (error) throw new MediaError("Não foi possível verificar sua permissão.", 503);
  if (!canManageMediaAccess(user.id, profile)) throw new MediaError("Somente o pastor responsável pode gerenciar os acessos aqui.", 403);
  return { supabase, user };
}
