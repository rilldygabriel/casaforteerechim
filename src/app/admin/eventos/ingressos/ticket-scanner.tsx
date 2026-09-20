"use client";

import { useEffect, useRef, useState } from "react";
import { parseEventTicketToken } from "@/lib/event-ticket-token";

type Ticket = {
  code: string;
  status: "valid" | "redeemed" | "cancelled";
  redeemedAt: string | null;
  eventTitle: string;
  fullName: string;
  simpleQuantity: number;
  doubleQuantity: number;
  totalCents: number;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default function TicketScanner() {
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [token, setToken] = useState("");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [message, setMessage] = useState("Aponte a câmera para o QR Code do ingresso.");
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { void scannerRef.current?.stop().catch(() => undefined); scannerRef.current?.clear(); }, []);

  async function lookup(value: string, redeem = false) {
    const parsed = parseEventTicketToken(value);
    if (!parsed) { setMessage("Este QR Code não pertence a um ingresso válido."); return; }
    setLoading(true);
    setMessage(redeem ? "Confirmando a retirada…" : "Conferindo o ingresso…");
    try {
      const response = await fetch("/api/admin/eventos/ingressos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: parsed, redeem }),
      });
      const payload = await response.json() as { error?: string; ticket?: Ticket };
      if (!response.ok || !payload.ticket) throw new Error(payload.error || "Ingresso não encontrado.");
      setToken(parsed);
      setTicket(payload.ticket);
      setMessage(payload.ticket.status === "redeemed" ? "Este pedido já foi retirado." : payload.ticket.status === "cancelled" ? "Este ingresso está cancelado." : "Pagamento confirmado. Confira o pedido antes de liberar.");
    } catch (error) {
      setTicket(null);
      setMessage(error instanceof Error ? error.message : "Não foi possível conferir o ingresso.");
    } finally { setLoading(false); }
  }

  async function startScanner() {
    setTicket(null);
    setMessage("Abrindo a câmera…");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("event-ticket-camera");
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await scanner.stop().catch(() => undefined);
          scanner.clear();
          scannerRef.current = null;
          setScanning(false);
          await lookup(decodedText);
        },
        () => undefined,
      );
      setMessage("Aponte a câmera para o QR Code do ingresso.");
    } catch {
      setScanning(false);
      setMessage("Não foi possível abrir a câmera. Autorize o acesso ou digite o código abaixo.");
    }
  }

  async function stopScanner() {
    await scannerRef.current?.stop().catch(() => undefined);
    scannerRef.current?.clear();
    scannerRef.current = null;
    setScanning(false);
  }

  return <section className="event-ticket-scanner">
    <div className="event-ticket-scanner-actions"><button type="button" onClick={scanning ? stopScanner : startScanner}>{scanning ? "Fechar câmera" : "Ler QR Code"}</button></div>
    <div id="event-ticket-camera" data-active={scanning} />
    <p className="event-ticket-scanner-message" role="status">{message}</p>
    <form onSubmit={(event) => { event.preventDefault(); void lookup(manual); }}><label>Código do ingresso<input value={manual} onChange={(event) => setManual(event.target.value)} placeholder="Digite ou cole o código" /></label><button type="submit" disabled={loading}>Conferir</button></form>
    {ticket ? <article className="event-ticket-result" data-status={ticket.status}>
      <header><span>{ticket.status === "valid" ? "Pagamento confirmado" : ticket.status === "redeemed" ? "Pedido já retirado" : "Ingresso cancelado"}</span><strong>{ticket.code}</strong></header>
      <h2>{ticket.fullName}</h2>
      <dl><div><dt>Simples</dt><dd>{ticket.simpleQuantity}</dd></div><div><dt>Duplos</dt><dd>{ticket.doubleQuantity}</dd></div><div><dt>Total</dt><dd>{money.format(ticket.totalCents / 100)}</dd></div></dl>
      {ticket.status === "valid" ? <button type="button" disabled={loading} onClick={() => lookup(token, true)}>Confirmar retirada</button> : null}
      {ticket.status === "redeemed" && ticket.redeemedAt ? <p>Retirada confirmada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(ticket.redeemedAt))}.</p> : null}
    </article> : null}
  </section>;
}
