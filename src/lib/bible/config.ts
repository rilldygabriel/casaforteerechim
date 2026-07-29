export const DESIRED_BIBLE_VERSIONS = [
  {
    key: "nvi-2011",
    id: 4360,
    label: "NVI 2011",
    abbreviation: "NVI",
    expectedTitle: "Nova Versão Internacional 2011",
  },
  {
    key: "blt",
    id: 3254,
    label: "BLT — Bíblia completa",
    abbreviation: "BLT",
    expectedTitle: "Biblia Livre Para Todos",
  },
  {
    key: "naa",
    id: 1840,
    label: "NAA",
    abbreviation: "NAA",
    expectedTitle: "Nova Almeida Atualizada",
  },
  {
    key: "ara",
    id: 1608,
    label: "ARA",
    abbreviation: "ARA",
    expectedTitle: "Almeida Revista e Atualizada",
  },
  {
    key: "arc",
    id: 212,
    label: "ARC",
    abbreviation: "ARC",
    expectedTitle: "Almeida Revista e Corrigida",
  },
] as const;

export type DesiredBibleVersion = (typeof DESIRED_BIBLE_VERSIONS)[number];

export function getDesiredBibleVersion(
  versionId: number,
): DesiredBibleVersion | undefined {
  return DESIRED_BIBLE_VERSIONS.find((version) => version.id === versionId);
}

export function normalizeBibleMetadata(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

export function isExpectedBibleVersion(
  version: {
    id: number;
    abbreviation: string;
    localized_abbreviation: string;
    title: string;
    localized_title: string;
  },
  desired: DesiredBibleVersion,
) {
  if (version.id !== desired.id) {
    return false;
  }

  const abbreviation = normalizeBibleMetadata(
    version.localized_abbreviation || version.abbreviation,
  );
  const expectedAbbreviation = normalizeBibleMetadata(desired.abbreviation);
  const title = normalizeBibleMetadata(
    `${version.localized_title} ${version.title}`,
  );
  const expectedTitle = normalizeBibleMetadata(desired.expectedTitle);

  return (
    abbreviation === expectedAbbreviation &&
    (title.includes(expectedTitle) || expectedTitle.includes(title))
  );
}
