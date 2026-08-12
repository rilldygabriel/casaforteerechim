"use client";

import { useState } from "react";

const OPTIONS = [
  { id: "primicias", label: "Oferta de primícias", key: "54993217227", display: "54 99321-7227", description: "Uma expressão de honra e gratidão pelas primeiras conquistas." },
  { id: "dizimos-ofertas", label: "Dízimos e ofertas", key: "46534858000137", display: "46.534.858/0001-37", description: "Sua contribuição sustenta a missão e tudo o que construímos juntos." },
] as const;

export default function PixCopyOptions() {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(key: string, id: string) {
    try { await navigator.clipboard.writeText(key); } catch {
      const input = document.createElement("textarea"); input.value = key; input.style.position = "fixed"; input.style.opacity = "0"; document.body.appendChild(input); input.select(); document.execCommand("copy"); input.remove();
    }
    setCopied(id);
  }
  return <section className="pix-grid" aria-label="Chaves PIX da Casa Forte">{OPTIONS.map((option, index) => <article className="pix-card" key={option.id}><div className="pix-card-top"><span>0{index + 1}</span><small>{option.label}</small></div><p>{option.description}</p><strong>{option.display}</strong><button type="button" onClick={() => copy(option.key, option.id)} className={copied === option.id ? "is-copied" : undefined}>{copied === option.id ? "Chave copiada!" : "Copiar chave PIX"}</button></article>)}</section>;
}
