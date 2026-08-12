import { getFinanceUser } from "@/lib/admin-auth";
import { createPluggyConnectToken, isOpenFinanceConfigured } from "@/lib/open-finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getFinanceUser();
  if (!user) return Response.json({ ok: false, message: "Acesso restrito à administração." }, { status: 403 });
  if (!isOpenFinanceConfigured()) return Response.json({ ok: false, message: "As credenciais do Open Finance ainda precisam ser ativadas." }, { status: 503 });
  try {
    return Response.json({ ok: true, accessToken: await createPluggyConnectToken(user.id) });
  } catch (error) {
    console.error("open_finance_token_error", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false, message: "Não foi possível abrir a conexão bancária agora." }, { status: 502 });
  }
}
