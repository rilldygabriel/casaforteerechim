"use client";

import { useLayoutEffect, useState } from "react";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("casa-forte-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#ffffff" : "#080908");
}

export default function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useLayoutEffect(() => {
    const saved = localStorage.getItem("casa-forte-theme");
    const active = saved === "light" || document.documentElement.dataset.theme === "light" ? "light" : "dark";
    applyTheme(active);
    setTheme(active);
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  }

  const light = theme === "light";
  return (
    <button
      className={`theme-toggle ${floating ? "theme-toggle-floating" : "theme-toggle-inline"}`}
      type="button"
      onClick={toggle}
      aria-label={light ? "Ativar versão escura" : "Ativar versão clara"}
      title={light ? "Versão escura" : "Versão clara"}
      aria-pressed={light}
    >
      {light ? (
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.2 15.6A8.7 8.7 0 0 1 8.4 3.8 8.7 8.7 0 1 0 20.2 15.6Z" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      )}
      <span>{light ? "Escuro" : "Claro"}</span>
    </button>
  );
}
