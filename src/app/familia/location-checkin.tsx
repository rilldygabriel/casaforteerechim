"use client";

import { useCallback, useEffect, useState } from "react";

type State = "checking" | "hidden" | "locating" | "success" | "error";

export default function LocationCheckin() {
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState("");

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setState("error");
      setMessage("Este aparelho não oferece localização pelo navegador.");
      return;
    }

    setState("locating");
    setMessage("Confirmando se você já chegou à Casa...");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch("/api/cultos/check-in-localizacao", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            }),
          });
          const result = (await response.json()) as {
            error?: string;
            message?: string;
          };

          if (!response.ok) {
            setState("error");
            setMessage(result.error || "Não foi possível confirmar sua presença.");
            return;
          }

          setState("success");
          setMessage(result.message || "Sua presença foi confirmada.");
        } catch {
          setState("error");
          setMessage("Sem conexão agora. Tente novamente.");
        }
      },
      (error) => {
        setState("error");
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Autorize a localização para usar o check-in automático."
            : "Não foi possível obter uma localização precisa. Tente novamente.",
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15_000,
      },
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function checkWindow() {
      try {
        const response = await fetch("/api/cultos/check-in-localizacao", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as { eligible?: boolean };
        if (!response.ok || !result.eligible) {
          setState("hidden");
          return;
        }
        locate();
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) {
          setState("hidden");
        }
      }
    }

    void checkWindow();
    return () => controller.abort();
  }, [locate]);

  if (state === "checking" || state === "hidden") return null;

  return (
    <section
      className={`family-location-checkin is-${state}`}
      aria-live="polite"
    >
      <div>
        <p>Check-in por localização</p>
        <strong>{message}</strong>
        <small>
          Usamos sua posição somente para confirmar que você está próximo da
          igreja. As coordenadas exatas não são armazenadas.
        </small>
      </div>
      {state === "error" ? (
        <button type="button" onClick={locate}>
          Tentar novamente
        </button>
      ) : null}
    </section>
  );
}
