"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CHURCH_YOUTUBE_LIVE_URL, type LiveSnapshot } from "@/lib/youtube-live";
import styles from "./live-worship.module.css";

export default function LiveWorship({ expanded = false }: { expanded?: boolean }) {
  const [state, setState] = useState<LiveSnapshot>({ status: "unknown", video: null });
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let disposed = false;
    let pending = false;
    let controller: AbortController | null = null;
    async function refresh() {
      if (document.hidden || pending) return;
      pending = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 12_000);
      try {
        const response = await fetch("/api/live", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Live status unavailable");
        const next: LiveSnapshot = await response.json();
        if (!disposed) {
          // An API outage must not interrupt a player that is already running.
          setState((previous) => next.status === "unknown"
            ? { status: "unknown", video: previous.video } : next);
          setChecked(true);
        }
      } catch {
        if (!disposed) {
          setState((previous) => ({ ...previous, status: "unknown" }));
          setChecked(true);
        }
      } finally {
        window.clearTimeout(timeout);
        pending = false;
      }
    }
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);

  const live = state.status === "live";
  return (
    <section className={styles.card} aria-label="Cultos ao vivo da Casa">
      <div className={styles.top}>
        <div>
          <p className={styles.eyebrow} role="status">
            <span className={live ? styles.liveDot : styles.dot} aria-hidden="true" />
            {live ? "Estamos ao vivo" : "Cultos ao vivo"}
          </p>
          <h2>{state.video?.title || "A Casa, onde você estiver."}</h2>
          <p className={styles.schedule}>Quarta, 19h30 · Domingo, 19h <span>Horário de Brasília</span></p>
        </div>
        {!expanded && !state.video && <Link className={styles.action} href="/ao-vivo">Acompanhar culto <span aria-hidden="true">→</span></Link>}
      </div>
      {state.video?.embeddable && (
        <div className={styles.player}>
          <iframe
            key={state.video.id}
            src={`https://www.youtube-nocookie.com/embed/${state.video.id}?rel=0&playsinline=1`}
            title={state.video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      )}
      {(expanded || state.video) && (
        <div className={styles.details}>
          <p>{live
            ? state.video?.embeddable ? "Toque no vídeo para assistir aqui, até o fim do culto." : "O YouTube não permite reproduzir esta transmissão aqui. Assista pelo canal da Casa."
            : state.status === "offline" ? "Nenhum culto ao vivo identificado agora. Quando a transmissão começar no canal, ela aparecerá aqui automaticamente."
            : checked ? "Não foi possível confirmar uma transmissão agora. A verificação continua automaticamente; você também pode conferir o canal."
            : "Verificando a transmissão da Casa…"}</p>
          <a href={state.video ? `https://www.youtube.com/watch?v=${state.video.id}` : CHURCH_YOUTUBE_LIVE_URL}
            target="_blank" rel="noreferrer">{live ? "Assistir no YouTube" : "Conferir o canal no YouTube"} <span aria-hidden="true">↗</span></a>
        </div>
      )}
    </section>
  );
}
