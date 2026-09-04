import { NextRequest } from "next/server";
import { expireStaleMercadoPagoPixPayments, isMercadoPagoConfigured } from "@/lib/mercado-pago";
import { expireStalePagBankPixPayments } from "@/lib/pagbank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const [mercadoPago, pagBank] = await Promise.all([
      isMercadoPagoConfigured() ? expireStaleMercadoPagoPixPayments() : Promise.resolve(null),
      process.env.PAGBANK_TOKEN?.trim() ? expireStalePagBankPixPayments() : Promise.resolve(null),
    ]);
    return Response.json({ configured: Boolean(mercadoPago || pagBank), mercadoPago, pagBank });
  } catch (error) {
    console.error("mercado_pago_expire_pending_pix_error", error);
    return Response.json({ error: "Não foi possível revisar os Pix pendentes." }, { status: 500 });
  }
}
