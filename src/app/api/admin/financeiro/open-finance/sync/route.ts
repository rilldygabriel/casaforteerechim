import { revalidatePath } from "next/cache";
import { getFinanceUser } from "@/lib/admin-auth";
import { syncAllPluggyConnections } from "@/lib/open-finance";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const user = await getFinanceUser();
  if (!user) return Response.json({ ok: false, message: "Acesso restrito à administração." }, { status: 403 });
  try {
    const results = await syncAllPluggyConnections();
    revalidatePath("/admin/financeiro");
    const completed = results.filter((result) => result.ok).length;
    return Response.json({ ok: true, message: results.length ? `${completed} de ${results.length} conexão(ões) atualizada(s).` : "Nenhuma conta bancária foi conectada ainda." });
  } catch (error) {
    console.error("open_finance_manual_sync_error", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, message: "Não foi possível atualizar as contas agora." }, { status: 502 });
  }
}
