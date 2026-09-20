"use client";

import { useRouter } from "next/navigation";

export default function SiteBackButton({ floating = false }: { floating?: boolean }) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  return (
    <button
      type="button"
      className={`site-back-button ${floating ? "site-back-floating" : "site-back-inline"}`}
      onClick={goBack}
      aria-label="Voltar para a página anterior"
      title="Voltar"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m14.5 5-7 7 7 7" />
        <path d="M8 12h10" />
      </svg>
      <span>Voltar</span>
    </button>
  );
}
