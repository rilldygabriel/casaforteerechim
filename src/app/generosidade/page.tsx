import Image from "next/image";
import Link from "next/link";
import { isMercadoPagoConfigured } from "@/lib/mercado-pago";
import MercadoPagoCheckout from "./mercado-pago-checkout";
import PixCopyOptions from "./pix-copy-options";

export const dynamic = "force-dynamic";

export default function Generosidade() {
  return <main className="inner-page generosity-page">
    <header className="inner-header"><Link href="/" aria-label="Voltar para o início"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={180} height={70} /></Link><Link className="inner-back" href="/familia">Voltar para Sou da Casa</Link></header>
    <section className="generosity-hero"><p className="section-eyebrow"><span aria-hidden="true" />Generosidade</p><h1>Juntos construímos<strong>o que Deus está fazendo.</strong></h1><p>Contribua de forma simples e segura por Pix, cartão ou saldo Mercado Pago.</p></section>
    <MercadoPagoCheckout configured={isMercadoPagoConfigured()} />
    <section className="generosity-manual-pix"><p className="section-eyebrow"><span aria-hidden="true" />Transferência direta</p><h2>Ou copie uma chave Pix</h2></section>
    <PixCopyOptions />
    <p className="pix-security-note">Antes de concluir a transferência, confira os dados do favorecido no seu aplicativo bancário.</p>
  </main>;
}
