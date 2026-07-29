"use client";

import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildYouVersionPassageUrl,
  formatVerseNumbers,
  resolveBibleReference,
  resolveUsfmReference,
  type ResolvedBibleReference,
} from "@/lib/bible/reference";
import type {
  BibleApiError,
  BibleCatalogResponse,
  BibleIndexBook,
  BibleIndexSummary,
  BiblePassageResponse,
  BibleVersionOption,
} from "@/lib/bible/types";

type LoadState = "loading" | "ready" | "error";

const GENERIC_YOUVERSION_URL = "https://www.bible.com/pt";

async function readApiError(response: Response) {
  try {
    const error = (await response.json()) as BibleApiError;
    return error.error;
  } catch {
    return "Não foi possível carregar a Bíblia agora.";
  }
}

function getFirstChapter(book: BibleIndexBook | undefined) {
  return book?.chapters[0]?.id ?? "";
}

function getAdjacentLocation(
  books: BibleIndexBook[],
  bookId: string,
  chapterId: string,
  direction: "previous" | "next",
) {
  const bookIndex = books.findIndex((book) => book.id === bookId);
  const book = books[bookIndex];
  const chapterIndex = book?.chapters.findIndex(
    (chapter) => chapter.id === chapterId,
  );

  if (!book || chapterIndex === undefined || chapterIndex < 0) {
    return null;
  }

  if (direction === "previous") {
    const previousChapter = book.chapters[chapterIndex - 1];
    if (previousChapter) {
      return { bookId, chapterId: previousChapter.id };
    }

    const previousBook = books[bookIndex - 1];
    const lastChapter = previousBook?.chapters.at(-1);
    return previousBook && lastChapter
      ? { bookId: previousBook.id, chapterId: lastChapter.id }
      : null;
  }

  const nextChapter = book.chapters[chapterIndex + 1];
  if (nextChapter) {
    return { bookId, chapterId: nextChapter.id };
  }

  const nextBook = books[bookIndex + 1];
  const firstChapter = nextBook?.chapters[0];
  return nextBook && firstChapter
    ? { bookId: nextBook.id, chapterId: firstChapter.id }
    : null;
}

function getVerseText(element: HTMLElement) {
  const clone = element.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(".yv-vlbl, [data-verse-footnote]")
    .forEach((node) => node.remove());

  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("Clipboard unavailable");
  }
}

function getSelectionRange(
  reference: ResolvedBibleReference,
  books: BibleIndexBook[],
) {
  if (reference.verseStart === undefined) {
    return [];
  }

  const chapter = books
    .find((book) => book.id === reference.bookId)
    ?.chapters.find((item) => item.id === reference.chapterId);
  const verseEnd = reference.verseEnd ?? reference.verseStart;

  return (
    chapter?.verseNumbers.filter(
      (verse) => verse >= reference.verseStart! && verse <= verseEnd,
    ) ?? []
  );
}

