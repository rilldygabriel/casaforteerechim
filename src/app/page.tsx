import Image from "next/image";
import Link from "next/link";
import PixCopyButton from "@/components/pix-copy-button";
import PrayerForm from "@/components/prayer-form";
import { GALLERY_PHOTOS, getPhotoHref } from "@/lib/gallery";

const WHATSAPP_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Quero%20conhecer%20a%20Igreja%20Casa%20Forte.";
const FIRST_VISIT_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Quero%20ir%20%C3%A0%20Casa%20pela%20primeira%20vez.%20Como%20funciona%3F";
const ACCEPT_JESUS_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Eu%20quero%20aceitar%20Jesus%20e%20preciso%20de%20ajuda%20para%20dar%20meu%20pr%C3%B3ximo%20passo.";
const MAPS_URL = "https://maps.app.goo.gl/wAtHfmS7cFcFP5UC9?g_st=ic";
const YOUTUBE_URL = "https://youtube.com/@igrejacasaforte-erechim5031";
const INSTAGRAM_URL = "https://www.instagram.com/casaforteerechim";
const CASA_MUSIC_URL = "https://youtube.com/@casafortemusic";
const PASTOR_CHANNEL_URL = "https://ig.me/j/AbbdKixwGYdyTwoi/";
const GROUP_URL =
  "https://chat.whatsapp.com/Ix3EKdZymHEAhYpgVqUzQG?mode=gi_t";

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="home-icon"
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
      className="home-icon"
      viewBox="0 0 20 20"
      fill="none"
    >
      <path d="M15.25 8.25c0 3.5-5.25 8-5.25 8s-5.25-4.5-5.25-8a5.25 5.25 0 1 1 10.5 0Z" />
      <circle cx="10" cy="8.25" r="1.75" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="home-icon"
      viewBox="0 0 20 20"
      fill="none"
    >
      <rect x="4.25" y="8.25" width="11.5" height="8" rx="2" />
      <path d="M6.75 8.25V6.5a3.25 3.25 0 0 1 6.5 0v1.75M10 11.5v1.75" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="home-calendar-icon"
      viewBox="0 0 32 32"
      fill="none"
    >
      <rect x="4.5" y="7.5" width="23" height="20" rx="4" />
      <path d="M10 4.5v6M22 4.5v6M4.5 13.5h23" />
      <path d="M10 18h3M19 18h3M10 23h3M19 23h3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg
      aria-hidden="true"
      className="home-play-icon"
      viewBox="0 0 32 32"
      fill="none"
    >
      <circle cx="16" cy="16" r="13" />
      <path d="m13 11 9 5-9 5v-10Z" />
    </svg>
  );
}

const programs = [
  {
    eyebrow: "Domingo",
    title: "Culto Domingo na Casa",
    time: "19h",
  },
  {
    eyebrow: "Quarta-feira",
    title: "Culto Quarta de Ensino",
    time: "19h30",
  },
  {
    eyebrow: "Sexta-feira",
    title: "Sexta de Oração",
    time: "19h30",
  },
];

