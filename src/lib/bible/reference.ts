import type { BibleIndexBook } from "@/lib/bible/types";

export type ResolvedBibleReference = {
  bookId: string;
  chapterId: string;
  verseStart?: number;
  verseEnd?: number;
};

export type ResolveBibleReferenceResult =
  | { ok: true; value: ResolvedBibleReference }
  | { ok: false; message: string };

function normalizeReferencePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.ªº]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findBook(bookQuery: string, books: BibleIndexBook[]) {
  const normalizedQuery = normalizeReferencePart(bookQuery);

  return books.find((book) => {
    const names = [
      book.id,
      book.title,
      book.fullTitle,
      book.abbreviation,
    ].map(normalizeReferencePart);

    return names.includes(normalizedQuery);
  });
}

function validateResolvedReference(
  resolved: ResolvedBibleReference,
  books: BibleIndexBook[],
): ResolveBibleReferenceResult {
  const book = books.find((item) => item.id === resolved.bookId);
  if (!book) {
    return {
      ok: false,
      message: "Não encontramos esse livro nesta tradução.",
    };
  }

  const chapter = book.chapters.find(
    (item) => item.id === resolved.chapterId,
  );
  if (!chapter) {
    return {
      ok: false,
      message: `O capítulo ${resolved.chapterId} não existe em ${book.title}.`,
    };
  }

  if (resolved.verseStart === undefined) {
    return { ok: true, value: resolved };
  }

  const verseEnd = resolved.verseEnd ?? resolved.verseStart;
  if (
    resolved.verseStart < 1 ||
    verseEnd < resolved.verseStart ||
    !chapter.verseNumbers.includes(resolved.verseStart) ||
    !chapter.verseNumbers.includes(verseEnd)
  ) {
    return {
      ok: false,
      message: "Confira o número do versículo e tente novamente.",
    };
  }

  return {
    ok: true,
    value: {
      ...resolved,
      verseEnd,
    },
  };
}

export function resolveBibleReference(
  input: string,
  books: BibleIndexBook[],
): ResolveBibleReferenceResult {
  const normalizedInput = input.replace(/[–—]/g, "-").trim();
  const match = normalizedInput.match(
    /^(.+?)\s+(\d{1,3})(?:\s*:\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?$/,
  );

  if (!match) {
    return {
      ok: false,
      message: "Use uma referência como João 3:16 ou Salmos 23.",
    };
  }

  const [, bookQuery, chapterId, verseStartValue, verseEndValue] = match;
  const book = findBook(bookQuery, books);

  if (!book) {
    return {
      ok: false,
      message: "Não encontramos esse livro. Confira o nome e tente novamente.",
    };
  }

  return validateResolvedReference(
    {
      bookId: book.id,
      chapterId,
      verseStart: verseStartValue
        ? Number.parseInt(verseStartValue, 10)
        : undefined,
      verseEnd: verseEndValue
        ? Number.parseInt(verseEndValue, 10)
        : undefined,
    },
    books,
  );
}

export function resolveUsfmReference(
  input: string,
  books: BibleIndexBook[],
): ResolveBibleReferenceResult {
  const match = input
    .trim()
    .toUpperCase()
    .match(/^([A-Z0-9]{3})\.(\d{1,3})(?:\.(\d{1,3})(?:-(\d{1,3}))?)?$/);

  if (!match) {
    return {
      ok: false,
      message: "A passagem informada não é válida.",
    };
  }

  const [, bookId, chapterId, verseStartValue, verseEndValue] = match;

  return validateResolvedReference(
    {
      bookId,
      chapterId,
      verseStart: verseStartValue
        ? Number.parseInt(verseStartValue, 10)
        : undefined,
      verseEnd: verseEndValue
        ? Number.parseInt(verseEndValue, 10)
        : undefined,
    },
    books,
  );
}

export function formatVerseNumbers(verses: number[]) {
  const sorted = [...new Set(verses)].sort((a, b) => a - b);
  const ranges: string[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const start = sorted[index];
    let end = start;

    while (
      index + 1 < sorted.length &&
      sorted[index + 1] === end + 1
    ) {
      index += 1;
      end = sorted[index];
    }

    ranges.push(start === end ? String(start) : `${start}–${end}`);
  }

  return ranges.join(", ");
}

export function buildYouVersionPassageUrl(
  versionId: number,
  passageId: string,
  abbreviation: string,
  versionFallbackUrl = "https://www.bible.com/pt",
) {
  const safePassage = passageId.toUpperCase().match(
    /^[A-Z0-9]{3}\.\d{1,3}(?:\.\d{1,3}(?:-\d{1,3})?)?$/,
  )?.[0];
  const safeAbbreviation = abbreviation
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");

  if (!Number.isInteger(versionId) || versionId < 1 || !safePassage) {
    return versionFallbackUrl;
  }

  const suffix = safeAbbreviation ? `.${safeAbbreviation}` : "";
  return `https://www.bible.com/bible/${versionId}/${safePassage}${suffix}`;
}

