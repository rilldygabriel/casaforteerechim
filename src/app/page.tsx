import Image from "next/image";
import Link from "next/link";
import PixCopyButton from "@/components/pix-copy-button";

const WHATSAPP_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Quero%20conhecer%20a%20Igreja%20Casa%20Forte.";
const FIRST_VISIT_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Quero%20ir%20%C3%A0%20Casa%20pela%20primeira%20vez.%20Como%20funciona%3F";
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

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="schedule-calendar-icon"
      viewBox="0 0 32 32"
      fill="none"
    >
      <rect x="4.5" y="7.5" width="23" height="20" rx="4" />
      <path d="M10 4.5v6M22 4.5v6M4.5 13.5h23" />
      <path d="M10 18h3M19 18h3M10 23h3M19 23h3" />
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

function GenerosityIcon() {
  return (
    <svg
      aria-hidden="true"
      className="path-icon"
      viewBox="0 0 32 32"
      fill="none"
    >
      <path d="M16 27S5 21.1 5 12.8C5 9 7.8 6.5 11.1 6.5c2.1 0 3.9 1.1 4.9 2.8 1-1.7 2.8-2.8 4.9-2.8 3.3 0 6.1 2.5 6.1 6.3C27 21.1 16 27 16 27Z" />
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
            <div className="header-contact-actions">
              <a
                className="first-visit-pill"
                href={FIRST_VISIT_URL}
                target="_blank"
                rel="noreferrer"
              >
                Quero visitar a Casa
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
            </div>
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

            <div className="hero-actions hero-entry-actions">
              <Link className="button button-primary entry-button" href="/visitante">
                Sou visitante
                <ArrowIcon />
              </Link>
              <Link className="button button-primary entry-button" href="/familia">
                Sou da Casa
                <ArrowIcon />
              </Link>
            </div>
          </div>
        </div>

        <div className="hero-footer">
          <div className="schedule" aria-label="Programação semanal">
            <div className="schedule-item">
              <CalendarIcon />
              <div className="schedule-copy">
                <span>Culto Domingo na Casa</span>
                <strong>19h</strong>
              </div>
            </div>
            <div className="schedule-item">
              <CalendarIcon />
              <div className="schedule-copy">
                <span>Culto Quarta de Ensino</span>
                <strong>19h30</strong>
              </div>
            </div>
            <div className="schedule-item">
              <CalendarIcon />
              <div className="schedule-copy">
                <span>Sexta de Oração</span>
                <strong>19h30</strong>
              </div>
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
                Encontre o seu
                <strong>lugar na Casa.</strong>
              </h2>
              <p>
                Para quem está chegando e para quem já vive esta família:
                cada entrada leva você direto ao que precisa.
              </p>
            </div>
          </div>

          <div className="paths-grid">
            <article className="path-card">
              <div className="path-card-topline">
                <span className="path-number">01</span>
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
                <Link
                  className="path-link path-link-primary"
                  href="/visitante"
                >
                  Preencher ficha de visitante
                  <ArrowIcon />
                </Link>
              </div>
            </article>

            <article className="path-card">
              <div className="path-card-topline">
                <span className="path-number">02</span>
                <HomeIcon />
              </div>
              <div className="path-card-copy">
                <p className="path-kicker">Esta é a minha igreja</p>
                <h3>Sou da Casa</h3>
                <p className="path-question">
                  Já faço parte desta família e quero estar por dentro.
                </p>
                <p className="path-description">
                  Acesse seu perfil, sua caminhada e os recursos reservados
                  para a família.
                </p>
              </div>
              <div className="path-actions">
                <Link
                  className="path-link path-link-primary"
                  href="/familia"
                >
                  Entrar na Área da Família
                  <ArrowIcon />
                </Link>
              </div>
            </article>

            <article className="path-card path-card-featured">
              <div className="path-card-topline">
                <span className="path-number">03</span>
                <GenerosityIcon />
              </div>
              <div className="path-card-copy">
                <p className="path-kicker">Semeie com propósito</p>
                <h3>Generosidade</h3>
                <p className="path-question">
                  Contribua com primícias, dízimos e ofertas.
                </p>
                <p className="path-description">
                  Escolha a finalidade e copie a chave PIX oficial com um
                  toque, sem sair desta página.
                </p>
              </div>
              <div
                className="home-pix-actions"
                aria-label="Copiar chaves PIX da Casa Forte"
              >
                <div className="home-pix-option">
                  <span>Oferta de Primícias</span>
                  <strong className="home-pix-key">54 99321-7227</strong>
                  <PixCopyButton
                    pixKey="54993217227"
                    label="Copiar PIX de Primícias"
                    className="home-pix-button"
                  />
                </div>
                <div className="home-pix-option">
                  <span>Dízimos e Ofertas</span>
                  <strong className="home-pix-key">
                    46.534.858/0001-37
                  </strong>
                  <PixCopyButton
                    pixKey="46534858000137"
                    label="Copiar PIX de Dízimos e Ofertas"
                    className="home-pix-button"
                  />
                </div>
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
