import { NextRequest } from "next/server";
import { isOpenFinanceConfigured, syncAllPluggyConnections } from "@/lib/open-finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  if (!isOpenFinanceConfigured()) return Response.json({ configured: false, synchronized: 0 });
  const results = await syncAllPluggyConnections();
  return Response.json({ configured: true, synchronized: results.filter((result) => result.ok).length, failed: results.filter((result) => !result.ok).length });
}
