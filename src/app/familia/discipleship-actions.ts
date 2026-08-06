"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function finish(kind: "sucesso" | "erro", message: string): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`/familia?${params.toString()}#escolher-discipulador`);
}

export async function requestDiscipler(formData: FormData) {
  const disciplerId = String(formData.get("disciplerId") ?? "");
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/familia/login");
  if (!UUID_PATTERN.test(disciplerId) || disciplerId === user.id) {
    finish("erro", "Esse discipulador não está disponível.");
  }

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("approval_status,is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile || (!profile.is_admin && profile.approval_status !== "approved")) {
    finish("erro", "Seu acesso à Área da Família ainda não está liberado.");
  }

  const service = getSupabaseServiceClient();
  const [{ data: activeRelationship }, { data: availableDiscipler }, { data: pendingRequest }] =
    await Promise.all([
      service
        .from("discipleship_relationships")
        .select("id")
        .eq("disciple_id", user.id)
        .is("ended_at", null)
        .maybeSingle(),
      service
        .from("discipler_roles")
        .select("member_id")
        .eq("member_id", disciplerId)
        .eq("available_for_member_choice", true)
        .maybeSingle(),
      service
        .from("discipleship_requests")
        .select("status")
        .eq("member_id", user.id)
        .eq("status", "pending")
        .maybeSingle(),
    ]);

  if (activeRelationship) {
    finish("erro", "Você já possui discipulador. A troca só é liberada depois que o vínculo atual for encerrado pelo seu discipulador.");
  }
  if (pendingRequest) {
    finish("erro", "Sua solicitação já está aguardando a validação dos pastores.");
  }
  if (!availableDiscipler) {
    finish("erro", "Esse discipulador não está mais disponível para novos acompanhamentos.");
  }

  const { error } = await service.from("discipleship_requests").upsert(
    {
      member_id: user.id,
      discipler_id: disciplerId,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "member_id" },
  );

  if (error) {
    finish("erro", "Não foi possível enviar sua escolha agora. Tente novamente.");
  }

  revalidatePath("/familia");
  revalidatePath("/admin/membros");
  finish("sucesso", "Sua escolha foi enviada para validação dos pastores.");
}
