"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const PRAYER_STATUSES = [
  "novo",
  "em_oracao",
  "em_contato",
  "concluido",
] as const;

export type PrayerRequestStatus = (typeof PRAYER_STATUSES)[number];

export type PrayerRequestActionState = {
  kind: "idle" | "success" | "error";
  message: string;
};

export const INITIAL_PRAYER_REQUEST_ACTION_STATE: PrayerRequestActionState = {
  kind: "idle",
  message: "",
};

async function getAuthorizedAdminClient() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  return profile?.is_admin ? supabase : null;
}

export async function markPrayerRequestAsOpened(requestId: number) {
  if (!Number.isSafeInteger(requestId) || requestId <= 0) {
    return false;
  }

  const supabase = await getAuthorizedAdminClient();

  if (!supabase) {
    return false;
  }

  const { data, error } = await supabase
    .from("pedidos_oracao")
    .update({ opened_at: new Date().toISOString() })
    .eq("id", requestId)
    .is("opened_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return false;
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos-oracao");

  return Boolean(data);
}

function cleanOptionalText(value: FormDataEntryValue | null, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return null;
  }

  return text.slice(0, maxLength);
}

export async function updatePrayerRequest(
  _previousState: PrayerRequestActionState,
  formData: FormData,
): Promise<PrayerRequestActionState> {
  const requestId = Number(formData.get("requestId"));
  const status = String(formData.get("status") ?? "");
  const responsavel = cleanOptionalText(formData.get("responsavel"), 120);
  const observacoes = cleanOptionalText(formData.get("observacoes"), 2000);

  if (
    !Number.isSafeInteger(requestId) ||
    requestId <= 0 ||
    !PRAYER_STATUSES.includes(status as PrayerRequestStatus)
  ) {
    return {
      kind: "error",
      message: "Os dados desta atualização são inválidos.",
    };
  }

  const supabase = await getAuthorizedAdminClient();

  if (!supabase) {
    return {
      kind: "error",
      message: "Sua sessão expirou ou você não tem permissão para atualizar este pedido.",
    };
  }

  const { data, error } = await supabase
    .from("pedidos_oracao")
    .update({
      status,
      responsavel,
      observacoes,
    })
    .eq("id", requestId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      kind: "error",
      message: "Não foi possível salvar. Nenhum dado foi alterado.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos-oracao");

  return {
    kind: "success",
    message: "Acompanhamento atualizado com segurança.",
  };
}
