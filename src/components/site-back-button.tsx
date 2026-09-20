"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

function pageHasItsOwnBackControl() {
  const controls = document.querySelectorAll<HTMLElement>(
    "header a, header button.site-back-inline",
  );

  return Array.from(controls).some((control) => {
    if (control.classList.contains("site-back-inline")) return true;

    const label = `${control.getAttribute("aria-label") ?? ""} ${control.textContent ?? ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

    return label.includes("voltar");
  });
}

export default function SiteBackButton({ floating = false }: { floating?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showFloatingButton, setShowFloatingButton] = useState(false);

  useEffect(() => {
    if (!floating) return;

    function syncVisibility() {
      setShowFloatingButton(pathname !== "/" && !pageHasItsOwnBackControl());
    }

    const frame = window.requestAnimationFrame(syncVisibility);
    const observer = new MutationObserver(syncVisibility);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [floating, pathname]);

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }

  if (floating && (pathname === "/" || !showFloatingButton)) return null;

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
