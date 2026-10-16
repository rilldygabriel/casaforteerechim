import { mediaFilename } from "@/lib/media-library";
import { getMediaPost, MediaError, mediaError, signMediaAsset } from "@/lib/media-library-server";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { post } = await getMediaPost((await params).id);
    const url = new URL(request.url);
    const index = Number(url.searchParams.get("index"));
    if (!Number.isInteger(index) || index < 0 || !post.assets[index]) throw new MediaError("Arquivo não encontrado.", 404);
    const signed = await signMediaAsset(post, index, url.searchParams.has("download") ? mediaFilename(post.assets[index], index) : undefined);
    return new Response(null, { status: 307, headers: { Location: signed, "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  } catch (error) { return mediaError(error); }
}
