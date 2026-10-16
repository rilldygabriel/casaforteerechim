import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { MEDIA_BUCKET, UUID, type MediaPost } from "@/lib/media-library";

export class MediaError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function requireMediaAccess() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new MediaError("Entre na sua conta para acessar a biblioteca.", 401);
  const { data, error } = await supabase.rpc("can_access_media_library");
  if (error) throw new MediaError("Não foi possível verificar seu acesso. Tente novamente.", 503);
  if (!data) throw new MediaError("Esta área é exclusiva para administradores e membros classificados como Mídia.", 403);
  return { user, supabase };
}
export function checkMediaOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) throw new MediaError("Origem não autorizada.", 403);
}
export async function readMediaJson(request: Request) {
  if (Number(request.headers.get("content-length")) > 150000) throw new MediaError("Formulário muito grande.", 413);
  const body = await request.text();
  if (body.length > 150000) throw new MediaError("Formulário muito grande.", 413);
  try { return JSON.parse(body); } catch { throw new MediaError("Formulário inválido."); }
}
export function mediaError(error: unknown) {
  if (error instanceof MediaError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  console.error("media_library_failure", error instanceof Error ? error.message : "unknown");
  return Response.json({ error: "Não foi possível concluir agora. Tente novamente; os materiais já salvos continuam disponíveis." }, { status: 500, headers: { "Cache-Control": "no-store" } });
}
export async function getMediaPost(id: string) {
  const { supabase, user } = await requireMediaAccess();
  if (!UUID.test(id)) throw new MediaError("Material inválido.", 404);
  const { data, error } = await supabase.from("media_ready_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new MediaError("Material não encontrado.", 404);
  return { post: data as MediaPost, user };
}
export async function signMediaAsset(post: MediaPost, index: number, download?: string) {
  const asset = post.assets[index];
  if (!asset || post.state !== "ready") throw new MediaError("Arquivo não encontrado.", 404);
  const { data, error } = await getSupabaseServiceClient().storage.from(MEDIA_BUCKET).createSignedUrl(asset.path, 600, download ? { download } : undefined);
  if (error || !data) throw new MediaError("Não foi possível preparar o arquivo. Tente novamente.", 503);
  return data.signedUrl;
}
