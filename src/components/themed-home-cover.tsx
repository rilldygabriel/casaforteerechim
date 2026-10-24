import Image from "next/image";

/** The photograph always comes from model 9; only its outer frame changes. */
export default function ThemedHomeCover() {
  return (
    <div className="home-hero-cover home-cover-model-nine">
      <Image
        src="/images/capas/modelo-09-impact.webp"
        alt="Pastores Rilldy e Lisy ministrando na Igreja Casa Forte"
        fill
        preload
        sizes="(max-width: 760px) 100vw, 70vw"
      />
      <span className="home-cover-theme-frame" aria-hidden="true" />
    </div>
  );
}
