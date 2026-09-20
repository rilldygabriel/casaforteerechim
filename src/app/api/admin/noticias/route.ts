import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  createNewsSlug,
  getNewsManager,
  MAX_NEWS_BODY_LENGTH,
  MAX_NEWS_IMAGES,
} from "@/lib/news";
import { sendPushToApprovedMembers } from "@/lib/push-broadcast";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImageInput = { url?: unknown; path?: unknown };

function normalizeImages(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_NEWS_IMAGES) return null;
  const images = value.map((item: ImageInput) => ({
    image_url: typeof item?.url === "string" ? item.url.trim() : "",
    storage_path: typeof item?.path === "string" && item.path.trim() ? item.path.trim() : null,
  }));
  if (images.some((image) => !image.image_url || image.image_url.length > 2000)) return null;
  return images;
}

async function uniqueSlug(title: string) {
  const service = getSupabaseServiceClient();
  const base = createNewsSlug(title);
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const { data } = await service.from("news_posts").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
  }
  return `${base}-${Date.now()}`;
}

export async function POST(request: NextRequest) {
  const manager = await getNewsManager();
  if (!manager) return NextResponse.json({ error: "Acesso não autorizado." }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  const images = normalizeImages(payload?.images);
  const coverIndex = Number(payload?.coverIndex ?? 0);

  if (title.length < 3 || title.length > 140) {
    return NextResponse.json({ error: "O título deve ter entre 3 e 140 caracteres." }, { status: 400 });
  }
  if (body.length < 3 || body.length > MAX_NEWS_BODY_LENGTH) {
    return NextResponse.json({ error: "O texto deve ter até 2.000 caracteres." }, { status: 400 });
  }
  if (!images || !Number.isInteger(coverIndex) || coverIndex < 0 || coverIndex >= images.length) {
    return NextResponse.json({ error: "Escolha de 1 a 5 fotos e defina uma capa." }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  const slug = await uniqueSlug(title);
  const { data: post, error: postError } = await service
    .from("news_posts")
    .insert({ slug, title, body, status: "published", created_by: manager.user.id })
    .select("id,slug")
    .single();
  if (postError || !post) {
    console.error("news_post_create_failed", postError?.code);
    return NextResponse.json({ error: "Não foi possível publicar a notícia." }, { status: 502 });
  }

  const { error: imageError } = await service.from("news_images").insert(
    images.map((image, position) => ({
      news_id: post.id,
      ...image,
      position,
      is_cover: position === coverIndex,
    })),
  );
  if (imageError) {
    await service.from("news_posts").delete().eq("id", post.id);
    console.error("news_images_create_failed", imageError.code);
    return NextResponse.json({ error: "A notícia não pôde ser ligada às fotos." }, { status: 502 });
  }

  const newsUrl = `/noticias/${post.slug}`;
  await service.from("family_announcements").insert({
    title: `Nova notícia: ${title}`.slice(0, 100),
    body: `Uma nova notícia foi publicada na Casa. Leia agora: https://www.casaforteerechim.app.br${newsUrl}`,
    created_by: manager.user.id,
  });
  const push = await sendPushToApprovedMembers({
    title,
    body: body.replace(/\s+/g, " ").slice(0, 180),
    tag: `noticia-${post.id}`,
    url: newsUrl,
  });

  revalidatePath("/");
  revalidatePath("/familia");
  revalidatePath("/noticias");
  revalidatePath(newsUrl);
  revalidatePath("/familia/notificacoes");

  return NextResponse.json({ ok: true, slug: post.slug, pushSent: push.sent });
}
