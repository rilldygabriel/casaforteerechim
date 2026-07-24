"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const PIX_OPTIONS = [
  {
    id: "primicias",
    label: "Oferta de primícias",
    key: "54993217227",
    display: "54 99321-7227",
    description:
      "Uma expressão de honra e gratidão pelas primeiras conquistas.",
  },
  {
    id: "dizimos-ofertas",
    label: "Dízimos e ofertas",
    key: "46534858000137",
    display: "46.534.858/0001-37",
    description:
      "Sua contribuição sustenta a missão e tudo o que construímos juntos.",
  },
] as const;

type PixId = (typeof PIX_OPTIONS)[number]["id"];

export default function Generosidade() {
  const [copied, setCopied] = useState<PixId | null>(null);

  async function copyPix(key: string, id: PixId) {
    try {
      await navigator.clipboard.writeText(key);
    } catch {
      const input = document.createElement("textarea");
      input.value = key;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }

    setCopied(id);
  }

  return (
    <main className="inner-page generosity-page">
      <header className="inner-header">
        <Link href="/" aria-label="Voltar para o início">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={180}
            height={70}
          />
        </Link>
        <Link className="inner-back" href="/familia">
          Voltar para Sou da Casa
        </Link>
      </header>

      <section className="generosity-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Generosidade
        </p>
        <h1>
          Juntos construímos
          <strong>o que Deus está fazendo.</strong>
        </h1>
        <p>
          Contribua de forma simples e segura. Escolha a finalidade e copie a
          chave PIX com um toque.
        </p>
      </section>

      <section className="pix-grid" aria-label="Chaves PIX da Casa Forte">
        {PIX_OPTIONS.map((option, index) => (
          <article className="pix-card" key={option.id}>
            <div className="pix-card-top">
              <span>0{index + 1}</span>
              <small>{option.label}</small>
            </div>
            <p>{option.description}</p>
            <strong>{option.display}</strong>
            <button
              type="button"
              onClick={() => copyPix(option.key, option.id)}
              className={copied === option.id ? "is-copied" : undefined}
            >
              {copied === option.id ? "Chave copiada!" : "Copiar chave PIX"}
            </button>
          </article>
        ))}
      </section>

      <p className="pix-security-note">
        Antes de concluir a transferência, confira os dados do favorecido no
        seu aplicativo bancário.
      </p>
    </main>
  );
}
