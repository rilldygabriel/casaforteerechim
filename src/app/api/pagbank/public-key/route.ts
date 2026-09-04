import { getPagBankPublicKey, isPagBankConfigured } from "@/lib/pagbank";

export const runtime = "nodejs";

export async function GET() {
  if (!isPagBankConfigured()) return Response.json({ error: "PagBank não configurado." }, { status: 503 });
  try {
    return Response.json({ publicKey: await getPagBankPublicKey() }, {
      headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("pagbank_public_key_error", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "Não foi possível iniciar o pagamento seguro." }, { status: 502 });
  }
}
