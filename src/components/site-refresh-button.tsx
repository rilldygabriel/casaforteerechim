"use client";

import { useState } from "react";

export default function SiteRefreshButton({ floating = false }: { floating?: boolean }) {
  const [refreshing, setRefreshing] = useState(false);

  function refreshPage() {
    setRefreshing(true);
    window.location.reload();
  }

  return (
    <button
      type="button"
      className={`site-refresh-button ${floating ? "site-refresh-floating" : "site-refresh-inline"}`}
      onClick={refreshPage}
      disabled={refreshing}
      aria-label={refreshing ? "Atualizando a página" : "Atualizar esta página"}
      title="Atualizar o site"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 11a8 8 0 1 0-2.34 5.66" />
        <path d="M20 4v7h-7" />
      </svg>
      <span>{refreshing ? "Atualizando…" : "Atualizar"}</span>
    </button>
  );
}
