"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChurchEvent } from "@/lib/calendar-events";

type AttendanceState = {
  confirmedEventKeys: string[];
  authenticated: boolean;
};

export function useEventAttendance() {
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/eventos/presenca", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) return { confirmedEventKeys: [], authenticated: false } satisfies AttendanceState;
        if (!response.ok) throw new Error("Não foi possível consultar as confirmações.");
        return response.json() as Promise<AttendanceState>;
      })
      .then((result) => {
        if (!active) return;
        setConfirmed(new Set(result.confirmedEventKeys));
        setAuthenticated(result.authenticated);
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      });
    return () => { active = false; };
  }, []);

  const toggleAttendance = useCallback(async (event: ChurchEvent) => {
    if (authenticated === false) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/familia/login?next=${encodeURIComponent(returnTo)}`);
      return;
    }

    const nextConfirmed = !confirmed.has(event.id);
    setPendingKey(event.id);
    try {
      const response = await fetch("/api/eventos/presenca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventKey: event.id, confirmed: nextConfirmed }),
      });
      if (response.status === 401) {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/familia/login?next=${encodeURIComponent(returnTo)}`);
        return;
      }
      const result = await response.json() as { confirmed?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar sua confirmação.");
      setAuthenticated(true);
      setConfirmed((current) => {
        const updated = new Set(current);
        if (result.confirmed) updated.add(event.id);
        else updated.delete(event.id);
        return updated;
      });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Não foi possível salvar sua confirmação.");
    } finally {
      setPendingKey(null);
    }
  }, [authenticated, confirmed]);

  return { authenticated, confirmed, pendingKey, toggleAttendance };
}
