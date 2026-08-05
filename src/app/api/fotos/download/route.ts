import { NextRequest, NextResponse } from "next/server";
import { LATEST_CULT_ALBUM } from "@/lib/cult-album";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const photo = LATEST_CULT_ALBUM.find((item) => item.id === id);
  if (!photo) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });

  const source = await fetch(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(photo.id)}&export=download`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!source.ok || !source.body) return NextResponse.json({ error: "Não foi possível baixar a foto." }, { status: 502 });

  const headers = new Headers({
    "Content-Type": source.headers.get("content-type") || "image/jpeg",
    "Content-Disposition": `attachment; filename="${photo.filename.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
    "Cache-Control": "public, max-age=86400",
  });
  const length = source.headers.get("content-length");
  if (length) headers.set("Content-Length", length);
  return new NextResponse(source.body, { headers });
}
