import Image from "next/image";
import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";
import BirthdayCarousel from "@/components/birthday-carousel";
import PixCopyButton from "@/components/pix-copy-button";
import ProgramsSection from "@/components/programs-section";
import VerseOfDayCard from "@/components/verse-of-day-card";
import TestimonialsSection from "@/components/testimonials-section";
import { GALLERY_PHOTOS } from "@/lib/gallery";

// Mantém as datas das próximas programações atualizadas sem exigir um novo deploy.
export const revalidate = 300;

const WHATSAPP_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Quero%20conhecer%20a%20Igreja%20Casa%20Forte.";
const FIRST_VISIT_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Quero%20ir%20%C3%A0%20Casa%20pela%20primeira%20vez.%20Como%20funciona%3F";
const ACCEPT_JESUS_URL =
  "https://wa.me/5554992640253?text=Ol%C3%A1%21%20Eu%20quero%20aceitar%20Jesus%20e%20preciso%20de%20ajuda%20para%20dar%20meu%20pr%C3%B3ximo%20passo.";
const MAPS_URL = "https://maps.app.goo.gl/wAtHfmS7cFcFP5UC9?g_st=ic";
const YOUTUBE_URL = "https://youtube.com/@igrejacasaforte-erechim5031";
// Este destaque sempre usa o vídeo publicado somente como Palavra, não o culto completo.
const LATEST_MESSAGE_TITLE = "QUEBRANDO O CICLO DE DESORDEM";
const LATEST_MESSAGE_URL = "https://www.youtube.com/watch?v=DiKZr0vYXA4";
const LATEST_MESSAGE_EMBED_URL =
  "https://www.youtube-nocookie.com/embed/DiKZr0vYXA4?rel=0";
const INSTAGRAM_URL = "https://www.instagram.com/casaforteerechim";
const CASA_MUSIC_URL = "https://youtube.com/@casafortemusic";
const PASTOR_CHANNEL_URL = "https://ig.me/j/AbbdKixwGYdyTwoi/";
const GROUP_URL =
  "https://chat.whatsapp.com/Ix3EKdZymHEAhYpgVqUzQG?mode=gi_t";
const PHOTO_ARCHIVE_FOLDERS = [
  {
    date: "09/08",
    title: "Culto de Domingo",
    url: "/fotos",
  },
  {
    date: "02/08",
    title: "Culto de Domingo",
    url: "https://drive.google.com/drive/folders/1IGnUA1xfrI6j1SJnWWElMblnN6wwmABQ",
  },
  {
    date: "26/07",
    title: "Culto de Domingo",
    url: "https://drive.google.com/drive/folders/1TInw-3LUzBaKKEUJ5V_60rJbYmCCIUEo",
  },
  {
    date: "25/07",
    title: "Núcleo Teens",
    url: "https://drive.google.com/drive/folders/1ns8EApdh8IAYqlu-MHMk5w2YgKlae_hl",
  },
  {
    date: "19/07",
    title: "Culto de Domingo",
    url: "https://drive.google.com/drive/folders/1yzaEqUTo51ujr6KShIY2KjOgglW5WDd_",
  },
  {
    date: "12/07",
    title: "Culto de Domingo",
    url: "https://drive.google.com/drive/folders/1DsX2nr2E6Y9qKmTQkDYCuF87XpOWdk7m",
  },
  {
    date: "05/07",
    title: "Culto de Domingo",
    url: "https://drive.google.com/drive/folders/1I5W-WPtTQtw8NIwfrUi2omDQUCwSsh23",
  },
  {
    date: "01/07",
    title: "Culto de Quarta",
    url: "https://drive.google.com/drive/folders/1-fH9xXpUwmSMueDmlhB1uD0-PtGAJOaZ",
  },
] as const;
const PASTOR_RILLDY_WHATSAPP_URL =
  "https://wa.me/5554993217227?text=Ol%C3%A1%2C%20Pastor%20Rilldy%21";
const PASTORA_LISI_WHATSAPP_URL =
  "https://wa.me/5554991619014?text=Ol%C3%A1%2C%20Pastora%20Lisi%21";
const PASTORA_PAMELA_WHATSAPP_URL =
  "https://wa.me/5554999468565?text=Ol%C3%A1%2C%20Pastora%20Pamela%21";
const PASTOR_HERRISON_WHATSAPP_URL =
  "https://wa.me/5554999468558?text=Ol%C3%A1%2C%20Pastor%20Herrison%21";
const PASTORA_ELI_WHATSAPP_URL =
  "https://wa.me/5554991460455?text=Ol%C3%A1%2C%20Pastora%20Eli%21";
