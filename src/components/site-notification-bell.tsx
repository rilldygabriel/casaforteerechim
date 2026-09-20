"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  type: "message" | "news";
  title: string;
  preview: string;
  publishedAt: string;
  href: string;
};

type NotificationState = {
  authenticated: boolean;
  available?: boolean;
  totalUnread: number;
  items: NotificationItem[];
};

const EMPTY_STATE: NotificationState = {
  authenticated: false,
  totalUnread: 0,
  items: [],
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export default function SiteNotificationBell({ floating = false }: { floating?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [state, setState] = useState<NotificationState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [showFloatingButton, setShowFloatingButton] = useState(false);

  useEffect(() => {
    if (!floating) return;

    function syncVisibility() {
      setShowFloatingButton(!document.querySelector(".site-notification-inline"));
    }

    const frame = window.requestAnimationFrame(syncVisibility);
    const observer = new MutationObserver(syncVisibility);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [floating, pathname]);

  useEffect(() => {
    if (floating && !showFloatingButton) return;

    const controller = new AbortController();

    async function loadNotifications() {
      try {
        const response = await fetch("/api/notificacoes", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("notification_fetch_failed");
        setState(await response.json() as NotificationState);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setState(EMPTY_STATE);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadNotifications();
    const refreshInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadNotifications();
    }, 60_000);
    window.addEventListener("focus", loadNotifications);

    return () => {
      controller.abort();
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", loadNotifications);
    };
  }, [floating, pathname, showFloatingButton]);

  async function openNotification(item: NotificationItem) {
    setState((current) => ({
      ...current,
      totalUnread: Math.max(0, current.totalUnread - 1),
      items: current.items.filter((candidate) => candidate.id !== item.id || candidate.type !== item.type),
    }));
    detailsRef.current?.removeAttribute("open");

    await fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, type: item.type }),
    }).catch(() => undefined);
    router.push(item.href);
  }

  if (floating && !showFloatingButton) return null;

  const unreadLabel = state.totalUnread === 1
    ? "1 notificação não lida"
    : `${state.totalUnread} notificações não lidas`;

  return (
    <details
      ref={detailsRef}
      className={`site-notification-shell ${floating ? "site-notification-floating" : "site-notification-inline"}`}
    >
      <summary
        className="site-notification-button"
        aria-label={state.totalUnread ? unreadLabel : "Abrir notificações"}
        title="Notificações"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M10 21h4" />
        </svg>
        {state.totalUnread > 0 ? <em>{state.totalUnread > 99 ? "99+" : state.totalUnread}</em> : null}
      </summary>

      <div className="site-notification-panel">
        <header>
          <div>
            <span>Central da Casa</span>
            <strong>Notificações</strong>
          </div>
          {state.totalUnread > 0 ? <em>{unreadLabel}</em> : null}
        </header>

        {loading ? <p className="site-notification-empty">Carregando seus avisos…</p> : null}
        {!loading && !state.authenticated ? (
          <div className="site-notification-empty">
            <strong>Entre na Área da Família</strong>
            <p>As mensagens e notícias não lidas aparecerão aqui.</p>
            <Link href="/familia/login">Entrar agora</Link>
          </div>
        ) : null}
        {!loading && state.authenticated && state.available === false ? (
          <p className="site-notification-empty">As notificações serão liberadas após a aprovação do seu cadastro.</p>
        ) : null}
        {!loading && state.authenticated && state.available !== false && !state.items.length ? (
          <p className="site-notification-empty">Tudo em dia. Você não tem notificações novas.</p>
        ) : null}

        {state.items.length ? (
          <div className="site-notification-list">
            {state.items.map((item) => (
              <button type="button" onClick={() => void openNotification(item)} key={`${item.type}-${item.id}`}>
                <span>{item.type === "news" ? "Notícia" : "Mensagem"}</span>
                <strong>{item.title}</strong>
                <p>{item.preview}</p>
                <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>
              </button>
            ))}
          </div>
        ) : null}

        {state.authenticated && state.available !== false ? (
          <Link className="site-notification-all" href="/familia/notificacoes">
            Ver todas as mensagens e notícias
          </Link>
        ) : null}
      </div>
    </details>
  );
}
