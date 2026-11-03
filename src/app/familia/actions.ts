"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export type MemberProfileActionState = {
  kind: "idle" | "success" | "error";
  message: string;
  earnedStar: boolean | null;
};


function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function parseChoice(value: FormDataEntryValue | null) {
  if (value === "sim") {
    return true;
  }

  if (value === "nao") {
    return false;
  }

  return null;
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

export async function updateMemberProfile(
  _previousState: MemberProfileActionState,
  formData: FormData,
): Promise<MemberProfileActionState> {
  const fullName = normalizeText(formData.get("fullName"));
  const phone = normalizeText(formData.get("phone"));
  const phoneDigits = phone.replace(/\D/g, "");
  const birthDate = normalizeText(formData.get("birthDate"));
  const gender = normalizeText(formData.get("gender")).toLowerCase();
  const address = normalizeText(formData.get("address"));
  const churchSinceMonth = normalizeText(formData.get("churchSinceMonth"));
  const jesusYearValue = normalizeText(formData.get("jesusYear"));
  const jesusYear = Number(jesusYearValue);
  const attendedOtherChurch = parseChoice(
    formData.get("attendedOtherChurch"),
  );
  const previousChurchName = normalizeText(
    formData.get("previousChurchName"),
  );
  const baptized = parseChoice(formData.get("baptized"));
  const married = parseChoice(formData.get("married"));
  const spouseName = normalizeText(formData.get("spouseName"));
  const hasDiscipler = parseChoice(formData.get("hasDiscipler"));
  const servesMinistry = parseChoice(formData.get("servesMinistry"));
  const disciplerId = normalizeText(formData.get("disciplerId"));
  const ministryKeys = [...new Set(formData.getAll("ministryKeys").map((value) => normalizeText(value)).filter(Boolean))];

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const currentYear = Number(today.slice(0, 4));

  if (fullName.length < 3 || fullName.length > 160) {
    return {
      kind: "error",
      message: "Digite seu nome completo.",
      earnedStar: null,
    };
  }

  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    return {
      kind: "error",
      message: "Digite um WhatsApp válido, com DDD.",
      earnedStar: null,
    };
  }

  if (
    birthDate && (!isValidIsoDate(birthDate) ||
    birthDate < "1900-01-01" ||
    birthDate > today)
  ) {
    return {
      kind: "error",
      message: "Informe uma data de nascimento válida.",
      earnedStar: null,
    };
  }

  if (gender && gender !== "masculino" && gender !== "feminino") {
    return {
      kind: "error",
      message: "Escolha masculino ou feminino.",
      earnedStar: null,
    };
  }

  if (address && (address.length < 8 || address.length > 500)) {
    return {
      kind: "error",
      message: "Digite seu endereço completo.",
      earnedStar: null,
    };
  }

  if (
    churchSinceMonth && (!/^\d{4}-\d{2}$/.test(churchSinceMonth) ||
    churchSinceMonth < "1900-01" ||
    churchSinceMonth > currentMonth)
  ) {
    return {
      kind: "error",
      message: "Informe o mês e o ano em que começou a frequentar a Casa.",
      earnedStar: null,
    };
  }

  if (
    jesusYearValue && (!Number.isInteger(jesusYear) ||
    jesusYear < 1900 ||
    jesusYear > currentYear)
  ) {
    return {
      kind: "error",
      message: "Informe um ano válido para quando aceitou Jesus.",
      earnedStar: null,
    };
  }

  if (
    attendedOtherChurch &&
    (previousChurchName.length < 2 || previousChurchName.length > 160)
  ) {
    return {
      kind: "error",
      message: "Informe o nome da igreja que frequentou.",
      earnedStar: null,
    };
  }

  if (married && (spouseName.length < 3 || spouseName.length > 160)) {
    return {
      kind: "error",
      message: "Informe o nome do seu cônjuge.",
      earnedStar: null,
    };
  }

  for (const key of ["attendedOtherChurch", "baptized", "married", "hasDiscipler", "servesMinistry"]) {
    if (formData.has(key) && parseChoice(formData.get(key)) === null) {
      return { kind: "error", message: "Revise a opção selecionada.", earnedStar: null };
    }
  }
  if (hasDiscipler && !/^[0-9a-f-]{36}$/i.test(disciplerId)) {
    return { kind: "error", message: "Escolha quem é seu discipulador.", earnedStar: null };
  }
  if (servesMinistry && ministryKeys.length === 0) {
    return { kind: "error", message: "Escolha pelo menos um ministério em que você serve.", earnedStar: null };
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      kind: "error",
      message: "Sua sessão expirou. Entre novamente na Área da Família.",
      earnedStar: null,
    };
  }

  const { data: accessProfile } = await supabase
    .from("member_profiles")
    .select("is_admin,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !accessProfile ||
    (!accessProfile.is_admin && accessProfile.approval_status !== "approved")
  ) {
    return {
      kind: "error",
      message: "Seu acesso não está liberado para atualizar este perfil.",
      earnedStar: null,
    };
  }


  const admin = getSupabaseServiceClient();
  const [{ data: validMinistries }, { data: validDiscipler }] = await Promise.all([
    ministryKeys.length
      ? admin.from("ministries").select("key").in("key", ministryKeys).eq("active", true)
      : Promise.resolve({ data: [] as { key: string }[] }),
    hasDiscipler
      ? admin.from("discipler_roles").select("member_id").eq("member_id", disciplerId).maybeSingle()
      : Promise.resolve({ data: null as { member_id: string } | null }),
  ]);
  if (servesMinistry && (validMinistries?.length ?? 0) !== ministryKeys.length) {
    return { kind: "error", message: "Um dos ministérios escolhidos não está disponível.", earnedStar: null };
  }
  if (hasDiscipler && (!validDiscipler || disciplerId === user.id)) {
    return { kind: "error", message: "O discipulador escolhido não está disponível.", earnedStar: null };
  }

  // Only touch requests for a choice that was actually edited. Keep the review
  // status of retained ministries, including approvals made by leadership.
  const requestError = { kind: "error" as const, message: "Não foi possível salvar suas escolhas. Tente novamente.", earnedStar: null };
  if (servesMinistry !== null) {
    const existing = await admin.from("ministry_membership_requests").select("ministry_key").eq("member_id", user.id);
    if (existing.error) return requestError;
    const selectedKeys = servesMinistry ? ministryKeys : [];
    const removed = (existing.data ?? []).map(row => row.ministry_key).filter(key => !selectedKeys.includes(key));
    if (selectedKeys.length) {
      const added = await admin.from("ministry_membership_requests").upsert(
        selectedKeys.map(ministry_key => ({ member_id: user.id, ministry_key })),
        { onConflict: "member_id,ministry_key", ignoreDuplicates: true },
      );
      if (added.error) return requestError;
    }
    if (removed.length) {
      const deleted = await admin.from("ministry_membership_requests").delete().eq("member_id", user.id).in("ministry_key", removed);
      if (deleted.error) return requestError;
    }
  }
  if (hasDiscipler !== null) {
    const request = hasDiscipler
      ? await admin.from("discipleship_requests").upsert({ member_id: user.id, discipler_id: disciplerId, status: "pending", reviewed_by: null, reviewed_at: null }, { onConflict: "member_id" })
      : await admin.from("discipleship_requests").delete().eq("member_id", user.id);
    if (request.error) return requestError;
  }

  const { data: savedProfile, error } = await supabase
    .from("member_profiles")
    .update({
      full_name: fullName,
      phone,
      ...(formData.has("birthDate") && { birth_date: birthDate || null }),
      ...(gender && { gender }),
      ...(formData.has("address") && { address }),
      ...(formData.has("churchSinceMonth") && { church_since_month: churchSinceMonth ? `${churchSinceMonth}-01` : null }),
      ...(formData.has("jesusYear") && { jesus_year: jesusYearValue ? jesusYear : null }),
      ...(attendedOtherChurch !== null && { attended_other_church: attendedOtherChurch, previous_church_name: attendedOtherChurch ? previousChurchName : "" }),
      ...(baptized !== null && { baptized }),
      ...(married !== null && { married, spouse_name: married ? spouseName : "" }),
      ...(hasDiscipler !== null && { has_discipler: hasDiscipler }),
      ...(servesMinistry !== null && { serves_ministry: servesMinistry }),
    })
    .eq("user_id", user.id)
    .select("profile_completed")
    .maybeSingle();

  if (error || !savedProfile) {
    // Diagnostic code only: never log the member's personal form fields.
    console.error("member_profile_save_failed", { code: error?.code ?? "NO_ROW_RETURNED" });
    return {
      kind: "error",
      message: "Não foi possível salvar agora. Seus campos continuam preenchidos; tente novamente.",
      earnedStar: null,
    };
  }

  revalidatePath("/familia");

  return {
    kind: "success",
    message: savedProfile.profile_completed
      ? "Perfil completo! Você conquistou a Estrela da Família."
      : "Perfil salvo. Complete os campos restantes para conquistar sua estrela.",
    earnedStar: savedProfile.profile_completed,
  };
}
