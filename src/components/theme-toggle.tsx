"use client";

import { useEffect, useSyncExternalStore } from "react";

type Theme = "dark" | "navy" | "heritage";

const THEME_EVENT = "casa-forte-theme-change";

const THEME_LABELS: Record<Theme, string> = {
  dark: "Original",
  navy: "Marfim e azul",
  heritage: "Azul e dourado",
};

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const lightTheme = theme !== "dark";

  root.dataset.theme = lightTheme ? "light" : "dark";
  if (lightTheme) {
    root.dataset.palette = theme;
  } else {
    delete root.dataset.palette;
  }

  root.style.colorScheme = lightTheme ? "light" : "dark";
  localStorage.setItem("casa-forte-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      theme === "dark" ? "#080908" : theme === "heritage" ? "#f6f1e9" : "#f6f3ed",
    );
  window.dispatchEvent(new Event(THEME_EVENT));
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "navy") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="5" height="16" rx="2" />
        <rect x="9.5" y="4" width="5" height="16" rx="2" />
        <rect x="16" y="4" width="5" height="16" rx="2" />
      </svg>
    );
  }

  if (theme === "heritage") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="6" cy="12" r="3.5" />
        <circle cx="12" cy="12" r="3.5" />
        <circle cx="18" cy="12" r="3.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 15.6A8.7 8.7 0 0 1 8.4 3.8 8.7 8.7 0 1 0 20.2 15.6Z" />
    </svg>
  );
}

function readTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const palette = document.documentElement.dataset.palette;
  return palette === "navy" || palette === "heritage" ? palette : "dark";
}

function subscribeTheme(onStoreChange: () => void) {
  window.addEventListener(THEME_EVENT, onStoreChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onStoreChange);
  };
}

export default function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const theme = useSyncExternalStore<Theme>(subscribeTheme, readTheme, () => "dark");

  useEffect(() => {
    const saved = localStorage.getItem("casa-forte-theme");
    const active: Theme =
      saved === "heritage"
        ? "heritage"
        : saved === "navy" || saved === "light" || saved === "editorial"
          ? "navy"
          : "dark";

    if (readTheme() !== active) applyTheme(active);
  }, []);

  function selectTheme(next: Theme, target: HTMLButtonElement) {
    applyTheme(next);
    const picker = target.closest("details") as HTMLDetailsElement | null;
    if (picker) picker.open = false;
  }

  return (
    <details className={`theme-picker ${floating ? "theme-toggle-floating" : "theme-picker-inline"}`}>
      <summary
        className={`theme-toggle ${floating ? "" : "theme-toggle-inline"}`}
        aria-label={`Tema atual: ${THEME_LABELS[theme]}. Abrir opções de tema`}
        title="Escolher tema"
      >
        <ThemeIcon theme={theme} />
        <span>Tema</span>
      </summary>

      <div className="theme-choice-row" aria-label="Escolha o tema do site">
        {(Object.keys(THEME_LABELS) as Theme[]).map((option) => (
          <button
            className="theme-choice"
            type="button"
            key={option}
            aria-label={`Usar tema ${THEME_LABELS[option]}`}
            aria-pressed={theme === option}
            onClick={(event) => selectTheme(option, event.currentTarget)}
          >
            <ThemeIcon theme={option} />
            <span>{THEME_LABELS[option]}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
