import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { MEDIA_BUCKET } from "@/lib/media-library";
import { checkMediaOrigin, getMediaPost, MediaError, mediaError, readMediaJson } from "@/lib/media-library-server";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkMediaOrigin(request);
    const { post, user } = await getMediaPost((await params).id);
    const input = await readMediaJson(request);
    const service = getSupabaseServiceClient();
    if (input.action === "complete") {
      if (post.created_by !== user.id) throw new MediaError("Somente quem iniciou o envio pode concluí-lo.", 403);
      if (post.state === "ready") return Response.json({ ok: true });
      for (const asset of post.assets) {
        const { data, error } = await service.storage.from(MEDIA_BUCKET).info(asset.path);
        if (error || !data || Number(data.size) !== asset.size || data.contentType !== asset.mime) throw new MediaError(`O arquivo ${asset.name} ainda não foi enviado por completo. Tente novamente.`, 409);
      }
      const { error } = await service.from("media_ready_posts").update({ state: "ready", updated_at: new Date().toISOString() }).eq("id", post.id).eq("state", "uploading").eq("created_by", user.id);
      if (error) throw error;
    } else if (input.action === "status" && typeof input.posted === "boolean" && post.state === "ready") {
      const { error } = await service.from("media_ready_posts").update({ posted: input.posted, posted_at: input.posted ? new Date().toISOString() : null, posted_by: input.posted ? user.id : null, updated_at: new Date().toISOString() }).eq("id", post.id).eq("state", "ready");
      if (error) throw error;
    } else throw new MediaError("Ação inválida.");
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mediaError(error); }
}
