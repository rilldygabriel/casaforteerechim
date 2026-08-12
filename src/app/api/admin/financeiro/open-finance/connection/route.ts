import { getFinanceUser } from "@/lib/admin-auth";
import { syncPluggyItem } from "@/lib/open-finance";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getFinanceUser();
  if (!user) return Response.json({ ok: false, message: "Acesso restrito à administração." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { itemId?: unknown };
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  try {
    const result = await syncPluggyItem(itemId, user.id);
    return Response.json({ ok: true, message: `${result.institutionName} foi conectada e sincronizada.` });
  } catch (error) {
    console.error("open_finance_connection_error", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, message: "A conta foi autorizada, mas a primeira sincronização ainda não terminou. Use Atualizar agora em instantes." }, { status: 502 });
  }
}