export default function BibleReader() {
  const [catalogState, setCatalogState] = useState<LoadState>("loading");
  const [catalogError, setCatalogError] = useState("");
  const [versions, setVersions] = useState<BibleVersionOption[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(
    null,
  );
  const [index, setIndex] = useState<BibleIndexSummary | null>(null);
  const [bookId, setBookId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [passage, setPassage] = useState<BiblePassageResponse | null>(null);
  const [passageState, setPassageState] = useState<LoadState>("loading");
  const [passageError, setPassageError] = useState("");
  const [referenceInput, setReferenceInput] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [selectedVerses, setSelectedVerses] = useState<number[]>([]);
  const [fontSize, setFontSize] = useState(20);
  const [announcement, setAnnouncement] = useState("");
  const [pendingScrollVerse, setPendingScrollVerse] = useState<number | null>(
    null,
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const passageRequestRef = useRef(0);
  const didInitializeRef = useRef(false);
  const initialPassageRef = useRef<string | null>(null);

  const loadPassage = useCallback(
    async (versionId: number, nextBookId: string, nextChapterId: string) => {
      const requestId = passageRequestRef.current + 1;
      passageRequestRef.current = requestId;
      setPassageState("loading");
      setPassageError("");
      setPassage(null);
      setSelectedVerses([]);

      try {
        const params = new URLSearchParams({
          versao: String(versionId),
          livro: nextBookId,
          capitulo: nextChapterId,
        });
        const response = await fetch(`/api/biblia/passagem?${params}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const data = (await response.json()) as BiblePassageResponse;
        if (passageRequestRef.current !== requestId) {
          return false;
        }

        setPassage(data);
        setPassageState("ready");
        return true;
      } catch (error) {
        if (passageRequestRef.current !== requestId) {
          return false;
        }

        setPassageError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar este capítulo.",
        );
        setPassageState("error");
        return false;
      }
    },
    [],
  );

  const loadCatalog = useCallback(
    async (
      preferredVersionId?: number,
      requestedLocation?: ResolvedBibleReference,
    ) => {
      setCatalogState("loading");
      setCatalogError("");

      try {
        const params = new URLSearchParams();
        if (preferredVersionId) {
          params.set("versao", String(preferredVersionId));
        }
        const endpoint = params.size
          ? `/api/biblia/catalogo?${params}`
          : "/api/biblia/catalogo";
        const response = await fetch(endpoint, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const data = (await response.json()) as BibleCatalogResponse;
        setVersions(data.versions);
        setSelectedVersionId(data.selectedVersionId);
        setIndex(data.index);
        setCatalogState("ready");

        if (!data.selectedVersionId || !data.index?.books.length) {
          setPassageState("error");
          setPassageError(
            "As traduções desejadas ainda não foram liberadas para leitura neste site.",
          );
          return;
        }

        let location = requestedLocation;
        if (!location && initialPassageRef.current) {
          const resolved = resolveUsfmReference(
            initialPassageRef.current,
            data.index.books,
          );
          initialPassageRef.current = null;
          if (resolved.ok) {
            location = resolved.value;
          }
        }

        const desiredBook =
          data.index.books.find((book) => book.id === location?.bookId) ??
          data.index.books.find((book) => book.id === "JHN") ??
          data.index.books[0];
        const desiredChapter =
          desiredBook.chapters.find(
            (chapter) => chapter.id === location?.chapterId,
          ) ?? desiredBook.chapters[0];

        if (!desiredChapter) {
          throw new Error("Esta tradução não possui capítulos disponíveis.");
        }

        setBookId(desiredBook.id);
        setChapterId(desiredChapter.id);
        const loaded = await loadPassage(
          data.selectedVersionId,
          desiredBook.id,
          desiredChapter.id,
        );

        if (loaded && location?.verseStart !== undefined) {
          setSelectedVerses(getSelectionRange(location, data.index.books));
          setPendingScrollVerse(location.verseStart);
        }
      } catch (error) {
        setCatalogError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as traduções.",
        );
        setCatalogState("error");
        setPassageState("error");
      }
    },
    [loadPassage],
  );

  useEffect(() => {
    if (didInitializeRef.current) {
      return;
    }
    didInitializeRef.current = true;
    initialPassageRef.current = new URLSearchParams(
      window.location.search,
    ).get("passagem");
    void loadCatalog();
  }, [loadCatalog]);

  const currentVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) ?? null,
    [selectedVersionId, versions],
  );
  const currentBook = useMemo(
    () => index?.books.find((book) => book.id === bookId) ?? null,
    [bookId, index],
  );
  const currentChapter = useMemo(
    () =>
      currentBook?.chapters.find((chapter) => chapter.id === chapterId) ??
      null,
    [chapterId, currentBook],
  );
  const previousLocation = useMemo(
    () =>
      index
        ? getAdjacentLocation(index.books, bookId, chapterId, "previous")
        : null,
    [bookId, chapterId, index],
  );
  const nextLocation = useMemo(
    () =>
      index
        ? getAdjacentLocation(index.books, bookId, chapterId, "next")
        : null,
    [bookId, chapterId, index],
  );

  useEffect(() => {
    const content = contentRef.current;
    if (!content || !passage) {
      return;
    }

    const selected = new Set(selectedVerses);
    content.querySelectorAll<HTMLElement>(".yv-v[v]").forEach((verse) => {
      const verseNumber = Number(verse.getAttribute("v"));
      const isSelected = selected.has(verseNumber);
      verse.tabIndex = 0;
      verse.setAttribute("role", "button");
      verse.setAttribute("aria-pressed", String(isSelected));
      verse.setAttribute(
        "aria-label",
        `Versículo ${verseNumber}. Toque para ${isSelected ? "remover da" : "adicionar à"} seleção.`,
      );
      verse.classList.toggle("yv-v-selected", isSelected);
    });
  }, [passage, selectedVerses]);

  useEffect(() => {
    if (!pendingScrollVerse || !passage || !contentRef.current) {
      return;
    }

    const target = contentRef.current.querySelector<HTMLElement>(
      `.yv-v[v="${pendingScrollVerse}"]`,
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
    }
    setPendingScrollVerse(null);
  }, [passage, pendingScrollVerse]);

  const toggleVerse = useCallback((verseElement: HTMLElement) => {
    const verseNumber = Number(verseElement.getAttribute("v"));
    if (!Number.isInteger(verseNumber)) {
      return;
    }

    setSelectedVerses((current) =>
      current.includes(verseNumber)
        ? current.filter((verse) => verse !== verseNumber)
        : [...current, verseNumber].sort((a, b) => a - b),
    );
  }, []);

  function handleContentClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const verse = target.closest<HTMLElement>(".yv-v[v]");
    if (verse && contentRef.current?.contains(verse)) {
      toggleVerse(verse);
    }
  }

  function handleContentKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const verse = target.closest<HTMLElement>(".yv-v[v]");
    if (verse && contentRef.current?.contains(verse)) {
      event.preventDefault();
      toggleVerse(verse);
    }
  }

  async function handleVersionChange(versionId: number) {
    const location =
      bookId && chapterId
        ? {
            bookId,
            chapterId,
          }
        : undefined;
    await loadCatalog(versionId, location);
  }

  async function handleBookChange(nextBookId: string) {
    const nextBook = index?.books.find((book) => book.id === nextBookId);
    const nextChapterId = getFirstChapter(nextBook);

    if (!selectedVersionId || !nextBook || !nextChapterId) {
      return;
    }

    setBookId(nextBook.id);
    setChapterId(nextChapterId);
    await loadPassage(selectedVersionId, nextBook.id, nextChapterId);
  }

  async function handleChapterChange(nextChapterId: string) {
    if (!selectedVersionId || !bookId) {
      return;
    }

    setChapterId(nextChapterId);
    await loadPassage(selectedVersionId, bookId, nextChapterId);
  }

  async function navigateTo(location: {
    bookId: string;
    chapterId: string;
  }) {
    if (!selectedVersionId) {
      return;
    }

    setBookId(location.bookId);
    setChapterId(location.chapterId);
    await loadPassage(
      selectedVersionId,
      location.bookId,
      location.chapterId,
    );
    document
      .querySelector(".bible-reader-shell")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleReferenceSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReferenceError("");

    if (!index) {
      setReferenceError("Aguarde a Bíblia terminar de carregar.");
      return;
    }

    const resolved = resolveBibleReference(referenceInput, index.books);
    if (!resolved.ok) {
      setReferenceError(resolved.message);
      return;
    }

    if (!selectedVersionId) {
      return;
    }

    setBookId(resolved.value.bookId);
    setChapterId(resolved.value.chapterId);
    const loaded = await loadPassage(
      selectedVersionId,
      resolved.value.bookId,
      resolved.value.chapterId,
    );

    if (loaded && resolved.value.verseStart !== undefined) {
      setSelectedVerses(getSelectionRange(resolved.value, index.books));
      setPendingScrollVerse(resolved.value.verseStart);
    }
  }

  function buildSelectedText() {
    if (
      !contentRef.current ||
      !currentBook ||
      !currentChapter ||
      !currentVersion ||
      selectedVerses.length === 0
    ) {
      return "";
    }

    const text = selectedVerses
      .map((verseNumber) => {
        const element = contentRef.current?.querySelector<HTMLElement>(
          `.yv-v[v="${verseNumber}"]`,
        );
        return element ? getVerseText(element) : "";
      })
      .filter(Boolean)
      .join(" … ");
    const reference = `${currentBook.title} ${currentChapter.id}:${formatVerseNumbers(selectedVerses)} ${currentVersion.abbreviation}`;

    return text ? `“${text}”\n\n${reference}` : "";
  }

  async function handleCopy() {
    const text = buildSelectedText();
    if (!text) {
      return;
    }

    try {
      await copyToClipboard(text);
      setAnnouncement("Versículos copiados.");
    } catch {
      setAnnouncement("Não foi possível copiar. Tente novamente.");
    }
  }

  async function handleShare() {
    const text = buildSelectedText();
    if (!text) {
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Bíblia Sagrada",
          text,
          url: passage?.youVersionUrl,
        });
        setAnnouncement("Versículos compartilhados.");
        return;
      }

      await copyToClipboard(text);
      setAnnouncement(
        "Seu aparelho não abriu o compartilhamento; os versículos foram copiados.",
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setAnnouncement("Não foi possível compartilhar. Tente novamente.");
    }
  }

  const fallbackYouVersionUrl =
    passage?.youVersionUrl ??
    (currentVersion && bookId && chapterId
      ? buildYouVersionPassageUrl(
          currentVersion.id,
          `${bookId}.${chapterId}`,
          currentVersion.abbreviation,
          currentVersion.youVersionUrl,
        )
      : currentVersion?.youVersionUrl) ??
    GENERIC_YOUVERSION_URL;
  const readerStyle = {
    "--yv-reader-font-size": `${fontSize}px`,
    "--yv-reader-line-height": "1.78",
    "--yv-reader-font-family":
      'Georgia, "Times New Roman", ui-serif, serif',
    "--yv-font-sans": "var(--font-sans)",
    "--yv-foreground": "#f7f7f2",
    "--yv-muted-foreground": "rgba(255, 255, 255, 0.54)",
    "--yv-border": "#fffe15",
    "--yv-gray-20": "rgba(255, 255, 255, 0.5)",
  } as CSSProperties;

  if (catalogState === "error") {
    return (
      <section className="bible-reader-shell bible-unavailable" role="status">
        <span aria-hidden="true">BÍBLIA</span>
        <h2>Leitura temporariamente indisponível</h2>
        <p>{catalogError}</p>
        <div>
          <button type="button" onClick={() => void loadCatalog()}>
            Tentar novamente
          </button>
          <a
            href={GENERIC_YOUVERSION_URL}
            target="_blank"
            rel="noreferrer"
          >
            Abrir no YouVersion
          </a>
        </div>
      </section>
    );
  }

  return (
    <section
      className="bible-reader-shell"
      aria-label="Leitor da Bíblia"
      aria-busy={catalogState === "loading"}
    >
      <div className="bible-reader-controls">
        <form className="bible-reference-search" onSubmit={handleReferenceSearch}>
          <label htmlFor="bible-reference">Buscar uma referência</label>
          <div>
            <input
              id="bible-reference"
              value={referenceInput}
              onChange={(event) => setReferenceInput(event.target.value)}
              placeholder="Ex.: João 3:16 ou Salmos 23"
              autoComplete="off"
              enterKeyHint="search"
            />
            <button type="submit">Buscar</button>
          </div>
          {referenceError ? (
            <p className="bible-field-error" role="alert">
              {referenceError}
            </p>
          ) : null}
        </form>

        <div className="bible-selectors">
          <label>
            <span>Tradução</span>
            <select
              value={selectedVersionId ?? ""}
              onChange={(event) =>
                void handleVersionChange(Number(event.target.value))
              }
              disabled={catalogState === "loading"}
            >
              {versions.map((version) => (
                <option
                  key={version.id}
                  value={version.id}
                  disabled={version.availability !== "available"}
                >
                  {version.label}
                  {version.availability === "license_required"
                    ? " — licença pendente"
                    : version.availability === "unavailable"
                      ? " — indisponível"
                      : ""}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Livro</span>
            <select
              value={bookId}
              onChange={(event) => void handleBookChange(event.target.value)}
              disabled={!index || passageState === "loading"}
            >
              {index?.books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Capítulo</span>
            <select
              value={chapterId}
              onChange={(event) => void handleChapterChange(event.target.value)}
              disabled={!currentBook || passageState === "loading"}
            >
              {currentBook?.chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </label>

          <div className="bible-font-controls" aria-label="Tamanho da letra">
            <span>Tamanho</span>
            <div>
              <button
                type="button"
                onClick={() => setFontSize((size) => Math.max(17, size - 1))}
                disabled={fontSize <= 17}
                aria-label="Diminuir tamanho da letra"
              >
                A−
              </button>
              <output aria-live="polite">{fontSize}</output>
              <button
                type="button"
                onClick={() => setFontSize((size) => Math.min(28, size + 1))}
                disabled={fontSize >= 28}
                aria-label="Aumentar tamanho da letra"
              >
                A+
              </button>
            </div>
          </div>
        </div>
      </div>

      {versions.some(
        (version) => version.availability !== "available",
      ) ? (
        <p className="bible-license-note">
          Traduções marcadas como pendentes só serão ativadas após a liberação
          oficial da licença pela YouVersion e pela editora.
        </p>
      ) : null}

      <article className="bible-reading-panel">
        <header className="bible-reading-header">
          <div>
            <p>{currentVersion?.title ?? "Bíblia Sagrada"}</p>
            <h2>
              {currentBook?.title ?? "Carregando"}
              {currentChapter ? ` ${currentChapter.title}` : ""}
            </h2>
          </div>
          {currentVersion ? (
            <span>{currentVersion.abbreviation}</span>
          ) : null}
        </header>

        {catalogState === "loading" || passageState === "loading" ? (
          <div className="bible-loading" role="status">
            <span aria-hidden="true" />
            <p>Carregando a Palavra…</p>
          </div>
        ) : null}

        {passageState === "error" ? (
          <div className="bible-passage-error" role="alert">
            <h3>Não foi possível abrir este capítulo</h3>
            <p>{passageError}</p>
            <div>
              {selectedVersionId && bookId && chapterId ? (
                <button
                  type="button"
                  onClick={() =>
                    void loadPassage(selectedVersionId, bookId, chapterId)
                  }
                >
                  Tentar novamente
                </button>
              ) : null}
              <a
                href={fallbackYouVersionUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir no YouVersion
              </a>
            </div>
          </div>
        ) : null}

        {passageState === "ready" && passage ? (
          <>
            <p className="bible-selection-hint">
              Toque em um versículo para selecionar.
            </p>
            <div
              ref={contentRef}
              className="bible-scripture"
              data-slot="yv-bible-renderer"
              data-selectable="true"
              data-show-notes="false"
              dir={index?.textDirection === "rtl" ? "rtl" : "ltr"}
              style={readerStyle}
              onClick={handleContentClick}
              onKeyDown={handleContentKeyDown}
              dangerouslySetInnerHTML={{ __html: passage.html }}
            />
          </>
        ) : null}

        {selectedVerses.length > 0 ? (
          <div className="bible-selection-actions" role="region" aria-label="Versículos selecionados">
            <p>
              <strong>{selectedVerses.length}</strong>{" "}
              {selectedVerses.length === 1
                ? "versículo selecionado"
                : "versículos selecionados"}
            </p>
            <div>
              <button type="button" onClick={() => void handleCopy()}>
                Copiar
              </button>
              <button type="button" onClick={() => void handleShare()}>
                Compartilhar
              </button>
              <button
                type="button"
                className="bible-clear-selection"
                onClick={() => setSelectedVerses([])}
              >
                Limpar
              </button>
            </div>
          </div>
        ) : null}

        <nav className="bible-chapter-navigation" aria-label="Navegação entre capítulos">
          <button
            type="button"
            disabled={!previousLocation || passageState === "loading"}
            onClick={() =>
              previousLocation && void navigateTo(previousLocation)
            }
          >
            <span aria-hidden="true">←</span>
            Capítulo anterior
          </button>
          <button
            type="button"
            disabled={!nextLocation || passageState === "loading"}
            onClick={() => nextLocation && void navigateTo(nextLocation)}
          >
            Próximo capítulo
            <span aria-hidden="true">→</span>
          </button>
        </nav>

        {currentVersion ? (
          <footer className="bible-translation-credits">
            <p className="bible-credit-label">Créditos da tradução</p>
            <h3>{currentVersion.title}</h3>
            {currentVersion.publisherName ? (
              <p>
                Editora: <strong>{currentVersion.publisherName}</strong>
              </p>
            ) : null}
            {currentVersion.copyright ? (
              <p>{currentVersion.copyright}</p>
            ) : null}
            {currentVersion.info ? <p>{currentVersion.info}</p> : null}
            {currentVersion.promotionalContent ? (
              <p>{currentVersion.promotionalContent}</p>
            ) : null}
            <div>
              {currentVersion.publisherUrl ? (
                <a
                  href={currentVersion.publisherUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Site da editora
                </a>
              ) : null}
              <a
                href={fallbackYouVersionUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir no YouVersion
              </a>
            </div>
          </footer>
        ) : null}
      </article>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

