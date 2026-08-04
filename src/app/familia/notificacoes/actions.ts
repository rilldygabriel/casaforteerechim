"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

async function getApprovedUser() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("member_profiles")
    .select("full_name,is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile || (!profile.is_admin && profile.approval_status !== "approved")) return null;
  return { user, profile };
}

export async function markAllFamilyAnnouncementsRead() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: announcements } = await supabase.from("family_announcements").select("id").limit(200);
  if (!announcements?.length) return;
  await supabase.from("family_announcement_reads").upsert(
    announcements.map((item) => ({ announcement_id: item.id, user_id: user.id, read_at: new Date().toISOString() })),
    { onConflict: "announcement_id,user_id" },
  );
  revalidatePath("/familia");
  revalidatePath("/familia/notificacoes");
}

export async function toggleFamilyAnnouncementLike(formData: FormData) {
  const announcementId = String(formData.get("announcementId") ?? "");
  const member = await getApprovedUser();
  if (!member || !announcementId) return;
  const service = getSupabaseServiceClient();
  const { data: existing } = await service
    .from("family_announcement_likes")
    .select("announcement_id")
    .eq("announcement_id", announcementId)
    .eq("user_id", member.user.id)
    .maybeSingle();
  if (existing) {
    await service.from("family_announcement_likes").delete().eq("announcement_id", announcementId).eq("user_id", member.user.id);
  } else {
    await service.from("family_announcement_likes").insert({ announcement_id: announcementId, user_id: member.user.id });
  }
  revalidatePath("/familia/notificacoes");
}

export async function addFamilyAnnouncementComment(formData: FormData) {
  const announcementId = String(formData.get("announcementId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const member = await getApprovedUser();
  if (!member || !announcementId || body.length < 1 || body.length > 800) return;
  const service = getSupabaseServiceClient();
  await service.from("family_announcement_comments").insert({
    announcement_id: announcementId,
    user_id: member.user.id,
    author_name: member.profile.full_name.trim() || "Membro da Casa",
    body,
  });
  revalidatePath("/familia/notificacoes");
}

export async function deleteFamilyAnnouncementComment(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "");
  const member = await getApprovedUser();
  if (!member || !commentId) return;
  const service = getSupabaseServiceClient();
  await service.from("family_announcement_comments").delete().eq("id", commentId).eq("user_id", member.user.id);
  revalidatePath("/familia/notificacoes");
}
