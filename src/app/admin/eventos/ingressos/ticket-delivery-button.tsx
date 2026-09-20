"use client";

import { useState } from "react";

type Summary = {
  ticketsIssued: number;
  email: { sent: number; failed: number; skipped: number; unavailable: number };
  whatsapp: { sent: number; failed: number; skipped: number; unavailable: number };
};

export default function TicketDeliveryButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function deliver() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/eventos/ingressos/enviar", { method: "POST" });
      const payload = await response.json() as { error?: string; summary?: Summary };
      if (!response.ok || !payload.summary) throw new Error(payload.error || "Falha no envio.");
      const summary = payload.summary;
      setMessage(`${summary.ticketsIssued} ingressos conferidos. E-mail: ${summary.email.sent} enviados e ${summary.email.failed} falhas. WhatsApp: ${summary.whatsapp.sent} enviados, ${summary.whatsapp.skipped} já entregues e ${summary.whatsapp.failed} falhas.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar os ingressos.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="admin-ticket-delivery">
    <div><strong>Entregar ingressos digitais</strong><p>Envia o QR individual aos compradores confirmados por e-mail e WhatsApp.</p></div>
    <button type="button" onClick={deliver} disabled={busy}>{busy ? "Enviando…" : "Enviar ingressos"}</button>
    {message ? <p className="admin-ticket-delivery-result" role="status" aria-live="polite">{message}</p> : null}
  </section>;
}
