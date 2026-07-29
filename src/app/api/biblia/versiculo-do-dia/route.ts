import {
  getPublicYouVersionError,
  getVerseOfTheDay,
} from "@/lib/youversion/server";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  try {
    const verse = await getVerseOfTheDay();
    return Response.json(verse, {
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

