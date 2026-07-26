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

export const INITIAL_VISITOR_FOLLOW_UP_ACTION_STATE: VisitorFollowUpActionState =
  {
    kind: "idle",
    message: "",
  };

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

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      kind: "error",
      message: "Sua sessão expirou. Entre novamente no painel.",
    };
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return {
      kind: "error",
      message: "Você não tem permissão para atualizar esta ficha.",
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
