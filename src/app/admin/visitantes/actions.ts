"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const VISITOR_STATUSES = [
  "novo",
  "em_contato",
  "acompanhado",
  "concluido",
] as const;

export type VisitorFollowUpStatus = (typeof VISITOR_STATUSES)[number];

export type VisitorFollowUpActionState = {
  kind: "idle" | "success" | "error";
  message: string;
};

async function getAuthorizedVisitorClient() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: ministryMember }, { data: ministryLeader }] =
    await Promise.all([
      supabase
        .from("member_profiles")
        .select("is_admin,approval_status")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("ministry_members")
        .select("member_id")
        .eq("member_id", user.id)
        .eq("ministry_key", "connect_consolidacao")
        .maybeSingle(),
      supabase
        .from("ministry_leaders")
        .select("member_id")
        .eq("member_id", user.id)
        .eq("ministry_key", "connect_consolidacao")
        .maybeSingle(),
    ]);

  const isAuthorized = Boolean(
    profile?.is_admin ||
      (profile?.approval_status === "approved" && (ministryMember || ministryLeader)),
  );

  return isAuthorized ? supabase : null;
}

export async function markVisitorAsOpened(visitorId: number) {
  if (!Number.isSafeInteger(visitorId) || visitorId <= 0) {
    return false;
  }

  const supabase = await getAuthorizedVisitorClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("visitantes")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", visitorId)
    .is("opened_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return false;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/visitantes");

  return Boolean(data);
}

export async function updateVisitorFollowUp(
  _previousState: VisitorFollowUpActionState,
  formData: FormData,
): Promise<VisitorFollowUpActionState> {
  const visitorId = Number(formData.get("visitorId"));
  const status = String(formData.get("status") ?? "");

  if (
    !Number.isSafeInteger(visitorId) ||
    visitorId <= 0 ||
    !VISITOR_STATUSES.includes(status as VisitorFollowUpStatus)
  ) {
    return {
      kind: "error",
      message: "Os dados desta atualização são inválidos.",
    };
  }

  const supabase = await getAuthorizedVisitorClient();

  if (!supabase) {
    return {
      kind: "error",
      message: "Sua sessão expirou ou você não tem permissão para atualizar esta ficha.",
    };
  }

  const { data, error } = await supabase
    .from("visitantes")
    .update({
      status_acompanhamento: status,
    })
    .eq("id", visitorId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      kind: "error",
      message: "Não foi possível salvar. Nenhum dado foi alterado.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/visitantes");

  return {
    kind: "success",
    message: "Acompanhamento atualizado com segurança.",
  };
}
