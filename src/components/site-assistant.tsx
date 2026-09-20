"use client";

import { useEffect, useRef, useState } from "react";
import "./site-assistant.css";

type Message = { role: "user" | "assistant"; text: string };

const SAFE_LINK_HOSTS = new Set([
  "www.casaforteerechim.app.br", "casaforteerechim.app.br", "maps.app.goo.gl",
  "wa.me", "www.youtube.com", "youtube.com", "drive.google.com",
]);

function renderAnswer(text: string) {
  const parts = text.split(/(\[[^\]]+\]\(https:\/\/[^\s)]+\)|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\((https:\/\/[^\s)]+)\)$/.exec(part);
    if (link) {
      try {
        const url = new URL(link[2]);
        if (SAFE_LINK_HOSTS.has(url.hostname)) return <a key={index} href={url.toString()} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
      } catch { /* Treat invalid links as plain text. */ }
      return <span key={index}>{link[1]}</span>;
    }
    return <span key={index}>{part}</span>;
  });
}

export default function SiteAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "Oi! Sou a IA da Casa. Posso ajudar com cultos, eventos, visitas e caminhos do site. Como posso ajudar?" },
  ]);
  useEffect(() => {
    const openAssistant = () => setOpen(true);
    window.addEventListener("casa-forte:open-assistant", openAssistant);
    return () => window.removeEventListener("casa-forte:open-assistant", openAssistant);
  }, []);
  useEffect(() => { if (open) messagesEnd.current?.scrollIntoView({ block: "end" }); }, [open, messages, busy]);
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question || busy) return;
    const history = messages.slice(-4);
    setMessages((previous) => [...previous, { role: "user", text: question }]);
    setMessages((previous) => [...previous, { role: "assistant", text: "" }]);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/assistente", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }), cache: "no-store",
      });
      if (!response.ok || !response.body) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || "Tente novamente mais tarde.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((previous) => previous.map((message, index) => index === previous.length - 1 ?
          { role: "assistant", text: answer.slice(0, 1800) } : message));
      }
      answer += decoder.decode();
      if (!answer.trim()) throw new Error("Não encontrei uma resposta agora. Tente novamente.");
      setMessages((previous) => previous.map((message, index) => index === previous.length - 1 ?
        { role: "assistant", text: answer.slice(0, 1800) } : message));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Fiquei sem conexão. Tente novamente quando o site carregar.";
      setMessages((previous) => previous.map((item, index) => index === previous.length - 1 ?
        { role: "assistant", text: message } : item));
    } finally { setBusy(false); }
  }

  return <div className="site-assistant-root">
    {open ? <section className="site-assistant-panel" role="dialog" aria-label="Converse com a IA da Casa">
      <header><span className="site-assistant-mark" aria-hidden="true">✦</span><div><strong>IA da Casa · GPT</strong><small>Respostas públicas da igreja</small></div><button type="button" aria-label="Fechar assistente" onClick={() => setOpen(false)}>×</button></header>
      <div className="site-assistant-messages" aria-live="polite">
        {messages.map((message, index) => <p key={index} data-role={message.role}>{message.role === "assistant" ? message.text ? renderAnswer(message.text) : <span className="site-assistant-typing" aria-label="IA digitando"><i/><i/><i/></span> : message.text}</p>)}
        <div ref={messagesEnd} aria-hidden="true" />
      </div>
      <form onSubmit={send}><label className="sr-only" htmlFor="site-assistant-input">Sua pergunta</label><input id="site-assistant-input" value={input} onChange={(event) => setInput(event.target.value)} maxLength={500} placeholder="Escreva sua pergunta" disabled={busy} /><button type="submit" disabled={busy || !input.trim()} aria-label="Enviar pergunta">→</button></form>
      <small className="site-assistant-note">Este chat responde só informações públicas, mesmo dentro da Família. Não envie dados sensíveis.</small>
    </section> : null}
    <button className="site-assistant-launcher" type="button" onClick={() => setOpen((previous) => !previous)} aria-expanded={open} aria-label={open ? "Fechar IA da Casa" : "Conversar com a IA da Casa"}><span aria-hidden="true">✦</span><span>IA da Casa</span></button>
  </div>;
}
