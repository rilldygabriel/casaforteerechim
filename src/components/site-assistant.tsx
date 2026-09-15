"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import "./site-assistant.css";

type Message = { role: "user" | "assistant"; text: string };

export default function SiteAssistant() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Oi! Sou a IA da Casa. Posso ajudar com cultos, eventos, visitas e caminhos do site. Como posso ajudar?" },
  ]);
  if (path.startsWith("/admin") || path.startsWith("/familia")) return null;

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    const history = messages.slice(-4);
    setMessages((previous) => [...previous, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/assistente", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }), cache: "no-store",
      });
      const result = await response.json() as { answer?: string; error?: string };
      setMessages((previous) => [...previous, { role: "assistant",
        text: response.ok ? result.answer || "Não encontrei uma resposta agora." : result.error || "Tente novamente mais tarde." }]);
    } catch {
      setMessages((previous) => [...previous, { role: "assistant", text: "Fiquei sem conexão. Tente novamente quando o site carregar." }]);
    } finally { setBusy(false); }
  }

  return <div className="site-assistant-root">
    {open ? <section className="site-assistant-panel" role="dialog" aria-label="Converse com a IA da Casa">
      <header><span className="site-assistant-mark" aria-hidden="true">✦</span><div><strong>IA da Casa</strong><small>Informações verificadas da igreja</small></div><button type="button" aria-label="Fechar assistente" onClick={() => setOpen(false)}>×</button></header>
      <div className="site-assistant-messages" aria-live="polite">
        {messages.map((message, index) => <p key={index} data-role={message.role}>{message.text}</p>)}
        {busy ? <p data-role="assistant">Estou consultando a Casa…</p> : null}
      </div>
      <form onSubmit={send}><label className="sr-only" htmlFor="site-assistant-input">Sua pergunta</label><input id="site-assistant-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder="Escreva sua pergunta" disabled={busy} /><button type="submit" disabled={busy || !input.trim()} aria-label="Enviar pergunta">→</button></form>
      <small className="site-assistant-note">Não envie dados sensíveis. Para cuidado pessoal, fale com nossa equipe.</small>
    </section> : null}
    <button className="site-assistant-launcher" type="button" onClick={() => setOpen((previous) => !previous)} aria-expanded={open} aria-label={open ? "Fechar IA da Casa" : "Conversar com a IA da Casa"}><span aria-hidden="true">✦</span><span>IA da Casa</span></button>
  </div>;
}
