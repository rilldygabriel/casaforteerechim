import Image from "next/image";
import Link from "next/link";

const WHATSAPP_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Quero%20conhecer%20a%20Igreja%20Casa%20Forte.";
const FIRST_VISIT_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Quero%20ir%20%C3%A0%20Casa%20pela%20primeira%20vez.%20Como%20funciona%3F";
const VISITOR_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Sou%20visitante%20da%20Casa%20Forte%20e%20quero%20me%20conectar.";
const MAPS_URL = "https://maps.app.goo.gl/wAtHfmS7cFcFP5UC9?g_st=ic";
const GROUP_URL =
  "https://chat.whatsapp.com/Ix3EKdZymHEAhYpgVqUzQG?mode=gi_t";

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

function DoorIcon() {
  return (
    <svg
      aria-hidden="true"
      className="path-icon"
      viewBox="0 0 32 32"
      fill="none"
    >
      <path d="M6.5 27.5h19M9.5 27.5v-22h13v22M17.5 16h.01" />
      <path d="M22.5 27.5h4v-22h-4" />
    </svg>
  );
}

function ConnectionIcon() {
  return (
    <svg
      aria-hidden="true"
      className="path-icon"
      viewBox="0 0 32 32"
      fill="none"
    >
      <circle cx="11" cy="11" r="4" />
      <circle cx="23.5" cy="12.5" r="3.5" />
      <path d="M3.5 27c.7-5.2 3.1-8 7.5-8s6.8 2.8 7.5 8M18 20.2c1.3-1.4 3.1-2.2 5.5-2.2 3.5 0 5.4 2.2 6 6.2" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="path-icon"
      viewBox="0 0 32 32"
      fill="none"
    >
      <path d="m4.5 14 11.5-9 11.5 9M7.5 12v15h17V12M12.5 27v-8h7v8" />
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
              <a className="button button-primary" href="#proximos-passos">
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

      <section
        className="paths-section"
        id="proximos-passos"
        aria-labelledby="paths-title"
      >
        <div className="paths-inner">
          <div className="paths-heading">
            <p className="section-eyebrow">
              <span aria-hidden="true" />
              Seu próximo passo
            </p>
            <div className="paths-heading-copy">
              <h2 id="paths-title">
                Como você chega
                <strong>à Casa?</strong>
              </h2>
              <p>
                Escolha a opção que mais combina com o seu momento. A gente
                mostra o caminho e caminha junto com você.
              </p>
            </div>
          </div>

          <div className="paths-grid">
            <article className="path-card path-card-featured">
              <div className="path-card-topline">
                <span className="path-number">01</span>
                <DoorIcon />
              </div>
              <div className="path-card-copy">
                <p className="path-kicker">Quero conhecer</p>
                <h3>Primeira vez na Casa</h3>
                <p className="path-question">
                  Quero ir à Casa pela primeira vez. Como funciona?
                </p>
                <p className="path-description">
                  Escolha um culto, veja como chegar e, se quiser, avise nossa
                  equipe para receber você.
                </p>
              </div>
              <div className="path-actions">
                <a
                  className="path-link path-link-primary"
                  href={FIRST_VISIT_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Planejar minha visita
                  <ArrowIcon />
                </a>
                <a
                  className="path-link path-link-secondary"
                  href={MAPS_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  <PinIcon />
                  Ver localização
                </a>
              </div>
            </article>

            <article className="path-card">
              <div className="path-card-topline">
                <span className="path-number">02</span>
                <ConnectionIcon />
              </div>
              <div className="path-card-copy">
                <p className="path-kicker">Já estive em um culto</p>
                <h3>Sou visitante</h3>
                <p className="path-question">
                  Quero continuar perto e conhecer melhor a Casa.
                </p>
                <p className="path-description">
                  Nossa equipe de conexão está pronta para ouvir você e
                  acompanhar seu próximo passo.
                </p>
              </div>
              <div className="path-actions">
                <a
                  className="path-link path-link-primary"
                  href={VISITOR_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Quero me conectar
                  <ArrowIcon />
                </a>
              </div>
            </article>

            <article className="path-card">
              <div className="path-card-topline">
                <span className="path-number">03</span>
                <HomeIcon />
              </div>
              <div className="path-card-copy">
                <p className="path-kicker">Esta é a minha igreja</p>
                <h3>Sou da Casa</h3>
                <p className="path-question">
                  Já faço parte desta família e quero estar por dentro.
                </p>
                <p className="path-description">
                  Entre no grupo oficial e acompanhe avisos, programações e o
                  que acontece na Casa.
                </p>
              </div>
              <div className="path-actions">
                <a
                  className="path-link path-link-primary"
                  href={GROUP_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Acessar grupo da Casa
                  <ArrowIcon />
                </a>
                <span className="path-status">
                  Área da Família em uma próxima etapa
                </span>
              </div>
            </article>
          </div>

          <p className="paths-statement">
            Aqui você não é só mais um. <strong>Você é família.</strong>
          </p>
        </div>
      </section>
    </main>
  );
}
