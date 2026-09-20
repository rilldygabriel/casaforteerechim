import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getNewsManager, MAX_NEWS_BODY_LENGTH, MAX_NEWS_IMAGES, NEWS_IMAGE_BUCKET } from "@/lib/news";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImageInput = { url?: unknown; path?: unknown };

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const manager = await getNewsManager();
  if (!manager) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });

  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  const coverIndex = Number(payload?.coverIndex ?? 0);
  const rawImages = Array.isArray(payload?.images) ? (payload.images as ImageInput[]) : [];
  const images = rawImages.map((item) => ({
    image_url: typeof item?.url === "string" ? item.url.trim() : "",
    storage_path: typeof item?.path === "string" && item.path.trim() ? item.path.trim() : null,
  }));

  if (title.length < 3 || title.length > 140 || body.length < 3 || body.length > MAX_NEWS_BODY_LENGTH) {
    return NextResponse.json({ error: "Revise o título e o texto da notícia." }, { status: 400 });
  }
  if (images.length < 1 || images.length > MAX_NEWS_IMAGES || images.some((image) => !image.image_url)) {
    return NextResponse.json({ error: "A notícia precisa ter de 1 a 5 fotos." }, { status: 400 });
  }
  if (!Number.isInteger(coverIndex) || coverIndex < 0 || coverIndex >= images.length) {
    return NextResponse.json({ error: "Escolha a foto de capa." }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const { data: post } = await service.from("news_posts").select("id,slug").eq("id", id).maybeSingle();
  if (!post) return NextResponse.json({ error: "Notícia não encontrada." }, { status: 404 });

  const { data: previousImages } = await service
    .from("news_images")
    .select("storage_path")
    .eq("news_id", id);

  const { error: updateError } = await service
    .from("news_posts")
    .update({ title, body, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: "Não foi possível salvar a notícia." }, { status: 502 });

  await service.from("news_images").delete().eq("news_id", id);
  const { error: imageError } = await service.from("news_images").insert(
    images.map((image, position) => ({
      news_id: id,
      ...image,
      position,
      is_cover: position === coverIndex,
    })),
  );
  if (imageError) {
    console.error("news_images_update_failed", imageError.code);
    return NextResponse.json({ error: "As fotos não puderam ser atualizadas." }, { status: 502 });
  }

  const retained = new Set(images.map((image) => image.storage_path).filter(Boolean));
  const removed = (previousImages ?? [])
    .map((image) => image.storage_path)
    .filter((path): path is string => Boolean(path && !retained.has(path)));
  if (removed.length) await service.storage.from(NEWS_IMAGE_BUCKET).remove(removed);

  revalidatePath("/");
  revalidatePath("/familia");
  revalidatePath("/noticias");
  revalidatePath(`/noticias/${post.slug}`);
  revalidatePath("/admin/noticias");
  return NextResponse.json({ ok: true, slug: post.slug });
}
