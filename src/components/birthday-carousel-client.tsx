"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";

export type BirthdayDay = {
  key: string;
  monthDay: string;
  dateLabel: string;
  weekday: string;
  isToday: boolean;
  people: Array<{
    id: string;
    name: string;
    initials: string;
    photoUrl: string | null;
  }>;
};

export default function BirthdayCarouselClient({
  days,
  variant,
}: {
  days: BirthdayDay[];
  variant: "public" | "family";
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = trackRef.current?.querySelector<HTMLElement>("[data-today='true']");
    today?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
  }, []);

  function move(direction: -1 | 1) {
    trackRef.current?.scrollBy({ left: direction * 280, behavior: "smooth" });
  }

  return (
    <section className={`birthday-carousel birthday-carousel-${variant}`} aria-labelledby={`birthday-carousel-title-${variant}`}>
      <header className="birthday-carousel-heading">
        <div>
          <p className="section-eyebrow"><span aria-hidden="true" />Nossa Família</p>
          <h2 id={`birthday-carousel-title-${variant}`}>Aniversariantes</h2>
          <p>Quatro dias anteriores, hoje e os próximos cinco dias.</p>
        </div>
        <div className="birthday-carousel-controls">
          <button type="button" onClick={() => move(-1)} aria-label="Ver aniversários anteriores">←</button>
          <button type="button" onClick={() => move(1)} aria-label="Ver próximos aniversários">→</button>
        </div>
      </header>

      <div className="birthday-carousel-track" ref={trackRef}>
        {days.map((day) => (
          <article className="birthday-day-card" data-today={day.isToday} key={day.key}>
            <header><span>{day.isToday ? "Hoje" : day.weekday}</span><strong>{day.dateLabel}</strong></header>
            <div className="birthday-day-people">
              {day.people.length === 0 ? <p>Nenhum aniversariante</p> : day.people.map((person) => (
                <div className="birthday-person-mini" key={person.id}>
                  <div className="birthday-person-photo">
                    {person.photoUrl ? <Image src={person.photoUrl} alt={`Foto de ${person.name}`} fill sizes="72px" unoptimized /> : <span aria-hidden="true">{person.initials}</span>}
                  </div>
                  <div><small>{day.isToday ? "Parabéns!" : "Aniversário"}</small><h3>{person.name}</h3></div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
