"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { findMinistry } from "@/app/familia/servir/ministries";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getCurrentAdmin() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null };
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  return {
    supabase,
    user:
      profile?.is_admin && profile.approval_status === "approved" ? user : null,
  };
}

function redirectWithMessage(
  tab: "discipuladores" | "ministerios",
  kind: "sucesso" | "erro",
  message: string,
): never {
  const params = new URLSearchParams({ aba: tab, [kind]: message });
  redirect(`/admin/lideranca?${params.toString()}`);
}

async function validateApprovedMember(
  memberId: string,
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
) {
  if (!UUID_PATTERN.test(memberId)) {
    return false;
  }

  const { data: member } = await supabase
    .from("member_profiles")
    .select("user_id")
    .eq("user_id", memberId)
    .eq("approval_status", "approved")
    .maybeSingle();

  return Boolean(member);
}

function revalidateLeadership() {
  revalidatePath("/admin/lideranca");
  revalidatePath("/familia");
  revalidatePath("/familia/lideranca");
}

export async function addDiscipler(formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "");
  const { supabase, user } = await getCurrentAdmin();

  if (!user || !(await validateApprovedMember(memberId, supabase))) {
    redirectWithMessage(
      "discipuladores",
      "erro",
      "Não foi possível liberar essa função.",
    );
  }

  const { error } = await supabase.from("discipler_roles").insert({
    member_id: memberId,
    assigned_by: user.id,
  });

  if (error && error.code !== "23505") {
    redirectWithMessage(
      "discipuladores",
      "erro",
      "Não foi possível salvar agora.",
    );
  }

  revalidateLeadership();
  redirectWithMessage(
    "discipuladores",
    "sucesso",
    "Discipulador salvo e acesso liberado.",
  );
}

export async function removeDiscipler(formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "");
  const { supabase, user } = await getCurrentAdmin();

  if (!user || !UUID_PATTERN.test(memberId)) {
    redirectWithMessage("discipuladores", "erro", "Ação não autorizada.");
  }

  const { error } = await supabase
    .from("discipler_roles")
    .delete()
    .eq("member_id", memberId);

  if (error) {
    redirectWithMessage(
      "discipuladores",
      "erro",
      "Não foi possível remover essa função.",
    );
  }

  revalidateLeadership();
  redirectWithMessage("discipuladores", "sucesso", "Função removida.");
}

export async function addMinistryAssignment(formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "");
  const ministryKey = String(formData.get("ministryKey") ?? "");
  const role = String(formData.get("role") ?? "");
  const ministry = findMinistry(ministryKey);
  const { supabase, user } = await getCurrentAdmin();

  if (
    !user ||
    !ministry ||
    !["leader", "member"].includes(role) ||
    !(await validateApprovedMember(memberId, supabase))
  ) {
    redirectWithMessage(
      "ministerios",
      "erro",
      "Confira a pessoa, o ministério e a função escolhidos.",
    );
  }

  const table = role === "leader" ? "ministry_leaders" : "ministry_members";
  const { error } = await supabase.from(table).insert({
    ministry_key: ministryKey,
    member_id: memberId,
    assigned_by: user.id,
  });

  if (error && error.code !== "23505") {
    redirectWithMessage(
      "ministerios",
      "erro",
      "Não foi possível salvar essa função.",
    );
  }

  revalidateLeadership();
  redirectWithMessage(
    "ministerios",
    "sucesso",
    role === "leader"
      ? `Liderança de ${ministry.label} salva e acesso liberado.`
      : `Participação em ${ministry.label} salva.`,
  );
}

export async function removeMinistryAssignment(formData: FormData) {
  const memberId = String(formData.get("memberId") ?? "");
  const ministryKey = String(formData.get("ministryKey") ?? "");
  const role = String(formData.get("role") ?? "");
  const { supabase, user } = await getCurrentAdmin();

  if (
    !user ||
    !UUID_PATTERN.test(memberId) ||
    !findMinistry(ministryKey) ||
    !["leader", "member"].includes(role)
  ) {
    redirectWithMessage("ministerios", "erro", "Ação não autorizada.");
  }

  const table = role === "leader" ? "ministry_leaders" : "ministry_members";
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("ministry_key", ministryKey)
    .eq("member_id", memberId);

  if (error) {
    redirectWithMessage(
      "ministerios",
      "erro",
      "Não foi possível remover essa função.",
    );
  }

  revalidateLeadership();
  redirectWithMessage("ministerios", "sucesso", "Função removida.");
}

export async function replaceMinistryAssignments(formData: FormData) {
  const ministryKey = String(formData.get("ministryKey") ?? "");
  const role = String(formData.get("role") ?? "");
  const memberIds = Array.from(
    new Set(formData.getAll("memberIds").map(String)),
  );
  const ministry = findMinistry(ministryKey);
  const { supabase, user } = await getCurrentAdmin();

  if (
    !user ||
    !ministry ||
    !["leader", "member"].includes(role) ||
    memberIds.some((memberId) => !UUID_PATTERN.test(memberId))
  ) {
    redirectWithMessage(
      "ministerios",
      "erro",
      "Não foi possível validar as pessoas selecionadas.",
    );
  }

  const { error } = await supabase.rpc("replace_ministry_assignments", {
    p_ministry_key: ministryKey,
    p_role: role,
    p_member_ids: memberIds,
  });

  if (error) {
    redirectWithMessage(
      "ministerios",
      "erro",
      "Não foi possível salvar a seleção. Nenhum vínculo foi alterado.",
    );
  }

  revalidateLeadership();
  redirectWithMessage(
    "ministerios",
    "sucesso",
    role === "leader"
      ? `Líderes de ${ministry.label} salvos de uma vez.`
      : `Participantes de ${ministry.label} salvos de uma vez.`,
  );
}
