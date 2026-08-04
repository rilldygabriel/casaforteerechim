"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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
