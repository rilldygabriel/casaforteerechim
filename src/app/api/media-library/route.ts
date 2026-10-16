import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { MEDIA_BUCKET, normalizeUpload, type MediaPost } from "@/lib/media-library";
import { checkMediaOrigin, MediaError, mediaError, readMediaJson, requireMediaAccess } from "@/lib/media-library-server";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { supabase } = await requireMediaAccess();
    // Page through PostgREST rather than silently dropping items after its row limit.
    const posts: MediaPost[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("media_ready_posts").select("*").eq("state", "ready").order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
      if (error) throw error;
      posts.push(...data as MediaPost[]);
      if (data.length < 500) break;
    }
    return Response.json({ posts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return mediaError(error); }
}

export async function POST(request: Request) {
  try {
    checkMediaOrigin(request);
    const { user } = await requireMediaAccess();
    const input = await readMediaJson(request);
    let value;
    try { value = normalizeUpload(input); } catch (error) { throw new MediaError((error as Error).message); }
    const service = getSupabaseServiceClient();
    const assets = value.files.map((file, i) => ({ name: file.name, size: file.size, mime: file.mime, role: file.role, path: `${user.id}/${value.id}/${String(i + 1).padStart(3, "0")}.${file.extension}` }));
    const { error: insertError } = await service.from("media_ready_posts").insert({ id: value.id, title: value.title, caption: value.caption, kind: value.kind, assets, created_by: user.id });
    if (insertError && insertError.code !== "23505") throw insertError;
    const { data: stored, error } = await service.from("media_ready_posts").select("*").eq("id", value.id).eq("created_by", user.id).single();
    if (error || !stored) throw new MediaError("Não foi possível iniciar esse envio.", 409);
    if (JSON.stringify(stored.assets) !== JSON.stringify(assets) && assets.some((a, i) => Object.keys(a).some(key => a[key as keyof typeof a] !== stored.assets[i]?.[key]))) throw new MediaError("Este envio mudou. Feche e abra o formulário para iniciar outro.", 409);
    if (stored.title !== value.title || stored.caption !== value.caption || stored.kind !== value.kind || stored.assets.length !== assets.length) throw new MediaError("Este envio mudou. Reabra o formulário.", 409);
    if (stored.state === "ready") return Response.json({ id: value.id, ready: true });
    const uploads = [];
    for (const asset of assets) {
      const { data: info } = await service.storage.from(MEDIA_BUCKET).info(asset.path);
      if (info && Number(info.size) === asset.size) { uploads.push({ ...asset, complete: true }); continue; }
      const { data, error: tokenError } = await service.storage.from(MEDIA_BUCKET).createSignedUploadUrl(asset.path);
      if (tokenError || !data) throw new MediaError("Não foi possível preparar o envio. Tente novamente.", 503);
      uploads.push({ ...asset, token: data.token, complete: false });
    }
    return Response.json({ id: value.id, uploads }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return mediaError(error); }
}
