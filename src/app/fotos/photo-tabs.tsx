import Link from "next/link";
import "./photo-tabs.css";

export default function PhotoTabs({ active }: { active: "cultos" | "eventos" }) {
  return <nav className="photo-category-tabs" aria-label="Álbuns de fotos">
    <Link href="/fotos" aria-current={active === "cultos" ? "page" : undefined}>Fotos dos cultos</Link>
    <Link href="/fotos/eventos" aria-current={active === "eventos" ? "page" : undefined}>Fotos de eventos</Link>
  </nav>;
}
