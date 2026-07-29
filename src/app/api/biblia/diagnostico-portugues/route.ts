import { ApiClient, BibleClient, getHttpStatus } from "@youversion/platform-core";

export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const appKey = process.env.YVP_APP_KEY?.trim();

  if (!appKey) {
    return Response.json(
      { configured: false, versions: [] },
      { status: 503, headers: RESPONSE_HEADERS },
    );
  }

  const bible = new BibleClient(
    new ApiClient({
      appKey,
      timeout: 8_000,
      additionalHeaders: { "Accept-Language": "pt-BR" },
    }),
  );

  try {
    const response = await bible.getVersions("pt*", undefined, {
      page_size: 99,
    });
    const versions = await Promise.all(
      response.data.map(async (version) => {
        try {
          const passage = await bible.getPassage(
            version.id,
            "JHN.3.16",
            "text",
            false,
            false,
          );

          return {
            id: version.id,
            abbreviation:
              version.localized_abbreviation || version.abbreviation,
            title: version.localized_title || version.title,
            languageTag: version.language_tag,
            copyright: version.copyright ?? null,
            publisherUrl: version.publisher_url ?? null,
            youVersionUrl: version.youversion_deep_link,
            passageReadable: Boolean(passage.content.trim()),
            passageReference: passage.reference,
          };
        } catch (error) {
          return {
            id: version.id,
            abbreviation:
              version.localized_abbreviation || version.abbreviation,
            title: version.localized_title || version.title,
            languageTag: version.language_tag,
            copyright: version.copyright ?? null,
            publisherUrl: version.publisher_url ?? null,
            youVersionUrl: version.youversion_deep_link,
            passageReadable: false,
            passageStatus: getHttpStatus(error) ?? null,
          };
        }
      }),
    );

    return Response.json(
      {
        configured: true,
        totalLicensedPortuguese: response.total_size,
        versions,
      },
      { headers: RESPONSE_HEADERS },
    );
  } catch (error) {
    return Response.json(
      {
        configured: true,
        errorStatus: getHttpStatus(error) ?? null,
        versions: [],
      },
      { status: 503, headers: RESPONSE_HEADERS },
    );
  }
}
