"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import EventAttendanceButton from "@/components/event-attendance-button";
import { CHURCH_EVENTS, formatEventDate, formatEventTime, formatEventWeekday, getSaoPauloDateKey, parseDateParts } from "@/lib/calendar-events";
import { useEventAttendance } from "@/lib/use-event-attendance";

function ArrowIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return <svg aria-hidden="true" className="home-icon" viewBox="0 0 20 20" fill="none" style={direction === "left" ? { transform: "rotate(180deg)" } : undefined}><path d="M4 10h12M11 5l5 5-5 5" /></svg>;
}

export default function ProgramsSection({ mapsUrl }: { mapsUrl: string }) {
  const carouselRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const attendance = useEventAttendance();
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

  useEffect(() => {
    const carousel = carouselRef.current;
    if (!carousel || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => {
      if (isPausedRef.current) return;

      const card = carousel.querySelector<HTMLElement>("article");
      const distance = (card?.offsetWidth ?? carousel.clientWidth * 0.82) + 14;
      const reachedEnd = carousel.scrollLeft + carousel.clientWidth >= carousel.scrollWidth - distance * 0.45;

      carousel.scrollTo({
        left: reachedEnd ? 0 : carousel.scrollLeft + distance,
        behavior: "smooth",
      });
    }, 4200);

    return () => window.clearInterval(timer);
  }, []);

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

      <div
        className="home-program-carousel"
        ref={carouselRef}
        tabIndex={0}
        aria-label="Próximas programações da Casa Forte"
        onMouseEnter={() => { isPausedRef.current = true; }}
        onMouseLeave={() => { isPausedRef.current = false; }}
        onFocus={() => { isPausedRef.current = true; }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) isPausedRef.current = false;
        }}
        onPointerDown={() => { isPausedRef.current = true; }}
        onPointerUp={() => { isPausedRef.current = false; }}
        onPointerCancel={() => { isPausedRef.current = false; }}
      >
        {events.map((event) => (
          <article className="calendar-feature-card home-program-card" data-category={event.category} data-status={event.status} key={event.id}>
            <div className="calendar-feature-visual">
              <em>{formatEventWeekday(event.startDate, "short")}</em>
              <span>{parseDateParts(event.startDate).day}</span>
              <small>
                {formatEventDate(event.startDate, {
                  day: undefined,
                  month: "long",
                  year: "numeric",
                })}
              </small>
            </div>
            <div className="calendar-feature-copy">
              <p>{event.category}{event.recurring ? " · Recorrente" : ""}</p>
              <h3>{event.title}</h3>
              <strong>{formatEventTime(event)}</strong>
              <div className="calendar-feature-actions">
                <EventAttendanceButton event={event} confirmed={attendance.confirmed.has(event.id)} pending={attendance.pendingKey === event.id} onToggle={attendance.toggleAttendance} />
                <Link href={event.registrationSlug ? `/eventos/${event.registrationSlug}` : "/calendario"}>{event.registrationSlug ? "Quero me inscrever" : "Ver no calendário"}</Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
