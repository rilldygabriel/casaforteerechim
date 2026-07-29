import { getDesiredBibleVersion } from "@/lib/bible/config";
import {
  getBibleCatalog,
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
  const versionValue = searchParams.get("versao");
  let requestedVersionId: number | undefined;

  if (versionValue) {
    requestedVersionId = Number.parseInt(versionValue, 10);

    if (
      String(requestedVersionId) !== versionValue ||
      !getDesiredBibleVersion(requestedVersionId)
    ) {
      return Response.json(
        {
          code: "invalid_request",
          error: "A tradução informada não é válida.",
        },
        {
          status: 400,
          headers: RESPONSE_HEADERS,
        },
      );
    }
  }

  try {
    const catalog = await getBibleCatalog(requestedVersionId);
    return Response.json(catalog, {
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

