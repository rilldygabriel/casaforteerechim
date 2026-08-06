"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function addDiscipleshipSession(formData: FormData) {
  const relationshipId = String(formData.get("relationshipId") ?? "");
  const meetingDate = String(formData.get("meetingDate") ?? "");
  const mainDemands = String(formData.get("mainDemands") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const detailPath = `/familia/lideranca/discipulos/${relationshipId}`;
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/familia/login");

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(meetingDate) && meetingDate <= new Date().toISOString().slice(0, 10);
  if (!UUID_PATTERN.test(relationshipId) || !validDate || (!mainDemands && !notes)) {
    redirect(`${detailPath}?erro=${encodeURIComponent("Informe a data e pelo menos uma demanda ou observação.")}`);
  }

  const { error } = await supabase.from("discipleship_sessions").insert({
    relationship_id: relationshipId,
    meeting_date: meetingDate,
    main_demands: mainDemands || null,
    notes: notes || null,
    created_by: user.id,
  });

  if (error) {
    redirect(`${detailPath}?erro=${encodeURIComponent("Não foi possível salvar esse acompanhamento.")}`);
  }

  revalidatePath(detailPath);
  revalidatePath("/familia/lideranca");
  revalidatePath("/admin/lideranca/discipuladores");
  redirect(`${detailPath}?sucesso=${encodeURIComponent("Acompanhamento registrado com sucesso.")}`);
}

export async function releaseDisciple(formData: FormData) {
  const relationshipId = String(formData.get("relationshipId") ?? "");
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/familia/login");
  if (!UUID_PATTERN.test(relationshipId)) {
    redirect(`/familia/lideranca?erro=${encodeURIComponent("Vínculo inválido.")}`);
  }

  const { data: relationship } = await supabase
    .from("discipleship_relationships")
    .select("id,disciple_id")
    .eq("id", relationshipId)
    .eq("discipler_id", user.id)
    .is("ended_at", null)
    .maybeSingle();

  if (!relationship) {
    redirect(`/familia/lideranca?erro=${encodeURIComponent("Este vínculo já foi encerrado ou não pertence à sua conta.")}`);
  }

  const service = getSupabaseServiceClient();
  const now = new Date().toISOString();
  const { data, error } = await service
    .from("discipleship_relationships")
    .update({ ended_at: now, ended_by: user.id, end_reason: "released_by_discipler" })
    .eq("id", relationshipId)
    .is("ended_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/familia/lideranca?erro=${encodeURIComponent("Não foi possível liberar este discípulo agora.")}`);
  }

  await service
    .from("member_profiles")
    .update({ has_discipler: false })
    .eq("user_id", relationship.disciple_id);

  revalidatePath("/familia");
  revalidatePath("/familia/lideranca");
  revalidatePath("/admin/lideranca/discipuladores");
  redirect(`/familia/lideranca?sucesso=${encodeURIComponent("Discípulo liberado. O histórico foi preservado e ele já pode escolher um novo discipulador.")}`);
}
