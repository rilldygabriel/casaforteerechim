import Image from "next/image";
import Link from "next/link";
import PrayerForm from "@/components/prayer-form";

export default function Oracao() {
  return (
    <main className="inner-page prayer-page">
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

      <section className="form-layout">
        <div className="form-intro">
          <p className="section-eyebrow">
            <span aria-hidden="true" />
            Preciso de oração
          </p>
          <h1>
            Você não precisa
            <strong>carregar isso sozinho.</strong>
          </h1>
          <p>
            Seu pedido será recebido com cuidado e encaminhado para nossa equipe
            de intercessão.
          </p>
        </div>

        <PrayerForm />
      </section>
    </main>
  );
}
