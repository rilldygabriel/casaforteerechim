"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EVENT_STATUS_VALUES, REGISTRATION_STATUS_VALUES, normalizePhone, slugifyEvent } from "@/lib/events";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

async function requireAdmin() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("member_profiles").select("is_admin,approval_status").eq("user_id", user.id).maybeSingle();
  if (!profile?.is_admin || profile.approval_status !== "approved") redirect("/admin");
  return getSupabaseServiceClient();
}

function value(formData: FormData, name: string) { return String(formData.get(name) ?? "").trim(); }
function nullable(value: string) { return value || null; }
function moneyCents(input: string) { const normalized = input.replace(/\s/g, "").replace(/R\$/gi, "").replace(/\./g, "").replace(",", "."); const amount = Number(normalized || 0); return Number.isFinite(amount) ? Math.round(amount * 100) : -1; }
function back(message: string, tab = "eventos") { redirect(`/admin/eventos?tab=${tab}&mensagem=${encodeURIComponent(message)}`); }

export async function saveEvent(formData: FormData) {
  const service = await requireAdmin();
  const id = value(formData, "eventId");
  const title = value(formData, "title");
  const slug = slugifyEvent(value(formData, "slug") || title);
  const status = value(formData, "status");
  const startDate = value(formData, "startDate");
  if (title.length < 3 || !slug || !startDate || !EVENT_STATUS_VALUES.includes(status as typeof EVENT_STATUS_VALUES[number])) back("Revise os campos obrigatórios do evento.");
  const capacityText = value(formData, "capacity");
  const capacity = capacityText ? Number(capacityText) : null;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) back("O limite de vagas é inválido.");
  const registrationFeeCents = moneyCents(value(formData, "registrationFee"));
  if (registrationFeeCents < 0 || registrationFeeCents > 100_000_000) back("O valor da inscrição é inválido.");
  const payload = {
    title,
    slug,
    description: value(formData, "description"),
    category: value(formData, "category") || "Eventos especiais",
    start_date: startDate,
    end_date: nullable(value(formData, "endDate")),
    start_time: nullable(value(formData, "startTime")),
    end_time: nullable(value(formData, "endTime")),
    location: value(formData, "location"),
    image_url: nullable(value(formData, "imageUrl")),
    status,
    registration_enabled: formData.get("registrationEnabled") === "on",
    registration_status: formData.get("registrationOpen") === "on" ? "open" : "closed",
    registration_deadline: nullable(value(formData, "registrationDeadline")),
    capacity,
    registration_fee_cents: registrationFeeCents,
    is_public: formData.get("isPublic") === "on",
    is_featured: formData.get("isFeatured") === "on",
    updated_at: new Date().toISOString(),
  };
  const query = id ? service.from("events").update(payload).eq("id", id) : service.from("events").insert(payload);
  const { error } = await query;
  if (error?.code === "23505") back("Já existe um evento com este endereço.");
  if (error) back("Não foi possível salvar o evento.");
  revalidatePath("/calendario"); revalidatePath("/admin/eventos");
  back(id ? "Evento atualizado com sucesso." : "Evento criado com sucesso.");
}

export async function archiveEvent(formData: FormData) {
  const service = await requireAdmin();
  const id = value(formData, "eventId");
  if (!id) back("Evento inválido.");
  const { error } = await service.from("events").update({ archived_at: new Date().toISOString(), registration_status: "closed", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) back("Não foi possível arquivar o evento.");
  revalidatePath("/admin/eventos"); back("Evento arquivado.");
}

export async function saveRegistration(formData: FormData) {
  const service = await requireAdmin();
  const id = value(formData, "registrationId");
  const fullName = value(formData, "fullName");
  const phone = value(formData, "phone");
  const status = value(formData, "status");
  if (!id || fullName.length < 3 || normalizePhone(phone).length < 10 || !REGISTRATION_STATUS_VALUES.includes(status as typeof REGISTRATION_STATUS_VALUES[number])) back("Revise os dados do participante.", "inscricoes");
  const { error } = await service.from("event_registrations").update({ full_name: fullName, phone, phone_normalized: normalizePhone(phone), attendance_duration: value(formData, "attendanceDuration"), notes: value(formData, "notes"), status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error?.code === "23505") back("Este telefone já está inscrito neste evento.", "inscricoes");
  if (error) back("Não foi possível atualizar a inscrição.", "inscricoes");
  revalidatePath("/admin/eventos"); back("Inscrição atualizada com sucesso.", "inscricoes");
}

export async function archiveRegistration(formData: FormData) {
  const service = await requireAdmin();
  const id = value(formData, "registrationId");
  if (!id) back("Inscrição inválida.", "inscricoes");
  const { error } = await service.from("event_registrations").update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) back("Não foi possível arquivar a inscrição.", "inscricoes");
  revalidatePath("/admin/eventos"); back("Inscrição arquivada.", "inscricoes");
}
