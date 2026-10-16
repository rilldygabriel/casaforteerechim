import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { MEDIA_BUCKET, mediaFilename } from "@/lib/media-library";
import { getMediaPost, MediaError, mediaError, signMediaAsset } from "@/lib/media-library-server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const maxDuration = 800;
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { post } = await getMediaPost((await params).id);
    if (post.state !== "ready") throw new MediaError("O material ainda está sendo enviado.", 409);
    if (new URL(request.url).searchParams.has("prepare")) {
      for (const asset of post.assets) {
        const { data, error } = await getSupabaseServiceClient().storage.from(MEDIA_BUCKET).info(asset.path);
        if (error || !data || Number(data.size) !== asset.size) throw new MediaError(`Não foi possível acessar ${asset.name}. Tente novamente.`, 503);
      }
      return Response.json({ files: post.assets.length, bytes: post.assets.reduce((sum, a) => sum + a.size, 0) }, { headers: { "Cache-Control": "no-store" } });
    }
    const archive = new ZipArchive({ store: true, forceZip64: true });
    const abort = new AbortController();
    archive.on("error", () => { console.error("media_zip_failed", post.id); abort.abort(); });
    archive.on("close", () => abort.abort());
    request.signal.addEventListener("abort", () => { abort.abort(); archive.destroy(); }, { once: true });
    for (let i = 0; i < post.assets.length; i++) {
      const asset = post.assets[i];
      // Read lazily and sequentially: never hold a multi-GB Reel/ZIP in memory.
      const source = Readable.from((async function* () {
        const url = await signMediaAsset(post, i);
        const response = await fetch(url, { signal: abort.signal, cache: "no-store" });
        if (!response.ok || !response.body) throw new Error("Arquivo indisponível no pacote.");
        let bytes = 0;
        for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) { bytes += chunk.length; yield chunk; }
        if (bytes !== asset.size) throw new Error("Download incompleto.");
      })());
      source.on("error", error => archive.destroy(error));
      archive.append(source, { name: mediaFilename(asset, i, post.assets.length) });
    }
    archive.append(Buffer.from(post.caption, "utf8"), { name: "legenda.txt" });
    void archive.finalize().catch(error => archive.destroy(error));
    const filename = post.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9-]+/g, "-").slice(0, 100) || "material-casa-forte";
    return new Response(Readable.toWeb(archive) as ReadableStream<Uint8Array>, { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}.zip"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return mediaError(error); }
}
