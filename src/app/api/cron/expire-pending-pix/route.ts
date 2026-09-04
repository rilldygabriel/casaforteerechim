import { NextRequest } from "next/server";
import { expireStaleMercadoPagoPixPayments, isMercadoPagoConfigured } from "@/lib/mercado-pago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!isMercadoPagoConfigured()) return Response.json({ configured: false });

  try {
    const result = await expireStaleMercadoPagoPixPayments();
    return Response.json({ configured: true, ...result });
  } catch (error) {
    console.error("mercado_pago_expire_pending_pix_error", error);
    return Response.json({ error: "Não foi possível revisar os Pix pendentes." }, { status: 500 });
  }
}
