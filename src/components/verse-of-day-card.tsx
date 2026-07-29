"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { VerseOfDayResponse } from "@/lib/bible/types";

async function copyVerse(text: string) {
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

export default function VerseOfDayCard() {
  const [verse, setVerse] = useState<VerseOfDayResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadVerse() {
      try {
        const response = await fetch("/api/biblia/versiculo-do-dia", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setFailed(true);
          return;
        }

        setVerse((await response.json()) as VerseOfDayResponse);
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          setFailed(true);
        }
      }
    }

    void loadVerse();
    return () => controller.abort();
  }, []);

  if (failed || !verse) {
    return null;
  }

  const shareText = `“${verse.text}”\n\n${verse.reference} ${verse.abbreviation}`;

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Versículo do Dia",
          text: shareText,
          url: verse?.youVersionUrl,
        });
        setFeedback("Versículo compartilhado.");
        return;
      }

      await copyVerse(shareText);
      setFeedback("Versículo copiado para compartilhar.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      setFeedback("Não foi possível compartilhar agora.");
    }
  }

  return (
    <section
      className="home-block home-votd"
      aria-labelledby="home-votd-title"
    >
      <div className="home-votd-heading">
        <p className="home-kicker">Palavra para hoje</p>
        <h2 id="home-votd-title">Versículo do Dia</h2>
      </div>
      <blockquote>
        <p>“{verse.text}”</p>
        <footer>
          {verse.reference} <span>{verse.abbreviation}</span>
        </footer>
      </blockquote>
      <div className="home-votd-actions">
        <Link
          href={`/biblia?passagem=${encodeURIComponent(verse.passageId)}`}
        >
          Ler capítulo
          <span aria-hidden="true">→</span>
        </Link>
        <button type="button" onClick={() => void handleShare()}>
          Compartilhar
        </button>
      </div>
      <p className="home-votd-feedback" aria-live="polite">
        {feedback}
      </p>
    </section>
  );
}

