export type BibleVersionAvailability =
  | "available"
  | "license_required"
  | "unavailable";

export type BibleVersionOption = {
  key: string;
  id: number;
  label: string;
  abbreviation: string;
  title: string;
  availability: BibleVersionAvailability;
  copyright: string | null;
  promotionalContent: string | null;
  info: string | null;
  publisherName: string | null;
  publisherUrl: string | null;
  youVersionUrl: string;
};

export type BibleIndexChapter = {
  id: string;
  title: string;
  passageId: string;
  verseNumbers: number[];
};

export type BibleIndexBook = {
  id: string;
  title: string;
  fullTitle: string;
  abbreviation: string;
  canon: string;
  chapters: BibleIndexChapter[];
};

export type BibleIndexSummary = {
  textDirection: string;
  books: BibleIndexBook[];
};

export type BibleCatalogResponse = {
  configured: true;
  versions: BibleVersionOption[];
  selectedVersionId: number | null;
  index: BibleIndexSummary | null;
};

export type BiblePassageResponse = {
  id: string;
  html: string;
  reference: string;
  versionId: number;
  abbreviation: string;
  youVersionUrl: string;
};

export type VerseOfDayResponse = {
  day: number;
  passageId: string;
  text: string;
  reference: string;
  versionId: number;
  abbreviation: string;
  youVersionUrl: string;
};

export type BibleApiError = {
  error: string;
  code:
    | "invalid_request"
    | "not_configured"
    | "not_authorized"
    | "license_required"
    | "not_found"
    | "rate_limited"
    | "temporarily_unavailable";
};

