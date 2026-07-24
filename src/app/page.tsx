import Image from "next/image";
import Link from "next/link";

const WHATSAPP_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Quero%20conhecer%20a%20Igreja%20Casa%20Forte.";
const MAPS_URL = "https://maps.app.goo.gl/wAtHfmS7cFcFP5UC9?g_st=ic";

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="button-icon"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      className="button-icon"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M15.25 8.25c0 3.5-5.25 8-5.25 8s-5.25-4.5-5.25-8a5.25 5.25 0 1 1 10.5 0Z" />
      <circle cx="10" cy="8.25" r="1.75" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="site-shell">
      <section className="hero" aria-labelledby="hero-title">
        <Image
          className="hero-image"
          src="/images/hero.jpg"
          alt="Comunidade reunida em um culto da Igreja Casa Forte Erechim"
          fill
          priority
          sizes="100vw"
        />
        <div className="hero-overlay" />
        <div className="hero-glow" />

        <header className="site-header">
          <Link className="brand" href="/" aria-label="Casa Forte — início">
            <Image
              src="/images/logo-casa-forte.png"
              alt="Igreja Casa Forte"
              width={220}
              height={85}
              priority
            />
          </Link>

          <nav className="header-actions" aria-label="Acesso rápido">
            <a
              className="header-link"
              href={MAPS_URL}
              target="_blank"
              rel="noreferrer"
            >
              <PinIcon />
              <span>Como chegar</span>
            </a>
            <a
              className="header-cta"
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
            >
              Fale com a gente
              <ArrowIcon />
            </a>
          </nav>
        </header>

        <div className="hero-content">
          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true" />
              Uma igreja para chamar de casa
            </p>

            <h1 id="hero-title">
              Você tem um
              <strong>lugar aqui.</strong>
            </h1>

            <p className="hero-message">
              Não ande sozinho. <span>Vem pra casa.</span>
            </p>

            <p className="hero-description">
              Uma comunidade para viver Jesus, construir vínculos e crescer em
              família, bem no coração de Erechim.
            </p>

            <div className="hero-actions">
              <a
                className="button button-primary"
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
              >
                Quero conhecer a Casa
                <ArrowIcon />
              </a>
              <a
                className="button button-secondary"
                href={MAPS_URL}
                target="_blank"
                rel="noreferrer"
              >
                <PinIcon />
                Ver no mapa
              </a>
            </div>
          </div>
        </div>

        <div className="hero-footer">
          <div className="schedule" aria-label="Programação semanal">
            <div className="schedule-item">
              <span>Domingo na Casa</span>
              <strong>19h</strong>
            </div>
            <div className="schedule-item">
              <span>Quarta na Casa</span>
              <strong>19h30</strong>
            </div>
            <div className="schedule-item schedule-item-last">
              <span>1 Hora de Intercessão</span>
              <strong>Sexta • 19h30</strong>
            </div>
          </div>

          <a
            className="address"
            href={MAPS_URL}
            target="_blank"
            rel="noreferrer"
          >
            <PinIcon />
            <span>
              Rua José Reinaldo Angonezze, 319
              <small>José Bonifácio • Erechim, RS</small>
            </span>
          </a>
        </div>
      </section>
    </main>
  );
}
