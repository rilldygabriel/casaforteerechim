import { readLiveStatus } from "@/lib/youtube-live-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await readLiveStatus(), {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=15, must-revalidate" },
    });
  } catch {
    return Response.json({ status: "unknown", video: null }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
