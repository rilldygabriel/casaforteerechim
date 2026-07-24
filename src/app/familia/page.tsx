import Image from "next/image";
import Link from "next/link";

const GROUP_URL =
  "https://chat.whatsapp.com/Ix3EKdZymHEAhYpgVqUzQG?mode=gi_t";
const PASTOR_URL = "https://wa.me/5554992640253";

export default function Familia() {
  return (
    <main className="inner-page family-page">
      <header className="inner-header">
        <Link href="/" aria-label="Voltar para o início">
          <Image
            src="/images/logo-casa-forte.png"
            alt="Igreja Casa Forte"
            width={180}
            height={70}
          />
        </Link>
        <Link className="inner-back" href="/">
          Voltar ao site
        </Link>
      </header>

      <section className="family-hero">
        <p className="section-eyebrow">
          <span aria-hidden="true" />
          Sou da Casa
        </p>
        <h1>
          Aqui você é
          <strong>família.</strong>
        </h1>
        <p>
          Este é o espaço de quem vive a Casa durante a semana e quer seguir
          crescendo junto.
        </p>
      </section>

      <section className="family-menu" aria-label="Menu da Família Casa Forte">
        <article className="family-menu-card">
          <span>01</span>
          <h2>Minha caminhada</h2>
          <p>Acompanhe seus próximos passos e continue crescendo na fé.</p>
          <a href={GROUP_URL} target="_blank" rel="noreferrer">
            Acessar grupo oficial
          </a>
        </article>
        <article className="family-menu-card">
          <span>02</span>
          <h2>Palavra da semana</h2>
          <p>Mensagens e conteúdos para fortalecer sua vida durante a semana.</p>
          <a
            href="https://youtube.com/@igrejacasaforte-erechim5031"
            target="_blank"
            rel="noreferrer"
          >
            Ver mensagens
          </a>
        </article>
        <article className="family-menu-card">
          <span>03</span>
          <h2>Meu Devocional</h2>
          <p>Um espaço para fortalecer sua fé e caminhar com a Casa.</p>
          <a
            href="https://ig.me/j/AbbdKixwGYdyTwoi/"
            target="_blank"
            rel="noreferrer"
          >
            Acessar canal do Pastor
          </a>
        </article>
        <article className="family-menu-card">
          <span>04</span>
          <h2>Agenda da Casa</h2>
          <p>Domingo às 19h, quarta às 19h30 e sexta às 19h30.</p>
          <Link href="/#proximos-passos">Ver programação</Link>
        </article>
        <article className="family-menu-card">
          <span>05</span>
          <h2>Pedidos de Oração</h2>
          <p>Envie seu pedido e permita que nossa equipe caminhe com você.</p>
          <a
            href={`${PASTOR_URL}?text=Ol%C3%A1%21%20Quero%20enviar%20um%20pedido%20de%20ora%C3%A7%C3%A3o.`}
            target="_blank"
            rel="noreferrer"
          >
            Enviar pedido
          </a>
        </article>
        <article className="family-menu-card">
          <span>06</span>
          <h2>Falar com um Pastor</h2>
          <p>Conte com orientação, cuidado e acompanhamento pastoral.</p>
          <a href={PASTOR_URL} target="_blank" rel="noreferrer">
            Chamar no WhatsApp
          </a>
        </article>
        <article className="family-menu-card family-menu-featured">
          <span>07</span>
          <h2>Generosidade</h2>
          <p>
            Primícias: <strong>54993217227</strong>
            <br />
            Dízimos e ofertas: <strong>46534858000137</strong>
          </p>
        </article>
      </section>
    </main>
  );
}