export default function Home() {
  return (
    <main className="home-page">
      <header className="home-header">
        <Link className="home-brand" href="/" aria-label="Casa Forte — início">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={220}
            height={85}
            priority
          />
        </Link>

        <nav className="home-nav" aria-label="Acesso rápido">
          <a href={MAPS_URL} target="_blank" rel="noreferrer">
            <PinIcon />
            Como chegar
          </a>
          <Link href="/familia">Área de membro</Link>
          <a
            className="home-nav-highlight"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
          >
            Fale conosco
          </a>
          <Link className="home-nav-admin" href="/admin">
            <LockIcon />
            Painel
          </Link>
        </nav>
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero-panel">
          <div className="home-hero-copy">
            <p className="home-kicker">Uma igreja para chamar de Casa</p>
            <h1 id="home-title">
              Você tem um
              <strong>lugar aqui.</strong>
            </h1>
            <p>
              Viva Jesus, construa vínculos e cresça em família. Não ande
              sozinho. Vem pra Casa.
            </p>
            <a
              className="home-inline-link"
              href={FIRST_VISIT_URL}
              target="_blank"
              rel="noreferrer"
            >
              Quero visitar a Casa
              <ArrowIcon />
            </a>
          </div>

          <div className="home-hero-cover">
            <Image
              src="/images/capa-inicial-casaforte.webp"
              alt="Pastores Rilldy e Lisy ministrando na Igreja Casa Forte"
              fill
              priority
              sizes="(max-width: 760px) 100vw, 56vw"
            />
          </div>
        </div>

        <div className="home-entry-grid" aria-label="Escolha seu acesso">
          <Link href="/visitante">
            <span>Quero me conectar</span>
            <strong>Sou visitante</strong>
            <ArrowIcon />
          </Link>
          <Link href="/familia">
            <span>Esta é a minha igreja</span>
            <strong>Sou da Casa</strong>
            <ArrowIcon />
          </Link>
        </div>
      </section>

      <section
        className="home-block home-generosity"
        aria-labelledby="generosity-title"
      >
        <div className="home-section-heading">
          <p className="home-kicker">Semeie com propósito</p>
          <h2 id="generosity-title">Generosidade</h2>
          <p>
            Copie a chave oficial com um toque, sem sair da página inicial.
          </p>
        </div>

        <div className="home-generosity-grid">
          <article>
            <span>01</span>
            <h3>Oferta de Primícias</h3>
            <p>Uma expressão de honra e gratidão pelas primeiras conquistas.</p>
            <strong>54 99321-7227</strong>
            <PixCopyButton
              pixKey="54993217227"
              label="Clique para copiar"
              className="home-copy-button"
            />
          </article>
          <article>
            <span>02</span>
            <h3>Dízimos e Ofertas</h3>
            <p>Sua contribuição sustenta a missão e tudo o que construímos.</p>
            <strong>46.534.858/0001-37</strong>
            <PixCopyButton
              pixKey="46534858000137"
              label="Clique para copiar"
              className="home-copy-button"
            />
          </article>
        </div>
      </section>

      <section
        className="home-block home-programs"
        aria-labelledby="programs-title"
      >
        <div className="home-section-heading home-section-heading-row">
          <div>
            <p className="home-kicker">Toda semana na Casa</p>
            <h2 id="programs-title">Nossas programações</h2>
          </div>
          <a href={MAPS_URL} target="_blank" rel="noreferrer">
            Ver localização
            <ArrowIcon />
          </a>
        </div>

        <div className="home-program-grid">
          {programs.map((program) => (
            <article key={program.title}>
              <div className="home-program-top">
                <span>{program.eyebrow}</span>
                <CalendarIcon />
              </div>
              <div className="home-program-body">
                <h3>{program.title}</h3>
                <strong>{program.time}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="home-block home-moments"
        id="o-que-esta-rolando"
        aria-labelledby="moments-title"
      >
        <div className="home-section-heading home-section-heading-row">
          <div>
            <p className="home-kicker">Vida acontecendo</p>
            <h2 id="moments-title">O que está rolando na Casa</h2>
          </div>
          <p>
            Gente real, comunhão verdadeira e uma família crescendo em Jesus.
          </p>
        </div>

        <div className="home-gallery">
          {GALLERY_PHOTOS.map((photo) => (
            <Link
              className={photo.className}
              href={getPhotoHref(photo.slug)}
              key={photo.slug}
              aria-label={`Abrir foto: ${photo.alt}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 720px) 50vw, 30vw"
              />
            </Link>
          ))}
        </div>
      </section>

      <section
        className="home-block home-message"
        aria-labelledby="message-title"
      >
        <a href={YOUTUBE_URL} target="_blank" rel="noreferrer">
          <Image
            src="/images/oracao.jpg"
            alt="Ministração durante um culto da Igreja Casa Forte"
            fill
            sizes="100vw"
          />
          <div className="home-message-overlay" />
          <div className="home-message-copy">
            <p className="home-kicker">Palavra que transforma</p>
            <h2 id="message-title">Assista à mensagem do último culto</h2>
            <span>
              <PlayIcon />
              Assistir no YouTube
            </span>
          </div>
        </a>
      </section>

      <section
        className="home-block home-connections"
        aria-labelledby="connections-title"
      >
        <article className="home-useful-links">
          <div className="home-section-heading">
            <p className="home-kicker">Tudo em um só lugar</p>
            <h2 id="connections-title">Links úteis da Casa</h2>
            <p>
              Acesse nossos canais, grupos e conteúdos oficiais com segurança.
            </p>
          </div>

          <div className="home-useful-links-grid">
            <a href={GROUP_URL} target="_blank" rel="noreferrer">
              <span>Comunidade</span>
              <strong>Grupo oficial da Casa</strong>
              <ArrowIcon />
            </a>
            <a href={PASTOR_CHANNEL_URL} target="_blank" rel="noreferrer">
              <span>Devocionais</span>
              <strong>Canal do Pastor</strong>
              <ArrowIcon />
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer">
              <span>Instagram</span>
              <strong>@casaforteerechim</strong>
              <ArrowIcon />
            </a>
            <a href={YOUTUBE_URL} target="_blank" rel="noreferrer">
              <span>Mensagens</span>
              <strong>YouTube da Casa</strong>
              <ArrowIcon />
            </a>
            <a href={CASA_MUSIC_URL} target="_blank" rel="noreferrer">
              <span>Louvor</span>
              <strong>Casa Forte Music</strong>
              <ArrowIcon />
            </a>
            <a href={MAPS_URL} target="_blank" rel="noreferrer">
              <span>Localização</span>
              <strong>Como chegar</strong>
              <ArrowIcon />
            </a>
          </div>
        </article>

        <article
          className="home-prayer-card"
          aria-labelledby="home-prayer-title"
        >
          <div className="home-prayer-intro">
            <p className="home-kicker">Nós queremos caminhar com você</p>
            <h2 id="home-prayer-title">Preciso de oração</h2>
            <p>
              Conte o que está acontecendo. Seu pedido será recebido com
              cuidado pela nossa equipe de intercessão.
            </p>
          </div>
          <PrayerForm placement="home" />
        </article>
      </section>

      <section className="home-block home-resources">
        <article className="home-jesus-card">
          <p className="home-kicker">O seu maior passo</p>
          <h2>Quero aceitar Jesus</h2>
          <p>
            Você não precisa caminhar sozinho. Fale com a nossa equipe e
            comece hoje uma nova história.
          </p>
          <a href={ACCEPT_JESUS_URL} target="_blank" rel="noreferrer">
            Quero conversar
            <ArrowIcon />
          </a>
        </article>

        <article className="home-photo-links">
          <p className="home-kicker">Memórias da Casa</p>
          <h2>Últimas fotos</h2>
          <div>
            <Link href={getPhotoHref("culto-casa-cheia")}>
              A Casa reunida
              <ArrowIcon />
            </Link>
            <Link href={getPhotoHref("oracao-no-palco")}>
              Momentos de oração
              <ArrowIcon />
            </Link>
            <Link href={getPhotoHref("recepcao-alegria")}>
              Gente chegando em Casa
              <ArrowIcon />
            </Link>
            <Link href={getPhotoHref("pastores-no-palco")}>
              Pastores da Casa
              <ArrowIcon />
            </Link>
          </div>
        </article>
      </section>

      <section
        className="home-block home-pastors"
        aria-labelledby="pastors-title"
      >
        <div className="home-section-heading">
          <p className="home-kicker">Cuidado pastoral</p>
          <h2 id="pastors-title">Conecte-se com os pastores</h2>
        </div>

        <div className="home-pastor-grid">
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            <Image
              src="/images/pastor-rilldy.jpg"
              alt="Pastor Rilldy Gabriel"
              fill
              sizes="(max-width: 720px) 100vw, 50vw"
            />
            <span>
              <small>Pastor</small>
              Pr. Rilldy Gabriel
            </span>
          </a>
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
            <Image
              src="/images/pastora-lisy.jpg"
              alt="Pastora Lisy"
              fill
              sizes="(max-width: 720px) 100vw, 50vw"
            />
            <span>
              <small>Pastora</small>
              Pra. Lisy
            </span>
          </a>
        </div>
      </section>

      <footer className="home-footer">
        <Image
          src="/images/logo-casa-forte.png"
          alt="Igreja Casa Forte"
          width={180}
          height={70}
        />
        <p>Rua José Reinaldo Angonezze, 319 · Erechim, RS</p>
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">
          Fale conosco
        </a>
        <Link className="home-footer-admin" href="/admin">
          <LockIcon />
          Painel administrativo
        </Link>
      </footer>
    </main>
  );
}
