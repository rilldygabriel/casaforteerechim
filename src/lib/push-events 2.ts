export const PUSH_EVENTS = {
  "domingo-casa": {
    key: "domingo-casa",
    weekday: 0,
    title: "Domingo na Casa",
    time: "19h",
  },
  "quarta-ensino": {
    key: "quarta-ensino",
    weekday: 3,
    title: "Culto Quarta de Ensino",
    time: "19h30",
  },
  "sexta-oracao": {
    key: "sexta-oracao",
    weekday: 5,
    title: "Sexta de Oração",
    time: "19h30",
  },
} as const;

export type PushEventKey = keyof typeof PUSH_EVENTS;

export function getPushEvent(eventKey: string) {
  return PUSH_EVENTS[eventKey as PushEventKey] ?? null;
}
