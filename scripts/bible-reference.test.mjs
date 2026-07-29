import assert from "node:assert/strict";
import test from "node:test";
import { transformBibleHtml } from "@youversion/platform-core/server";
import {
  buildYouVersionPassageUrl,
  formatVerseNumbers,
  resolveBibleReference,
  resolveUsfmReference,
} from "../src/lib/bible/reference.ts";
import {
  DESIRED_BIBLE_VERSIONS,
  isExpectedBibleVersion,
} from "../src/lib/bible/config.ts";

const books = [
  {
    id: "PSA",
    title: "Salmos",
    fullTitle: "Livro dos Salmos",
    abbreviation: "Sl",
    canon: "old_testament",
    chapters: [
      {
        id: "23",
        title: "23",
        passageId: "PSA.23",
        verseNumbers: [1, 2, 3, 4, 5, 6],
      },
    ],
  },
  {
    id: "JHN",
    title: "João",
    fullTitle: "Evangelho de João",
    abbreviation: "Jo",
    canon: "new_testament",
    chapters: [
      {
        id: "3",
        title: "3",
        passageId: "JHN.3",
        verseNumbers: Array.from({ length: 36 }, (_, index) => index + 1),
      },
    ],
  },
];

test("resolve referências em português com versículo e capítulo", () => {
  assert.deepEqual(resolveBibleReference("João 3:16", books), {
    ok: true,
    value: {
      bookId: "JHN",
      chapterId: "3",
      verseStart: 16,
      verseEnd: 16,
    },
  });

  assert.deepEqual(resolveBibleReference("Salmos 23", books), {
    ok: true,
    value: {
      bookId: "PSA",
      chapterId: "23",
      verseStart: undefined,
      verseEnd: undefined,
    },
  });
});

test("valida referência USFM usada pelo Versículo do Dia", () => {
  assert.deepEqual(resolveUsfmReference("JHN.3.16", books), {
    ok: true,
    value: {
      bookId: "JHN",
      chapterId: "3",
      verseStart: 16,
      verseEnd: 16,
    },
  });
});

test("rejeita versículos inexistentes", () => {
  const result = resolveBibleReference("Salmos 23:99", books);
  assert.equal(result.ok, false);
});

test("formata seleção contígua e descontínua", () => {
  assert.equal(formatVerseNumbers([1, 2, 3, 5, 7, 8]), "1–3, 5, 7–8");
});

test("gera link oficial da passagem no YouVersion", () => {
  assert.equal(
    buildYouVersionPassageUrl(1608, "JHN.3.16", "ARA"),
    "https://www.bible.com/bible/1608/JHN.3.16.ARA",
  );
});

test("confirma os IDs somente quando os metadados correspondem", () => {
  const desired = DESIRED_BIBLE_VERSIONS.find(
    (version) => version.id === 4360,
  );
  assert.ok(desired);
  assert.equal(
    isExpectedBibleVersion(
      {
        id: 4360,
        abbreviation: "NVI",
        localized_abbreviation: "NVI",
        title: "Nova Versão Internacional 2011",
        localized_title: "Nova Versão Internacional 2011",
      },
      desired,
    ),
    true,
  );
  assert.equal(
    isExpectedBibleVersion(
      {
        id: 4360,
        abbreviation: "OUTRA",
        localized_abbreviation: "OUTRA",
        title: "Outra tradução",
        localized_title: "Outra tradução",
      },
      desired,
    ),
    false,
  );
});

test("o sanitizador oficial remove conteúdo inseguro e estrutura os versículos", () => {
  const transformed = transformBibleHtml(
    '<div class="p" onclick="alert(1)"><span class="yv-v" v="1"></span><span class="yv-vlbl">1</span>Texto de teste<script>alert(1)</script></div>',
  );

  assert.doesNotMatch(transformed.html, /script|onclick|alert/i);
  assert.match(transformed.html, /class="yv-v"/);
  assert.match(transformed.html, /v="1"/);
  assert.match(transformed.html, /Texto de teste/);
});

