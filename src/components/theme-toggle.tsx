"use client";

import { useLayoutEffect, useState } from "react";

type Theme = "dark" | "light" | "editorial";

const THEME_LABELS: Record<Theme, string> = {
  dark: "Escuro",
  light: "Claro",
  editorial: "Editorial",
};

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const lightTheme = theme !== "dark";

  root.dataset.theme = lightTheme ? "light" : "dark";
  if (theme === "editorial") {
    root.dataset.palette = "editorial";
  } else {
    delete root.dataset.palette;
  }

  root.style.colorScheme = lightTheme ? "light" : "dark";
  localStorage.setItem("casa-forte-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute(
      "content",
      theme === "dark" ? "#080908" : theme === "editorial" ? "#f1efeb" : "#ffffff",
    );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "light") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }

  if (theme === "editorial") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <path d="M17.5 14v7M14 17.5h7" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 15.6A8.7 8.7 0 0 1 8.4 3.8 8.7 8.7 0 1 0 20.2 15.6Z" />
    </svg>
  );
}

export default function ThemeToggle({ floating = false }: { floating?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useLayoutEffect(() => {
    const saved = localStorage.getItem("casa-forte-theme");
    const active: Theme =
      saved === "editorial" || document.documentElement.dataset.palette === "editorial"
        ? "editorial"
        : saved === "light" || document.documentElement.dataset.theme === "light"
          ? "light"
          : "dark";

    applyTheme(active);
    setTheme(active);
  }, []);

  function selectTheme(next: Theme, target: HTMLButtonElement) {
    applyTheme(next);
    setTheme(next);
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
