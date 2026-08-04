"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

async function getApprovedMember() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/familia/login?next=/familia/testemunhos");
  const { data: profile } = await supabase.from("member_profiles")
    .select("full_name,photo_url,is_admin,approval_status")
    .eq("user_id", user.id).maybeSingle();
  if (!profile || (!profile.is_admin && profile.approval_status !== "approved")) redirect("/familia");
  return { user, profile };
}

function refreshTestimonials() {
  revalidatePath("/");
  revalidatePath("/familia/testemunhos");
}

export async function saveTestimonial(formData: FormData) {
  const member = await getApprovedMember();
  const id = String(formData.get("testimonialId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (title.length < 3 || title.length > 120 || body.length < 10 || body.length > 3000) return;
  const service = getSupabaseServiceClient();
  const values = {
    user_id: member.user.id,
    author_name: member.profile.full_name.trim() || "Membro da Casa",
    author_photo_path: member.profile.photo_url || null,
    title,
    body,
    updated_at: new Date().toISOString(),
  };
  if (id) {
    await service.from("testimonials").update(values).eq("id", id).eq("user_id", member.user.id);
  } else {
    await service.from("testimonials").insert(values);
  }
  refreshTestimonials();
  redirect("/familia/testemunhos");
}

export async function deleteTestimonial(formData: FormData) {
  const member = await getApprovedMember();
  const id = String(formData.get("testimonialId") ?? "");
  if (!id) return;
  await getSupabaseServiceClient().from("testimonials").delete().eq("id", id).eq("user_id", member.user.id);
  refreshTestimonials();
}

export async function toggleTestimonialLike(formData: FormData) {
  const member = await getApprovedMember();
  const testimonialId = String(formData.get("testimonialId") ?? "");
  if (!testimonialId) return;
  const service = getSupabaseServiceClient();
  const { data: existing } = await service.from("testimonial_likes").select("testimonial_id")
    .eq("testimonial_id", testimonialId).eq("user_id", member.user.id).maybeSingle();
  if (existing) {
    await service.from("testimonial_likes").delete().eq("testimonial_id", testimonialId).eq("user_id", member.user.id);
  } else {
    await service.from("testimonial_likes").insert({ testimonial_id: testimonialId, user_id: member.user.id });
  }
  refreshTestimonials();
}

export async function addTestimonialComment(formData: FormData) {
  const member = await getApprovedMember();
  const testimonialId = String(formData.get("testimonialId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!testimonialId || body.length < 1 || body.length > 800) return;
  await getSupabaseServiceClient().from("testimonial_comments").insert({
    testimonial_id: testimonialId,
    user_id: member.user.id,
    author_name: member.profile.full_name.trim() || "Membro da Casa",
    body,
  });
  refreshTestimonials();
}

export async function deleteTestimonialComment(formData: FormData) {
  const member = await getApprovedMember();
  const commentId = String(formData.get("commentId") ?? "");
  if (!commentId) return;
  await getSupabaseServiceClient().from("testimonial_comments").delete().eq("id", commentId).eq("user_id", member.user.id);
  refreshTestimonials();
}
