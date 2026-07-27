import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseRouteClient } from "@/lib/supabase/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROFILE_PHOTOS_BUCKET = "member-profile-photos";
const INPUT_CONTENT_TYPE = "image/jpeg";
const MAX_INPUT_SIZE = 1024 * 1024;
const MAX_OUTPUT_SIZE = 1024 * 1024;
const OUTPUT_SIZE = 512;

function errorResponse(
  applyAuthState: (response: NextResponse) => NextResponse,
  message: string,
  status: number,
) {
  return applyAuthState(NextResponse.json({ error: message }, { status }));
}

export async function POST(request: NextRequest) {
  const { supabase, applyAuthState } = getSupabaseRouteClient(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return errorResponse(
      applyAuthState,
      "Sua sessão expirou. Entre novamente para enviar a foto.",
      401,
    );
  }

  const contentType = request.headers.get("content-type")?.split(";")[0];
  const contentLength = Number(request.headers.get("content-length") || "0");

  if (contentType !== INPUT_CONTENT_TYPE) {
    return errorResponse(
      applyAuthState,
      "O formato preparado para envio não é válido.",
      415,
    );
  }

  if (contentLength > MAX_INPUT_SIZE) {
    return errorResponse(
      applyAuthState,
      "A foto preparada ultrapassou o tamanho permitido.",
      413,
    );
  }

  let input: Buffer;

  try {
    input = Buffer.from(await request.arrayBuffer());
  } catch (error) {
    console.error("[family-photo] request body read failed", error);
    return errorResponse(
      applyAuthState,
      "Não foi possível receber a foto.",
      400,
    );
  }

  if (input.length === 0 || input.length > MAX_INPUT_SIZE) {
    return errorResponse(
      applyAuthState,
      "A foto preparada está vazia ou ultrapassou o tamanho permitido.",
      413,
    );
  }

  let webp: Buffer;

  try {
    webp = await sharp(input, { failOn: "warning" })
      .rotate()
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 84, effort: 4 })
      .toBuffer();
  } catch (error) {
    console.error("[family-photo] image conversion failed", error);
    return errorResponse(
      applyAuthState,
      "Não foi possível preparar essa imagem. Escolha outra foto.",
      422,
    );
  }

  if (webp.length === 0 || webp.length > MAX_OUTPUT_SIZE) {
    console.error("[family-photo] converted image outside size limit", {
      size: webp.length,
    });
    return errorResponse(
      applyAuthState,
      "Não foi possível reduzir a foto para o tamanho permitido.",
      422,
    );
  }

  const photoPath = `${user.id}/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_PHOTOS_BUCKET)
    .upload(photoPath, webp, {
      cacheControl: "3600",
      contentType: "image/webp",
      upsert: false,
    });

  if (uploadError) {
    console.error("[family-photo] storage upload failed", {
      name: uploadError.name,
      message: uploadError.message,
      statusCode: "statusCode" in uploadError ? uploadError.statusCode : null,
      error: "error" in uploadError ? uploadError.error : null,
    });
    return errorResponse(
      applyAuthState,
      "Não foi possível armazenar a foto.",
      502,
    );
  }

  const { data: updatedProfile, error: profileError } = await supabase
    .from("member_profiles")
    .update({ photo_url: photoPath })
    .eq("user_id", user.id)
    .select("photo_url")
    .maybeSingle();

  if (profileError || updatedProfile?.photo_url !== photoPath) {
    console.error("[family-photo] profile update failed", {
      code: profileError?.code,
      message: profileError?.message,
    });
    return errorResponse(
      applyAuthState,
      "A foto foi armazenada, mas não pôde ser ligada ao perfil.",
      502,
    );
  }

  console.info("[family-photo] upload completed", {
    size: webp.length,
  });

  return applyAuthState(NextResponse.json({ ok: true }));
}
