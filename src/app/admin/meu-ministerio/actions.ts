"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export async function reviewServeRequest(formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "");
  const ministryKey = String(formData.get("ministryKey") ?? "");
  const decision = String(formData.get("decision") ?? "");

  if (
    !/^[0-9a-f-]{36}$/i.test(memberId) ||
    !ministryKey ||
    !["approve", "reject"].includes(decision)
  ) {
    throw new Error("Pedido inválido.");
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sua sessão expirou.");

  const [{ data: profile }, { data: leadership }] = await Promise.all([
    supabase
      .from("member_profiles")
      .select("is_admin,approval_status")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("ministry_leaders")
      .select("member_id")
      .eq("member_id", user.id)
      .eq("ministry_key", ministryKey)
      .maybeSingle(),
  ]);

  const canReview =
    Boolean(profile?.is_admin) ||
    Boolean(profile?.approval_status === "approved" && leadership);
  if (!canReview) throw new Error("Você não pode analisar este pedido.");

  const service = getSupabaseServiceClient();
  const { data: request } = await service
    .from("ministry_membership_requests")
    .select("member_id")
    .eq("member_id", memberId)
    .eq("ministry_key", ministryKey)
    .eq("status", "pending")
    .maybeSingle();
  if (!request) throw new Error("Este pedido já foi analisado.");

  if (decision === "approve") {
    const { error: assignmentError } = await service
      .from("ministry_members")
      .upsert(
        {
          ministry_key: ministryKey,
          member_id: memberId,
          assigned_by: user.id,
        },
        { onConflict: "ministry_key,member_id" },
      );
    if (assignmentError) throw new Error("Não foi possível incluir o membro.");
  }

  const now = new Date().toISOString();
  const { error: reviewError } = await service
    .from("ministry_membership_requests")
    .update({
      status: decision === "approve" ? "approved" : "rejected",
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("member_id", memberId)
    .eq("ministry_key", ministryKey)
    .eq("status", "pending");
  if (reviewError) throw new Error("Não foi possível concluir a análise.");

  revalidatePath("/admin");
  revalidatePath("/admin/meu-ministerio");
  revalidatePath("/familia/lideranca");
}
