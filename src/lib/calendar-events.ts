export const CALENDAR_MONTHS = [8, 9, 10, 11, 12] as const;

export const EVENT_CATEGORIES = [
  "Cultos",
  "Ceia e Batismo",
  "Oração",
  "Rede Teens",
  "Mulheres",
  "Homens",
  "Crianças",
  "Seminários",
  "Encontros",
  "Equipes",
  "Natal",
  "Eventos especiais",
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export type EventStatus = "confirmed" | "tentative" | "cancelled";

export type ChurchEvent = {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  category: EventCategory;
  description?: string;
  location?: string;
  status: EventStatus;
  featured?: boolean;
  recurring?: boolean;
  internal?: boolean;
  notes?: string;
  registrationSlug?: string;
  registrationLabel?: string;
};

export const SHOW_INTERNAL_EVENTS = false;

const SPECIAL_EVENTS: ChurchEvent[] = [
  event("encontrao-teens-agosto", "Encontrão Rede Teens", "2026-08-15", "Rede Teens"),
  event("vigilia-agosto", "Vigília de Oração", "2026-08-22", "Oração"),
  event("rede-teens-agosto", "Rede Teens", "2026-08-29", "Rede Teens"),
  event("seminario-intercessao", "Seminário de Intercessão e Oração", "2026-09-05", "Seminários", { status: "tentative" }),
  event("rede-mulheres-setembro", "Rede de Mulheres", "2026-09-11", "Mulheres"),
  event("encontrao-teens-setembro", "Encontrão Rede Teens", "2026-09-12", "Rede Teens"),
  event("rede-homens-setembro", "Rede de Homens", "2026-09-18", "Homens"),
  event("seminario-ekklesia", "Seminário Ekklesia: Um Novo Tempo", "2026-09-19", "Seminários"),
  event("rede-teens-setembro", "Rede Teens", "2026-09-26", "Rede Teens"),
  event("tarde-criancas", "Tarde das Crianças", "2026-10-10", "Crianças"),
  event("encontro-deus-mulheres", "Encontro com Deus de Mulheres", "2026-10-16", "Mulheres", { endDate: "2026-10-18" }),
  event("encontrao-teens-outubro", "Encontrão Rede Teens", "2026-10-17", "Rede Teens", { notes: "Evento coincide com o Encontro com Deus de Mulheres. Aguardar definição pastoral." }),
  event("encontro-deus-homens", "Encontro com Deus de Homens", "2026-10-23", "Homens", { endDate: "2026-10-25" }),
  event("rede-teens-outubro", "Rede Teens", "2026-10-31", "Rede Teens"),
  event("encontro-adolescentes", "Encontro de Adolescentes", "2026-11-13", "Encontros", { endDate: "2026-11-15" }),
  event("nucleo-teens-novembro", "Núcleo Teens", "2026-11-28", "Rede Teens"),
  event("vigilia-novembro", "Vigília de Oração", "2026-11-28", "Oração", { notes: "Início após o Núcleo Teens." }),
  event("jantar-voluntarios", "Jantar de Encerramento dos Voluntários", "2026-12-05", "Equipes", { startTime: "19:00", internal: true }),
  event("festa-teens", "Festa de Encerramento da Rede Teens 2026", "2026-12-12", "Rede Teens"),
  event("seminario-adoracao", "Seminário de Adoração", "2026-12-19", "Seminários", { status: "tentative" }),
  event("cantata-natal", "Culto na Casa e Cantata de Natal", "2026-12-20", "Natal", { startTime: "19:00" }),
  event("culto-virada", "Culto da Virada", "2026-12-31", "Eventos especiais"),
];

function event(
  id: string,
  title: string,
  startDate: string,
  category: EventCategory,
  options: Partial<ChurchEvent> = {},
): ChurchEvent {
  return {
    id,
    title,
    startDate,
    category,
    status: "confirmed",
    featured: true,
    ...options,
  };
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function weekday(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function recurringEvent(
  id: string,
  title: string,
  startDate: string,
  startTime: "19:00" | "19:30",
  category: EventCategory,
): ChurchEvent {
  return {
    id,
    title,
    startDate,
    startTime,
    category,
    status: "confirmed",
    recurring: true,
  };
}

function createRecurringEvents() {
  const events: ChurchEvent[] = [];

  for (const month of CALENDAR_MONTHS) {
    let sundayCount = 0;
    let tuesdayCount = 0;

    for (let day = 1; day <= daysInMonth(2026, month); day += 1) {
      const currentWeekday = weekday(2026, month, day);
      const currentDate = dateKey(2026, month, day);

      if (currentWeekday === 0) {
        sundayCount += 1;

        if (currentDate === "2026-12-20") continue;

        if (sundayCount === 2) {
          const withBaptism = currentDate === "2026-09-13" || currentDate === "2026-12-13";
          const ceiaEvent = recurringEvent(
              `ceia-${currentDate}`,
              withBaptism ? "Batismo nas Águas" : "Culto de Ceia",
              currentDate,
              "19:00",
              "Ceia e Batismo",
            );
          if (withBaptism) {
            ceiaEvent.featured = true;
            ceiaEvent.description = "Você tomou a decisão de seguir Jesus e deseja dar o próximo passo? Participe do Batismo nas Águas durante o Culto de Ceia na Casa.";
            ceiaEvent.registrationSlug = currentDate === "2026-09-13" ? "batismo-setembro-2026" : "batismo-dezembro-2026";
            ceiaEvent.registrationLabel = "Inscrições abertas";
          }
          events.push(ceiaEvent);
        } else {
          events.push(recurringEvent(`culto-${currentDate}`, "Culto na Casa", currentDate, "19:00", "Cultos"));
        }
      }

      if (currentWeekday === 2) {
        tuesdayCount += 1;
        if (tuesdayCount === 1) {
          events.push(recurringEvent(`investimento-${currentDate}`, "Reunião da Equipe de Investimento", currentDate, "19:30", "Equipes"));
        }
        if (tuesdayCount === 2) {
          events.push(recurringEvent(`voluntarios-${currentDate}`, "Reunião de Voluntários e Servos", currentDate, "19:30", "Equipes"));
        }
      }

      if (currentWeekday === 3) {
        events.push(recurringEvent(`quarta-${currentDate}`, "Culto de Quarta na Casa", currentDate, "19:30", "Cultos"));
      }

      if (currentWeekday === 5) {
        events.push(recurringEvent(`oracao-${currentDate}`, "1 Hora de Oração e Intercessão", currentDate, "19:30", "Oração"));
      }
    }
  }

  return events;
}

export const CHURCH_EVENTS = [...createRecurringEvents(), ...SPECIAL_EVENTS]
  .filter((item) => SHOW_INTERNAL_EVENTS || !item.internal)
  .sort(compareEvents);

export function compareEvents(first: ChurchEvent, second: ChurchEvent) {
  return (
    first.startDate.localeCompare(second.startDate) ||
    (first.startTime ?? "99:99").localeCompare(second.startTime ?? "99:99") ||
    first.title.localeCompare(second.title, "pt-BR")
  );
}

export function eventOccursOn(item: ChurchEvent, date: string) {
  return item.startDate <= date && (item.endDate ?? item.startDate) >= date;
}

export function eventsForMonth(month: number, category: EventCategory | "Todos") {
  const prefix = `2026-${String(month).padStart(2, "0")}`;
  return CHURCH_EVENTS.filter((item) => {
    const visibleInMonth = item.startDate.startsWith(prefix) || item.endDate?.startsWith(prefix);
    return visibleInMonth && (category === "Todos" || item.category === category);
  });
}

export function featuredEvents(today: string) {
  return CHURCH_EVENTS.filter(
    (item) =>
      item.featured === true &&
      item.recurring !== true &&
      item.status === "confirmed" &&
      (item.endDate ?? item.startDate) >= today,
  );
}

export function getSaoPauloDateKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseDateParts(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

export function formatEventDate(date: string, options?: Intl.DateTimeFormatOptions) {
  const { year, month, day } = parseDateParts(date);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatEventWeekday(date: string, style: "long" | "short" = "long") {
  const { year, month, day } = parseDateParts(date);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: style,
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatEventPeriod(item: ChurchEvent) {
  if (!item.endDate || item.endDate === item.startDate) return formatEventDate(item.startDate);
  return `${formatEventDate(item.startDate, { day: "numeric", month: "short" })} a ${formatEventDate(item.endDate)}`;
}

export function formatEventTime(item: ChurchEvent) {
  if (!item.startTime) return "Horário a definir";
  const [hour, minute] = item.startTime.split(":");
  const start = minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
  if (!item.endTime) return start;
  const [endHour, endMinute] = item.endTime.split(":");
  const end = endMinute === "00" ? `${Number(endHour)}h` : `${Number(endHour)}h${endMinute}`;
  return `${start} às ${end}`;
}
