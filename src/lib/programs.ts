const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

function saoPauloDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") {
        result[part.type] = part.value;
      }
      return result;
    }, {});

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

export function getNextProgramDate(targetWeekday: number, now = new Date()) {
  const current = saoPauloDateParts(now);
  const date = new Date(Date.UTC(current.year, current.month - 1, current.day));
  const daysUntil = (targetWeekday - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + daysUntil);

  return date.toISOString().slice(0, 10);
}

export function getNextSundayDate(now = new Date()) {
  return getNextProgramDate(0, now);
}

export function formatProgramDate(dateValue: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
