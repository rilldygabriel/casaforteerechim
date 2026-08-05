"use client";

import { useEffect, useState } from "react";
import { cultPhotoPreview, type CultPhoto } from "@/lib/cult-album";

const PAGE_SIZE = 24;

export default function AlbumGallery({ photos }: { photos: readonly CultPhoto[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const active = activeIndex === null ? null : photos[activeIndex];

  useEffect(() => {
    if (activeIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveIndex(null);
      if (event.key === "ArrowLeft") setActiveIndex((activeIndex - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight") setActiveIndex((activeIndex + 1) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey); };
  }, [activeIndex, photos.length]);

  return <>
    <section className="cult-album-grid" aria-label="Fotos do culto">
      {photos.slice(0, visible).map((photo, index) => <button key={photo.id} type="button" data-orientation={photo.orientation} onClick={() => setActiveIndex(index)} aria-label={`Abrir foto ${index + 1} de ${photos.length}`}>
        <img src={cultPhotoPreview(photo.id, 720)} alt={`Culto de domingo na Casa Forte — foto ${index + 1}`} loading={index < 8 ? "eager" : "lazy"} />
        <span>Foto {index + 1}</span>
      </button>)}
    </section>
    {visible < photos.length ? <button className="cult-album-more" type="button" onClick={() => setVisible((current) => Math.min(current + PAGE_SIZE, photos.length))}>Carregar mais fotos</button> : null}

    {active ? <div className="cult-lightbox" role="dialog" aria-modal="true" aria-label={`Foto ${activeIndex! + 1} de ${photos.length}`} onClick={() => setActiveIndex(null)}>
      <div className="cult-lightbox-toolbar" onClick={(event) => event.stopPropagation()}>
        <span>{activeIndex! + 1} / {photos.length}</span>
        <a href={`/api/fotos/download?id=${encodeURIComponent(active.id)}`} download={active.filename}>Baixar em alta qualidade ↓</a>
        <button type="button" onClick={() => setActiveIndex(null)} aria-label="Fechar foto">×</button>
      </div>
      <button className="cult-lightbox-arrow cult-lightbox-previous" type="button" aria-label="Foto anterior" onClick={(event) => { event.stopPropagation(); setActiveIndex((activeIndex! - 1 + photos.length) % photos.length); }}>‹</button>
      <img src={cultPhotoPreview(active.id, 2200)} alt={`Culto de domingo na Casa Forte — foto ${activeIndex! + 1}`} onClick={(event) => event.stopPropagation()} />
      <button className="cult-lightbox-arrow cult-lightbox-next" type="button" aria-label="Próxima foto" onClick={(event) => { event.stopPropagation(); setActiveIndex((activeIndex! + 1) % photos.length); }}>›</button>
    </div> : null}
  </>;
}
