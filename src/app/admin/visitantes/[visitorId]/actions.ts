"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type VisitorStepActionState = {
  kind: "idle" | "success" | "error";
  message: string;
};

async function getAuthorizedVisitorUser() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: member }, { data: leader }] =
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

  const allowed = Boolean(
    profile?.is_admin ||
      (profile?.approval_status === "approved" && (member || leader)),
  );
  return allowed ? { supabase, user } : null;
}

function ids(formData: FormData) {
  const stepId = Number(formData.get("stepId"));
  const visitorId = Number(formData.get("visitorId"));
  return {
    stepId,
    visitorId,
    valid:
      Number.isSafeInteger(stepId) &&
      stepId > 0 &&
      Number.isSafeInteger(visitorId) &&
      visitorId > 0,
  };
}

async function refreshVisitorStatus(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  visitorId: number,
) {
  const { data: steps } = await supabase
    .from("visitor_followup_steps")
    .select("completed_at")
    .eq("visitor_id", visitorId);
  const total = steps?.length ?? 0;
  const completed = (steps ?? []).filter((step) => step.completed_at).length;
  const status =
    total > 0 && completed === total
      ? "concluido"
      : completed > 0
        ? "em_contato"
        : "novo";
  await supabase
    .from("visitantes")
    .update({ status_acompanhamento: status })
    .eq("id", visitorId);
}

export async function claimVisitorFollowupStep(
  _previous: VisitorStepActionState,
  formData: FormData,
): Promise<VisitorStepActionState> {
  const parsed = ids(formData);
  if (!parsed.valid) return { kind: "error", message: "Etapa inválida." };

  const access = await getAuthorizedVisitorUser();
  if (!access) {
    return { kind: "error", message: "Sua sessão expirou ou o acesso não está liberado." };
  }

  const now = new Date().toISOString();
  const { data, error } = await access.supabase
    .from("visitor_followup_steps")
    .update({ assigned_to: access.user.id, assigned_at: now, updated_at: now })
    .eq("id", parsed.stepId)
    .eq("visitor_id", parsed.visitorId)
    .is("assigned_to", null)
    .is("completed_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { kind: "error", message: "Esta etapa já foi assumida por alguém." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/visitantes");
  revalidatePath(`/admin/visitantes/${parsed.visitorId}`);
  return { kind: "success", message: "Esta etapa ficou sob sua responsabilidade." };
}

export async function completeVisitorFollowupStep(
  _previous: VisitorStepActionState,
  formData: FormData,
): Promise<VisitorStepActionState> {
  const parsed = ids(formData);
  const notes = String(formData.get("notes") ?? "").trim();
  if (!parsed.valid || notes.length > 2000) {
    return { kind: "error", message: "Revise os dados desta etapa." };
  }

  const access = await getAuthorizedVisitorUser();
  if (!access) {
    return { kind: "error", message: "Sua sessão expirou ou o acesso não está liberado." };
  }

  const { data: step } = await access.supabase
    .from("visitor_followup_steps")
    .select("assigned_to")
    .eq("id", parsed.stepId)
    .eq("visitor_id", parsed.visitorId)
    .is("completed_at", null)
    .maybeSingle();
  if (!step) return { kind: "error", message: "Esta etapa já foi concluída." };

  const now = new Date().toISOString();
  const assignment = step.assigned_to
    ? {}
    : { assigned_to: access.user.id, assigned_at: now };
  const { data, error } = await access.supabase
    .from("visitor_followup_steps")
    .update({
      ...assignment,
      completed_by: access.user.id,
      completed_at: now,
      notes: notes || null,
      updated_at: now,
    })
    .eq("id", parsed.stepId)
    .eq("visitor_id", parsed.visitorId)
    .is("completed_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { kind: "error", message: "Não foi possível concluir esta etapa." };
  }

  await refreshVisitorStatus(access.supabase, parsed.visitorId);
  revalidatePath("/admin");
  revalidatePath("/admin/visitantes");
  revalidatePath(`/admin/visitantes/${parsed.visitorId}`);
  return { kind: "success", message: "Contato registrado no acompanhamento." };
}
