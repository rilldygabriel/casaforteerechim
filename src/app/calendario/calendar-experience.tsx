"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CALENDAR_MONTHS,
  EVENT_CATEGORIES,
  type ChurchEvent,
  type EventCategory,
  eventOccursOn,
  eventsForMonth,
  featuredEvents,
  formatEventDate,
  formatEventPeriod,
  formatEventTime,
  parseDateParts,
} from "@/lib/calendar-events";

const MONTH_FORMATTER = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function monthLabel(month: number) {
  return MONTH_FORMATTER.format(new Date(Date.UTC(2026, month - 1, 1)));
}

function initialMonth(today: string) {
  const { year, month } = parseDateParts(today);
  return year === 2026 && CALENDAR_MONTHS.includes(month as (typeof CALENDAR_MONTHS)[number]) ? month : CALENDAR_MONTHS[0];
}

function calendarCells(month: number) {
  const firstWeekday = new Date(Date.UTC(2026, month - 1, 1)).getUTCDay();
  const totalDays = new Date(Date.UTC(2026, month, 0)).getUTCDate();
  return [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: totalDays }, (_, index) => index + 1),
  ];
}

function dateKey(month: number, day: number) {
  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function CalendarExperience({ today }: { today: string }) {
  const [month, setMonth] = useState(() => initialMonth(today));
  const [category, setCategory] = useState<EventCategory | "Todos">("Todos");
  const [selectedEvent, setSelectedEvent] = useState<ChurchEvent | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const monthlyEvents = useMemo(() => eventsForMonth(month, category), [month, category]);
  const specialEvents = useMemo(() => featuredEvents(today), [today]);
  const cells = useMemo(() => calendarCells(month), [month]);
  const nextEventId = specialEvents[0]?.id;
  const monthIndex = CALENDAR_MONTHS.indexOf(month as (typeof CALENDAR_MONTHS)[number]);

  useEffect(() => {
    if (!selectedEvent) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedEvent(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selectedEvent]);

  function moveCarousel(direction: -1 | 1) {
    carouselRef.current?.scrollBy({ left: direction * 360, behavior: "smooth" });
  }

  return (
    <main className="calendar-page">
      <header className="calendar-header">
        <Link href="/" aria-label="Voltar para o início">
          <Image src="/images/logo-casa-forte.png" alt="Igreja Casa Forte" width={180} height={70} priority />
        </Link>
        <Link href="/">Voltar ao site</Link>
      </header>

      <section className="calendar-hero" aria-labelledby="calendar-title">
        <p className="calendar-eyebrow">Agenda 2026</p>
        <h1 id="calendar-title">Calendário <strong>da Casa</strong></h1>
        <p>Confira nossos cultos, encontros e programações especiais.</p>
      </section>

      <section className="calendar-weekly" aria-label="Programação recorrente">
        <article><span>Dom</span><div><strong>Culto na Casa</strong><p>Todos os domingos, às 19h</p></div></article>
        <article><span>Qua</span><div><strong>Culto de Quarta na Casa</strong><p>Toda quarta-feira, às 19h30</p></div></article>
        <article><span>Sex</span><div><strong>1 Hora de Oração e Intercessão</strong><p>Toda sexta-feira, às 19h30</p></div></article>
      </section>

      <section className="calendar-featured" aria-labelledby="featured-title">
        <div className="calendar-section-heading">
          <div><p className="calendar-eyebrow">O que vem por aí</p><h2 id="featured-title">Próximos eventos especiais</h2></div>
          <div className="calendar-carousel-controls">
            <button type="button" onClick={() => moveCarousel(-1)} aria-label="Ver eventos anteriores">←</button>
            <button type="button" onClick={() => moveCarousel(1)} aria-label="Ver próximos eventos">→</button>
          </div>
        </div>
        {specialEvents.length > 0 ? (
          <div className="calendar-carousel" ref={carouselRef} aria-label="Eventos especiais confirmados">
            {specialEvents.map((item) => {
              const { day, month: itemMonth } = parseDateParts(item.startDate);
              return (
                <article className="calendar-feature-card" data-category={item.category} data-next={item.id === nextEventId} key={item.id}>
                  <div className="calendar-feature-visual"><span>{String(day).padStart(2, "0")}</span><small>{monthLabel(itemMonth).split(" ")[0]}</small></div>
                  <div className="calendar-feature-copy">
                    {item.id === nextEventId ? <span className="calendar-next-label">Próximo confirmado</span> : null}
                    <p>{item.category}</p><h3>{item.title}</h3>
                    <strong>{formatEventTime(item)}</strong>
                    <button type="button" onClick={() => setSelectedEvent(item)}>Ver detalhes</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p className="calendar-empty">Nenhum evento especial confirmado neste período.</p>}
      </section>

      <section className="calendar-agenda" aria-labelledby="agenda-title">
        <div className="calendar-section-heading calendar-agenda-heading">
          <div><p className="calendar-eyebrow">Mês a mês</p><h2 id="agenda-title">Agenda completa</h2></div>
          <div className="calendar-month-controls">
            <button type="button" disabled={monthIndex === 0} onClick={() => setMonth(CALENDAR_MONTHS[monthIndex - 1])} aria-label="Mês anterior">←</button>
            <strong aria-live="polite">{monthLabel(month)}</strong>
            <button type="button" disabled={monthIndex === CALENDAR_MONTHS.length - 1} onClick={() => setMonth(CALENDAR_MONTHS[monthIndex + 1])} aria-label="Próximo mês">→</button>
          </div>
        </div>

        <div className="calendar-filters" role="group" aria-label="Filtrar por categoria">
          <button type="button" aria-pressed={category === "Todos"} onClick={() => setCategory("Todos")}>Todos</button>
          {EVENT_CATEGORIES.map((item) => (
            <button type="button" aria-pressed={category === item} onClick={() => setCategory(item)} key={item}>{item}</button>
          ))}
        </div>

        <div className="calendar-grid" aria-label={`Calendário de ${monthLabel(month)}`}>
          {WEEKDAYS.map((day) => <div className="calendar-weekday" key={day}>{day}</div>)}
          {cells.map((day, index) => {
            if (day === null) return <div className="calendar-day calendar-day-empty" aria-hidden="true" key={`empty-${index}`} />;
            const currentDate = dateKey(month, day);
            const dayEvents = monthlyEvents.filter((item) => eventOccursOn(item, currentDate));
            return (
              <div className="calendar-day" data-today={currentDate === today} key={currentDate}>
                <span className="calendar-day-number">{day}</span>
                <div className="calendar-day-events">
                  {dayEvents.map((item) => (
                    <button type="button" data-category={item.category} data-recurring={item.recurring === true} data-status={item.status} onClick={() => setSelectedEvent(item)} key={`${currentDate}-${item.id}`}>
                      <span>{formatEventTime(item)}</span><strong>{item.title}</strong>
                      {item.status === "tentative" ? <small>A confirmar</small> : null}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="calendar-mobile-list" aria-label={`Agenda de ${monthLabel(month)}`}>
          {monthlyEvents.length > 0 ? monthlyEvents.map((item) => (
            <button type="button" className="calendar-list-event" data-category={item.category} data-status={item.status} onClick={() => setSelectedEvent(item)} key={item.id}>
              <time dateTime={item.startDate}><strong>{parseDateParts(item.startDate).day}</strong><span>{monthLabel(month).split(" ")[0]}</span></time>
              <div><span>{item.category}{item.recurring ? " · Recorrente" : ""}</span><h3>{item.title}</h3><p>{formatEventPeriod(item)} · {formatEventTime(item)}</p></div>
              {item.status === "tentative" ? <small>A confirmar</small> : <span aria-hidden="true">→</span>}
            </button>
          )) : <p className="calendar-empty">Nenhum evento nesta categoria durante o mês.</p>}
        </div>
      </section>

      <footer className="calendar-footer"><p>Aqui você é família.</p><Link href="/">Igreja Casa Forte Erechim</Link></footer>

      {selectedEvent ? <EventDetails item={selectedEvent} close={() => setSelectedEvent(null)} closeButtonRef={closeButtonRef} /> : null}
    </main>
  );
}

function EventDetails({ item, close, closeButtonRef }: { item: ChurchEvent; close: () => void; closeButtonRef: React.RefObject<HTMLButtonElement | null> }) {
  return (
    <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="event-detail-title">
        <button className="calendar-modal-close" type="button" onClick={close} ref={closeButtonRef} aria-label="Fechar detalhes">×</button>
        <div className="calendar-modal-accent" data-category={item.category} />
        <p className="calendar-eyebrow">{item.category}</p>
        <h2 id="event-detail-title">{item.title}</h2>
        <dl>
          <div><dt>Data</dt><dd>{formatEventPeriod(item)}</dd></div>
          <div><dt>Dia</dt><dd>{formatEventDate(item.startDate, { weekday: "long" })}</dd></div>
          <div><dt>Horário</dt><dd>{formatEventTime(item)}</dd></div>
          <div><dt>Tipo</dt><dd>{item.recurring ? "Programação recorrente" : "Evento especial"}</dd></div>
          <div><dt>Status</dt><dd>{item.status === "confirmed" ? "Confirmado" : item.status === "tentative" ? "A confirmar" : "Cancelado"}</dd></div>
        </dl>
        {item.description ? <p>{item.description}</p> : null}
        {item.notes ? <aside><strong>Observação</strong><p>{item.notes}</p></aside> : null}
      </section>
    </div>
  );
}
