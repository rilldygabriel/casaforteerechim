"use client";

import { useState } from "react";

type AttendanceStatus = "pendente" | "presente" | "ausente";

export default function AttendanceControls({
  checkinId,
  initialStatus,
}: {
  checkinId: number;
  initialStatus: AttendanceStatus;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);

  async function update(nextStatus: AttendanceStatus) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/pre-checkin/${checkinId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (response.ok) {
        setStatus(nextStatus);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-attendance-controls" role="group" aria-label="Presença">
      <button
        type="button"
        className={status === "presente" ? "is-selected is-present" : ""}
        aria-pressed={status === "presente"}
        disabled={saving}
        onClick={() => void update("presente")}
      >
        Presente
      </button>
      <button
        type="button"
        className={status === "ausente" ? "is-selected is-away" : ""}
        aria-pressed={status === "ausente"}
        disabled={saving}
        onClick={() => void update("ausente")}
      >
        Ausente
      </button>
      {status !== "pendente" ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void update("pendente")}
        >
          Limpar
        </button>
      ) : null}
    </div>
  );
}
