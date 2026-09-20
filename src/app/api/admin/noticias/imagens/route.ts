import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { NEWS_IMAGE_BUCKET } from "@/lib/news";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_INPUT_SIZE = 10 * 1024 * 1024;
const MAX_OUTPUT_SIZE = 3 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sua sessão expirou." }, { status: 401 });

  const { data: profile } = await supabase
    .from("member_profiles")
    .select("can_manage_news")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.can_manage_news) {
    return NextResponse.json({ error: "Você não pode editar notícias." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type")?.split(";")[0] ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (!ACCEPTED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Envie uma imagem JPG, PNG, WEBP ou HEIC." }, { status: 415 });
  }
  if (contentLength <= 0 || contentLength > MAX_INPUT_SIZE) {
    return NextResponse.json({ error: "A imagem deve ter no máximo 10 MB." }, { status: 413 });
  }

  const input = Buffer.from(await request.arrayBuffer());
  if (!input.length || input.length > MAX_INPUT_SIZE) {
    return NextResponse.json({ error: "A imagem recebida é inválida ou muito grande." }, { status: 413 });
  }

  let output: Buffer;
  try {
    output = await sharp(input, { failOn: "warning" })
      .rotate()
      .resize(1800, 1200, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86, effort: 4 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "Não foi possível preparar essa imagem." }, { status: 422 });
  }

  if (!output.length || output.length > MAX_OUTPUT_SIZE) {
    return NextResponse.json({ error: "A imagem não pôde ser reduzida ao tamanho permitido." }, { status: 422 });
  }

  const path = `${user.id}/${crypto.randomUUID()}.webp`;
  const service = getSupabaseServiceClient();
  const { error: uploadError } = await service.storage
    .from(NEWS_IMAGE_BUCKET)
    .upload(path, output, {
      cacheControl: "31536000",
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadError) {
    console.error("news_image_upload_failed", uploadError.message);
    return NextResponse.json({ error: "Não foi possível armazenar a imagem." }, { status: 502 });
  }

  const { data } = service.storage.from(NEWS_IMAGE_BUCKET).getPublicUrl(path);
  return NextResponse.json({ path, url: data.publicUrl });
}
