import "server-only";

import {
  ApiClient,
  BibleClient,
  OrganizationsClient,
  getHttpStatus,
  type BibleIndex,
  type BibleVersion,
} from "@youversion/platform-core";
import { transformBibleHtml } from "@youversion/platform-core/server";
import {
  DESIRED_BIBLE_VERSIONS,
  getDesiredBibleVersion,
  isExpectedBibleVersion,
  type DesiredBibleVersion,
} from "@/lib/bible/config";
import { buildYouVersionPassageUrl } from "@/lib/bible/reference";
import type {
  BibleApiError,
  BibleCatalogResponse,
  BibleIndexSummary,
  BiblePassageResponse,
  BibleVersionOption,
  VerseOfDayResponse,
} from "@/lib/bible/types";

const API_TIMEOUT_MS = 8_000;
const PORTUGUESE_LANGUAGE_RANGE = "pt*";

type PublisherInfo = {
  name: string | null;
  url: string | null;
};

type PublicYouVersionError = {
  status: number;
  body: BibleApiError;
};

function getAppKey() {
  const appKey = process.env.YVP_APP_KEY?.trim();

  if (!appKey) {
    throw new YouVersionConfigurationError();
  }

  return appKey;
}

function createClients() {
  const apiClient = new ApiClient({
    appKey: getAppKey(),
    timeout: API_TIMEOUT_MS,
    additionalHeaders: {
      "Accept-Language": "pt-BR",
    },
  });

  return {
    bible: new BibleClient(apiClient),
    organizations: new OrganizationsClient(apiClient),
  };
}

class YouVersionConfigurationError extends Error {
  constructor() {
    super("YVP_APP_KEY is not configured");
    this.name = "YouVersionConfigurationError";
  }
}

function safeExternalUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function findConfirmedVersion(
  versions: BibleVersion[],
  desired: DesiredBibleVersion,
) {
  const version = versions.find((item) => item.id === desired.id);
  return version && isExpectedBibleVersion(version, desired)
    ? version
    : undefined;
}

async function getPublisherInfo(
  versions: BibleVersion[],
  organizations: OrganizationsClient,
) {
  const organizationIds = [
    ...new Set(
      versions
        .map((version) => version.organization_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const entries = await Promise.all(
    organizationIds.map(async (organizationId) => {
      try {
        const organization =
          await organizations.getOrganization(organizationId);
        return [
          organizationId,
          {
            name: organization.name ?? null,
            url: safeExternalUrl(organization.website_url),
          },
        ] as const;
      } catch {
        return [
          organizationId,
          {
            name: null,
            url: null,
          },
        ] as const;
      }
    }),
  );

  return new Map<string, PublisherInfo>(entries);
}

function toVersionOption(
  desired: DesiredBibleVersion,
  licensedVersion: BibleVersion | undefined,
  catalogVersion: BibleVersion | undefined,
  publishers: Map<string, PublisherInfo>,
): BibleVersionOption {
  const version = licensedVersion ?? catalogVersion;
  const publisher = version?.organization_id
    ? publishers.get(version.organization_id)
    : undefined;

  return {
    key: desired.key,
    id: desired.id,
    label: desired.label,
    abbreviation:
      version?.localized_abbreviation ||
      version?.abbreviation ||
      desired.abbreviation,
    title:
      version?.localized_title ||
      version?.title ||
      desired.expectedTitle,
    availability: licensedVersion
      ? "available"
      : catalogVersion
        ? "license_required"
        : "unavailable",
    copyright: version?.copyright ?? null,
    promotionalContent: version?.promotional_content ?? null,
    info: version?.info ?? null,
    publisherName: publisher?.name ?? null,
    publisherUrl:
      publisher?.url ?? safeExternalUrl(version?.publisher_url),
    youVersionUrl:
      safeExternalUrl(version?.youversion_deep_link) ??
      `https://www.bible.com/versions/${desired.id}`,
  };
}

function summarizeIndex(index: BibleIndex): BibleIndexSummary {
  return {
    textDirection: index.text_direction,
    books: index.books.map((book) => ({
      id: book.id,
      title: book.title,
      fullTitle: book.full_title,
      abbreviation: book.abbreviation,
      canon: book.canon,
      chapters: book.chapters
        .filter((chapter) => /^\d+$/.test(chapter.id))
        .map((chapter) => ({
          id: chapter.id,
          title: chapter.title,
          passageId: chapter.passage_id,
          verseNumbers: chapter.verses
            .map((verse) => Number.parseInt(verse.id, 10))
            .filter(Number.isFinite),
        })),
    })),
  };
}

async function getLicensedDesiredVersions(bible: BibleClient) {
  const response = await bible.getVersions(
    PORTUGUESE_LANGUAGE_RANGE,
    undefined,
    { page_size: 99 },
  );

  return DESIRED_BIBLE_VERSIONS.map((desired) =>
    findConfirmedVersion(response.data, desired),
  ).filter((version): version is BibleVersion => Boolean(version));
}

export async function getBibleCatalog(
  requestedVersionId?: number,
): Promise<BibleCatalogResponse> {
  const { bible, organizations } = createClients();
  const [licensedResponse, catalogResponse] = await Promise.all([
    bible.getVersions(PORTUGUESE_LANGUAGE_RANGE, undefined, {
      page_size: 99,
    }),
    bible.getVersions(PORTUGUESE_LANGUAGE_RANGE, undefined, {
      page_size: 99,
      all_available: true,
    }),
  ]);

  const licensedVersions = DESIRED_BIBLE_VERSIONS.map((desired) =>
    findConfirmedVersion(licensedResponse.data, desired),
  ).filter((version): version is BibleVersion => Boolean(version));
  const catalogVersions = DESIRED_BIBLE_VERSIONS.map((desired) =>
    findConfirmedVersion(catalogResponse.data, desired),
  ).filter((version): version is BibleVersion => Boolean(version));
  const publishers = await getPublisherInfo(
    [...licensedVersions, ...catalogVersions],
    organizations,
  );
  const versions = DESIRED_BIBLE_VERSIONS.map((desired) =>
    toVersionOption(
      desired,
      findConfirmedVersion(licensedVersions, desired),
      findConfirmedVersion(catalogVersions, desired),
      publishers,
    ),
  );
  const availableVersions = versions.filter(
    (version) => version.availability === "available",
  );
  const selectedVersion =
    availableVersions.find((version) => version.id === requestedVersionId) ??
    availableVersions.find(
      (version) => version.id === DESIRED_BIBLE_VERSIONS[0].id,
    ) ??
    availableVersions[0] ??
    null;

  const index = selectedVersion
    ? summarizeIndex(await bible.getIndex(selectedVersion.id))
    : null;

  return {
    configured: true,
    versions,
    selectedVersionId: selectedVersion?.id ?? null,
    index,
  };
}

export async function getBiblePassage(
  versionId: number,
  bookId: string,
  chapterId: string,
): Promise<BiblePassageResponse> {
  const desired = getDesiredBibleVersion(versionId);
  if (!desired) {
    throw new RangeError("Unsupported Bible version");
  }

  const { bible } = createClients();
  const passageId = `${bookId}.${chapterId}`;
  const passage = await bible.getPassage(
    versionId,
    passageId,
    "html",
    true,
    false,
  );
  const transformed = transformBibleHtml(passage.content);

  return {
    id: passage.id,
    html: transformed.html,
    reference: passage.reference,
    versionId,
    abbreviation: desired.abbreviation,
    youVersionUrl: buildYouVersionPassageUrl(
      versionId,
      passageId,
      desired.abbreviation,
      `https://www.bible.com/versions/${versionId}`,
    ),
  };
}

function getDayOfYearInSaoPaulo() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") {
        result[part.type] = part.value;
      }
      return result;
    }, {});
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const current = Date.UTC(year, month - 1, day);
  const start = Date.UTC(year, 0, 1);

  return Math.floor((current - start) / 86_400_000) + 1;
}

