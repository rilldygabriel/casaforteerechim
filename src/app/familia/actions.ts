"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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
    !isValidIsoDate(birthDate) ||
    birthDate < "1900-01-01" ||
    birthDate > today
  ) {
    return {
      kind: "error",
      message: "Informe uma data de nascimento válida.",
      earnedStar: null,
    };
  }

  if (address.length < 8 || address.length > 500) {
    return {
      kind: "error",
      message: "Digite seu endereço completo.",
      earnedStar: null,
    };
  }

  if (
    !/^\d{4}-\d{2}$/.test(churchSinceMonth) ||
    churchSinceMonth < "1900-01" ||
    churchSinceMonth > currentMonth
  ) {
    return {
      kind: "error",
      message: "Informe o mês e o ano em que começou a frequentar a Casa.",
      earnedStar: null,
    };
  }

  if (
    !Number.isInteger(jesusYear) ||
    jesusYear < 1900 ||
    jesusYear > currentYear
  ) {
    return {
      kind: "error",
      message: "Informe um ano válido para quando aceitou Jesus.",
      earnedStar: null,
    };
  }

  if (attendedOtherChurch === null) {
    return {
      kind: "error",
      message: "Responda se já frequentou outra igreja evangélica.",
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

  if (baptized === null) {
    return {
      kind: "error",
      message: "Responda se já é batizado nas águas.",
      earnedStar: null,
    };
  }

  if (married === null) {
    return {
      kind: "error",
      message: "Responda se é casado.",
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

  const { data: savedProfile, error } = await supabase
    .from("member_profiles")
    .update({
      full_name: fullName,
      phone,
      birth_date: birthDate,
      address,
      church_since_month: `${churchSinceMonth}-01`,
      jesus_year: jesusYear,
      attended_other_church: attendedOtherChurch,
      previous_church_name: attendedOtherChurch ? previousChurchName : "",
      baptized,
      married,
      spouse_name: married ? spouseName : "",
    })
    .eq("user_id", user.id)
    .select("profile_completed")
    .maybeSingle();

  if (error || !savedProfile) {
    return {
      kind: "error",
      message: "Não foi possível salvar agora. Nenhum dado foi perdido.",
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
