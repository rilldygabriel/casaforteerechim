"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";

const ITEMS = [
  { href: "/familia", label: "Membros", name: "Área de membro", path: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { href: "/eventos", label: "Inscrições", name: "Inscrições nos eventos", path: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M8 15l3 3 5-5" },
  { href: "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Quero%20conhecer%20a%20Igreja%20Casa%20Forte.", label: "Contato", name: "Fale conosco pelo WhatsApp (abre em outra aba)", path: "M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" },
  { href: "/generosidade", label: "Generosidade", name: "Generosidade", path: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" },
  { href: "/admin", label: "Painel", name: "Painel administrativo", path: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" },
] as const;

/** Ordinary links: the moving light is decorative, not a fake selected page. */
export default function HomeQuickNav() {
  const [highlight, setHighlight] = useState<number | null>(null);
  return (
    <div
      className="home-glass-nav"
      data-engaged={highlight !== null}
      style={{ "--nav-index": highlight ?? 0 } as CSSProperties}
      onPointerLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement)) setHighlight(null);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHighlight(null);
      }}
    >
      <span className="home-glass-track" aria-hidden="true"><span /></span>
      {ITEMS.map((item, index) => {
        const contents = <>
          <span className="home-glass-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"><path d={item.path} /></svg>
          </span>
          <span>{item.label}</span>
        </>;
        const props = {
          className: "home-glass-link",
          "aria-label": item.name,
          "data-highlighted": highlight === index,
          onPointerEnter: () => setHighlight(index),
          onPointerDown: () => setHighlight(index),
          onFocus: () => setHighlight(index),
        };
        return item.href.startsWith("https:")
          ? <a key={item.href} {...props} href={item.href} target="_blank" rel="noreferrer">{contents}</a>
          : <Link key={item.href} {...props} href={item.href}>{contents}</Link>;
      })}
    </div>
  );
}
