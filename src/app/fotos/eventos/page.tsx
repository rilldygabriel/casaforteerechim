import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { TARDE_DA_ALEGRIA_ALBUM } from "@/lib/event-album-2026-10-10";
import AlbumGallery from "../album-gallery";
import PhotoTabs from "../photo-tabs";
import "../album.css";

export const metadata: Metadata = {
  title: "Fotos de eventos — Tarde da Alegria",
  description: "Veja as 168 fotos da Tarde da Alegria, realizada em 10 de outubro de 2026 pela Igreja Casa Forte.",
};

export default function EventPhotosPage() {
  return <main className="cult-album-page">
    <header className="cult-album-header">
      <Link href="/#o-que-esta-rolando"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={170} height={66} priority /></Link>
      <Link href="/#o-que-esta-rolando">Voltar ao site</Link>
    </header>
    <PhotoTabs active="eventos" />
    <section className="cult-album-hero">
      <p><span /> Fotos de eventos</p>
      <h1>Tarde da Alegria</h1>
      <div><strong>Kids · 10 de outubro de 2026</strong><span>{TARDE_DA_ALEGRIA_ALBUM.length} fotos em alta qualidade</span></div>
      <p>Um dia de alegria e comunhão com nossas crianças. Toque em uma foto para ampliar, passar para os lados e salvar o original.</p>
    </section>
    <AlbumGallery photos={TARDE_DA_ALEGRIA_ALBUM} title="Tarde da Alegria — 10 de outubro de 2026" />
  </main>;
}
