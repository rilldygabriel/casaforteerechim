"use client";

import type { ChurchEvent } from "@/lib/calendar-events";

export default function EventAttendanceButton({
  event,
  confirmed,
  pending,
  onToggle,
  className = "",
}: {
  event: ChurchEvent;
  confirmed: boolean;
  pending: boolean;
  onToggle: (event: ChurchEvent) => void | Promise<void>;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`event-attendance-button ${className}`.trim()}
      aria-pressed={confirmed}
      disabled={pending}
      onClick={() => void onToggle(event)}
    >
      {pending ? "Salvando…" : confirmed ? "Presença confirmada ✓" : "Confirmar presença"}
    </button>
  );
}
