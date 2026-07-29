import { getDesiredBibleVersion } from "@/lib/bible/config";
import {
  getBiblePassage,
  getPublicYouVersionError,
} from "@/lib/youversion/server";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const versionValue = searchParams.get("versao") ?? "";
  const bookId = (searchParams.get("livro") ?? "").toUpperCase();
  const chapterId = searchParams.get("capitulo") ?? "";
  const versionId = Number.parseInt(versionValue, 10);

  if (
    String(versionId) !== versionValue ||
    !getDesiredBibleVersion(versionId) ||
    !/^[A-Z0-9]{3}$/.test(bookId) ||
    !/^\d{1,3}$/.test(chapterId) ||
    Number(chapterId) < 1
  ) {
    return Response.json(
      {
        code: "invalid_request",
        error: "Não foi possível abrir essa passagem.",
      },
      {
        status: 400,
        headers: RESPONSE_HEADERS,
      },
    );
  }

  try {
    const passage = await getBiblePassage(versionId, bookId, chapterId);
    return Response.json(passage, {
      headers: RESPONSE_HEADERS,
    });
  } catch (error) {
    const publicError = getPublicYouVersionError(error);
    return Response.json(publicError.body, {
      status: publicError.status,
      headers: RESPONSE_HEADERS,
    });
  }
}