const PASTOR_AIRTON_WHATSAPP_URL =
  "https://wa.me/5554999897786?text=Ol%C3%A1%2C%20Pastor%20Airton%21";

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
          <ThemeToggle />
          <Link className="home-nav-filled" href="/familia">
            Área de membro
          </Link>
          <Link className="home-nav-light" href="/eventos">
            Inscrições
          </Link>
          <a
            className="home-nav-light"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
          >
            Fale conosco
          </a>
          <Link className="home-nav-filled" href="/admin">
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

      <ProgramsSection mapsUrl={MAPS_URL} />

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

      <VerseOfDayCard />

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
              href="/fotos"
              key={photo.slug}
              aria-label={`Abrir foto: ${photo.alt}`}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 760px) 25vw, (max-width: 1000px) 25vw, 20vw"
              />
            </Link>
          ))}
        </div>
        <Link
          className="home-gallery-download"
          href="/fotos"
        >
          Ver todas as fotos e baixar em alta qualidade
          <ArrowIcon />
        </Link>
      </section>

      <section
        className="home-block home-message"
        aria-labelledby="message-title"
      >
        <div className="home-message-copy">
          <p className="home-kicker">Palavra que transforma</p>
          <h2 id="message-title">Assista à última Palavra da Casa</h2>
          <p>{LATEST_MESSAGE_TITLE}</p>
          <a href={LATEST_MESSAGE_URL} target="_blank" rel="noreferrer">
            Abrir no YouTube
            <ArrowIcon />
          </a>
        </div>
        <div className="home-message-player">
          <iframe
            src={LATEST_MESSAGE_EMBED_URL}
            title={LATEST_MESSAGE_TITLE}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
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
            <Link href="/biblia">
              <span>Palavra</span>
              <strong>Bíblia Sagrada</strong>
              <ArrowIcon />
            </Link>
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
            <Link className="home-prayer-cta" href="/oracao">
              Preciso de oração
              <ArrowIcon />
            </Link>
          </div>
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
            {PHOTO_ARCHIVE_FOLDERS.map((folder) => (
              <a
                href={folder.url}
                key={folder.url}
                target="_blank"
                rel="noreferrer"
              >
                {folder.date} · {folder.title}
                <ArrowIcon />
              </a>
            ))}
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

        <div className="home-pastor-grid home-pastor-grid-featured">
          <a
            href={PASTOR_RILLDY_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Image
              src="/images/pastor-rilldy.jpg"
              alt="Pastor Rilldy"
              fill
              sizes="(max-width: 720px) 50vw, 50vw"
            />
            <span>
              <small>Pastor</small>
              <strong>Pr. Rilldy</strong>
              <em>WhatsApp</em>
            </span>
          </a>
          <a
            href={PASTORA_LISI_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
          >
            <Image
              src="/images/pastora-lisy.jpg"
              alt="Pastora Lisi"
              fill
              sizes="(max-width: 720px) 50vw, 50vw"
            />
            <span>
              <small>Pastora</small>
              <strong>Pra. Lisi</strong>
              <em>WhatsApp</em>
            </span>
          </a>
        </div>

        <div
          className="home-pastor-grid home-pastor-grid-team"
          aria-label="Equipe pastoral"
        >
          <article className="home-pastor-card">
            <Image
              src="/images/pastores/pastora-pamela.webp"
              alt="Pastora Pamela"
              fill
              sizes="(max-width: 720px) 50vw, 25vw"
            />
            <span>
              <small>Pastora</small>
              <strong>Pra. Pamela</strong>
              <a
                href={PASTORA_PAMELA_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Falar com a Pastora Pamela pelo WhatsApp"
              >
                WhatsApp
              </a>
            </span>
          </article>
          <article className="home-pastor-card">
            <Image
              src="/images/pastores/pastor-erisson.webp"
              alt="Pastor Herrison"
              fill
              sizes="(max-width: 720px) 50vw, 25vw"
            />
            <span>
              <small>Pastor</small>
              <strong>Pr. Herrison</strong>
              <a
                href={PASTOR_HERRISON_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Falar com o Pastor Herrison pelo WhatsApp"
              >
                WhatsApp
              </a>
            </span>
          </article>
          <article className="home-pastor-card">
            <Image
              src="/images/pastores/pastora-eli.webp"
              alt="Pastora Eli"
              fill
              sizes="(max-width: 720px) 50vw, 25vw"
            />
            <span>
              <small>Pastora</small>
              <strong>Pra. Eli</strong>
              <a
                href={PASTORA_ELI_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Falar com a Pastora Eli pelo WhatsApp"
              >
                WhatsApp
              </a>
            </span>
          </article>
          <article className="home-pastor-card">
            <Image
              src="/images/pastores/pastor-airton.webp"
              alt="Pastor Airton"
              fill
              sizes="(max-width: 720px) 50vw, 25vw"
            />
            <span>
              <small>Pastor</small>
              <strong>Pr. Airton</strong>
              <a
                href={PASTOR_AIRTON_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="Falar com o Pastor Airton pelo WhatsApp"
              >
                WhatsApp
              </a>
            </span>
          </article>
        </div>
      </section>

      <TestimonialsSection />

      <BirthdayCarousel variant="public" />

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
