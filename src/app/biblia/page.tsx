import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "@youversion/platform-core/browser/styles/bible-reader.css";
import BibleReader from "./bible-reader";
import "./bible.css";

export const metadata: Metadata = {
  title: "Bíblia Sagrada",
  description:
    "Leia a Bíblia Sagrada no site oficial da Igreja Casa Forte Erechim.",
  alternates: {
    canonical: "/biblia",
  },
};

export default function BiblePage() {
  return (
    <main className="bible-page">
      <header className="bible-site-header">
        <Link href="/" aria-label="Voltar ao início da Igreja Casa Forte">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={184}
            height={72}
            priority
          />
        </Link>
        <Link className="bible-back-link" href="/">
          <span aria-hidden="true">←</span>
          Voltar ao site
        </Link>
      </header>

      <section className="bible-hero" aria-labelledby="bible-page-title">
        <p className="bible-kicker">A Palavra sempre perto</p>
        <h1 id="bible-page-title">Bíblia Sagrada</h1>
        <p>
          Leia, selecione e compartilhe a Palavra de Deus com quem você ama.
        </p>
      </section>

      <BibleReader />

      <footer className="bible-site-footer">
        <p>
          Conteúdo bíblico fornecido e licenciado oficialmente pela YouVersion
          Platform.
        </p>
        <a
          href="https://www.bible.com/pt"
          target="_blank"
          rel="noreferrer"
        >
          Abrir no YouVersion
        </a>
      </footer>
    </main>
  );
}

