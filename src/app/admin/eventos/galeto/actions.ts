"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { canManageGaleto, validateGaleto, type GaletoInput, type GaletoResult } from "@/lib/galeto";

export async function saveGaleto(input: GaletoInput): Promise<GaletoResult> {
  try {
    const supabase = await getSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !canManageGaleto(user.id)) return { ok: false, message: "Acesso restrito ao Pastor Rilldy e à Lisi. Entre novamente, se necessário." };
    let item: GaletoInput;
    try { item = validateGaleto(input); }
    catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Confira os dados." }; }
    const { error } = await supabase.rpc("save_galeto_allocation", {
      p_id: item.id, p_version: item.version, p_name: item.name,
      p_allocated: item.allocated, p_settled: item.settled, p_picked_up: item.picked_up,
      p_reviewed: item.settlement_reviewed, p_notes: item.notes,
    });
    if (error) {
      if (error.code === "40001") return { ok: false, message: "Este registro mudou em outro acesso. Feche esta edição, atualize a lista e tente novamente." };
      if (error.code === "23505") return { ok: false, message: "Já existe uma pessoa com esse nome. Procure na lista ou diferencie o nome." };
      console.error("galeto_save_failed", { code: error.code });
      return { ok: false, message: "Não foi possível salvar. Confira a conexão e atualize a lista antes de tentar novamente." };
    }
    revalidatePath("/admin/eventos/galeto");
    return { ok: true, message: "Registro salvo." };
  } catch {
    return { ok: false, message: "Falha na conexão. Seus campos continuam preenchidos. Atualize a lista para conferir antes de reenviar." };
  }
}
