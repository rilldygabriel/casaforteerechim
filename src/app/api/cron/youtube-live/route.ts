import { refreshLiveStatus } from "@/lib/youtube-live-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    return Response.json(await refreshLiveStatus(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("youtube-live-sync", error instanceof Error ? error.message : "sync failed");
    return Response.json({ error: "Não foi possível verificar o YouTube." }, { status: 502 });
  }
}
