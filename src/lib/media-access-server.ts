import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { canManageMediaAccess, canRevokeMediaAccess } from "@/lib/media-access-policy";
import { MediaError } from "@/lib/media-library-server";

export async function requireMediaAccessManager() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new MediaError("Entre novamente para gerenciar os acessos.", 401);
  const [profileResult, membershipResult] = await Promise.all([
    supabase.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle(),
    supabase.from("member_group_memberships").select("member_id,member_groups!inner(active)")
      .eq("member_id", user.id).eq("group_key", "midia").eq("member_groups.active", true).maybeSingle(),
  ]);
  if (profileResult.error || membershipResult.error) throw new MediaError("Não foi possível verificar sua permissão.", 503);
  const profile = profileResult.data;
  if (!canManageMediaAccess(user.id, profile, Boolean(membershipResult.data))) throw new MediaError("Somente o pastor responsável e pessoas liberadas em Mídias podem cadastrar a equipe.", 403);
  // Read the actor's live membership through their own session before obtaining
  // the privileged client. Routes expose only the roster and a fixed 'midia' grant;
  // existing member-profile and other-group RLS policies remain unchanged.
  return { supabase: getSupabaseServiceClient(), user, canRevoke: canRevokeMediaAccess(user.id, profile) };
}