export async function getVerseOfTheDay(): Promise<VerseOfDayResponse> {
  const { bible } = createClients();
  const licensedVersions = await getLicensedDesiredVersions(bible);
  const version =
    licensedVersions.find(
      (item) => item.id === DESIRED_BIBLE_VERSIONS[0].id,
    ) ??
    licensedVersions[0] ??
    null;

  if (!version) {
    throw new RangeError("No desired Bible version is licensed");
  }

  const day = getDayOfYearInSaoPaulo();
  const verseOfDay = await bible.getVOTD(day);
  const passage = await bible.getPassage(
    version.id,
    verseOfDay.passage_id,
    "text",
    false,
    false,
  );

  return {
    day,
    passageId: verseOfDay.passage_id,
    text: passage.content.trim(),
    reference: passage.reference,
    versionId: version.id,
    abbreviation:
      version.localized_abbreviation || version.abbreviation,
    youVersionUrl: buildYouVersionPassageUrl(
      version.id,
      verseOfDay.passage_id,
      version.localized_abbreviation || version.abbreviation,
      version.youversion_deep_link,
    ),
  };
}

export function getPublicYouVersionError(
  error: unknown,
): PublicYouVersionError {
  if (error instanceof YouVersionConfigurationError) {
    return {
      status: 503,
      body: {
        code: "not_configured",
        error:
          "A leitura integrada está temporariamente indisponível. Tente novamente mais tarde.",
      },
    };
  }

  if (error instanceof RangeError) {
    return {
      status: 400,
      body: {
        code: "invalid_request",
        error: "Não foi possível abrir essa passagem.",
      },
    };
  }

  const status = getHttpStatus(error);

  if (status === 401) {
    return {
      status: 503,
      body: {
        code: "not_authorized",
        error:
          "A leitura integrada está temporariamente indisponível. Tente novamente mais tarde.",
      },
    };
  }

  if (status === 403) {
    return {
      status: 503,
      body: {
        code: "license_required",
        error:
          "Esta tradução ainda não foi liberada para leitura neste aplicativo.",
      },
    };
  }

  if (status === 404) {
    return {
      status: 404,
      body: {
        code: "not_found",
        error: "Não encontramos essa passagem nesta tradução.",
      },
    };
  }

  if (status === 429) {
    return {
      status: 503,
      body: {
        code: "rate_limited",
        error:
          "A leitura está muito movimentada agora. Aguarde um instante e tente novamente.",
      },
    };
  }

  return {
    status: 503,
    body: {
      code: "temporarily_unavailable",
      error:
        "Não foi possível carregar a Bíblia agora. Tente novamente em alguns instantes.",
    },
  };
}

