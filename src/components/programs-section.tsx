"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { CHURCH_EVENTS, formatEventDate, formatEventWeekday, getSaoPauloDateKey } from "@/lib/calendar-events";

function CalendarIcon() {
  return <svg className="home-calendar-icon" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="4.5" y="7.5" width="23" height="20" rx="4" /><path d="M10 4.5v6M22 4.5v6M4.5 13.5h23" /><path d="M10 18h3M19 18h3M10 23h3M19 23h3" /></svg>;
}

function ArrowIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return <svg aria-hidden="true" className="home-icon" viewBox="0 0 20 20" fill="none" style={direction === "left" ? { transform: "rotate(180deg)" } : undefined}><path d="M4 10h12M11 5l5 5-5 5" /></svg>;
}

export default function ProgramsSection({ mapsUrl }: { mapsUrl: string }) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const events = useMemo(() => {
    const today = getSaoPauloDateKey();
    return CHURCH_EVENTS.filter((event) => event.status !== "cancelled" && (event.endDate ?? event.startDate) >= today).slice(0, 12);
  }, []);

  function moveCarousel(direction: -1 | 1) {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const card = carousel.querySelector<HTMLElement>("article");
    carousel.scrollBy({ left: direction * ((card?.offsetWidth ?? carousel.clientWidth * 0.82) + 14), behavior: "smooth" });
  }

  return (
    <section className="home-block home-programs" aria-labelledby="programs-title">
      <div className="home-section-heading home-section-heading-row">
        <div><p className="home-kicker">Calendário dinâmico</p><h2 id="programs-title">Nossas programações</h2></div>
        <div className="home-program-links">
          <Link href="/calendario">Calendário completo <ArrowIcon /></Link>
          <a href={mapsUrl} target="_blank" rel="noreferrer">Ver localização <ArrowIcon /></a>
        </div>
      </div>

      <div className="home-program-carousel-heading">
        <p>Arraste para o lado e veja os próximos encontros da Casa.</p>
        <div className="home-program-carousel-controls" aria-label="Controles da programação">
          <button type="button" onClick={() => moveCarousel(-1)} aria-label="Programação anterior"><ArrowIcon direction="left" /></button>
          <button type="button" onClick={() => moveCarousel(1)} aria-label="Próxima programação"><ArrowIcon /></button>
        </div>
      </div>

      <div className="home-program-carousel" ref={carouselRef} tabIndex={0} aria-label="Próximas programações da Casa Forte">
        {events.map((event) => (
          <article key={event.id}>
            <div className="home-program-top"><span>{formatEventWeekday(event.startDate)} · {formatEventDate(event.startDate, { day: "2-digit", month: "long" })}</span><CalendarIcon /></div>
            <div className="home-program-body">
              <div><span className="home-program-category">{event.category}</span><h3>{event.title}</h3></div>
              <strong>{event.startTime ?? "Em breve"}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
