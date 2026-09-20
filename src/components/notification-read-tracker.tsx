"use client";

import { useEffect } from "react";

export default function NotificationReadTracker({ id, type }: { id: string; type: "news" }) {
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/notificacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type }),
      signal: controller.signal,
    }).catch(() => undefined);
    return () => controller.abort();
  }, [id, type]);

  return null;
}
