import { revalidatePath } from "next/cache";
import { requireMediaAccessManager } from "@/lib/media-access-server";
import { parseMediaAccessChange, type MediaAccessMember } from "@/lib/media-access-policy";
import { checkMediaOrigin, mediaError, MediaError, readMediaJson } from "@/lib/media-library-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const { supabase } = await requireMediaAccessManager();
    const members: MediaAccessMember[] = [];
    // Fetch every profile, including registrations awaiting approval; never silently truncate at 1,000.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("member_profiles")
        .select("user_id,full_name,approval_status,is_admin,member_group_memberships!member_group_memberships_member_id_fkey(group_key)")
        .order("full_name").order("user_id").range(offset, offset + 499);
      if (error) throw error;
      for (const member of data ?? []) {
        members.push({ user_id: member.user_id, full_name: member.full_name,
          approval_status: member.approval_status, is_admin: member.is_admin,
          media_enabled: member.member_group_memberships.some((group) => group.group_key === "midia") });
      }
      if (!data || data.length < 500) break;
    }
    return Response.json({ members }, { headers });
  } catch (error) { return mediaError(error); }
}

export async function PATCH(request: Request) {
  try {
    checkMediaOrigin(request);
    const { supabase, user, canRevoke } = await requireMediaAccessManager();
    const change = parseMediaAccessChange(await readMediaJson(request));
    if (!change) throw new MediaError("Seleção inválida.");
    if (!change.enabled && !canRevoke) throw new MediaError("Você pode adicionar pessoas. Somente o pastor responsável pode retirar acessos.", 403);
    const { data: member, error: memberError } = await supabase.from("member_profiles")
      .select("user_id,is_admin").eq("user_id", change.memberId).maybeSingle();
    if (memberError) throw memberError;
    if (!member) throw new MediaError("Cadastro não encontrado.", 404);
    if (member.is_admin) throw new MediaError("Administradores já têm acesso. Nenhuma permissão administrativa foi alterada.", 409);
    // Only touch Mídias. Never replace the member's other groups or approve their account.
    const result = change.enabled
      ? await supabase.from("member_group_memberships").upsert({ member_id: change.memberId, group_key: "midia", assigned_by: user.id }, { onConflict: "member_id,group_key", ignoreDuplicates: true })
      : await supabase.from("member_group_memberships").delete().eq("member_id", change.memberId).eq("group_key", "midia");
    if (result.error) throw result.error;
    const { data: saved, error } = await supabase.from("member_group_memberships").select("member_id")
      .eq("member_id", change.memberId).eq("group_key", "midia").maybeSingle();
    if (error || Boolean(saved) !== change.enabled) throw new MediaError("Não foi possível confirmar a alteração. Recarregue a lista antes de tentar novamente.", 503);
    for (const path of ["/admin", "/admin/midias", "/admin/midias/acessos", "/admin/pronto-para-postar", "/familia", "/admin/membros/grupos", `/admin/membros/${change.memberId}`]) revalidatePath(path);
    return Response.json({ enabled: Boolean(saved) }, { headers });
  } catch (error) { return mediaError(error); }
}
