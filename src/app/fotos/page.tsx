import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  LATEST_CULT_ALBUM,
  LATEST_CULT_DATE_LABEL,
  LATEST_CULT_TITLE,
} from "@/lib/cult-album";
import AlbumGallery from "./album-gallery";
import "./album.css";

export const metadata: Metadata = {
  title: "Fotos do culto — 2 de setembro",
  description: "Álbum completo do Culto de Quarta na Casa da Igreja Casa Forte.",
};

export default function PhotosPage() {
  return <main className="cult-album-page">
    <header className="cult-album-header">
      <Link href="/#o-que-esta-rolando"><Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={170} height={66} priority /></Link>
      <Link href="/#o-que-esta-rolando">Voltar ao site</Link>
    </header>
    <section className="cult-album-hero">
      <p><span /> Momentos da Casa</p>
      <h1>Álbum completo</h1>
      <div><strong>{LATEST_CULT_TITLE} · {LATEST_CULT_DATE_LABEL}</strong><span>{LATEST_CULT_ALBUM.length} fotos em alta qualidade</span></div>
      <p>Toque em uma foto para abrir, passar para os lados e baixar o arquivo original.</p>
    </section>
    <AlbumGallery photos={LATEST_CULT_ALBUM} />
  </main>;
}
