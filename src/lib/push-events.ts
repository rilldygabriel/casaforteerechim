export const PUSH_EVENTS = {
  "domingo-casa": {
    key: "domingo-casa",
    weekday: 0,
    title: "Domingo na Casa",
    time: "19h",
    body: "Hoje tem Domingo na Casa às 19h. Não ande sozinho. Vem pra casa!",
  },
  "quarta-ensino": {
    key: "quarta-ensino",
    weekday: 3,
    title: "Quarta na Casa",
    time: "19h30",
    body: "Quarta na Casa — dia de culto. Hoje, às 19h30. Esperamos você!",
  },
  "sexta-oracao": {
    key: "sexta-oracao",
    weekday: 5,
    title: "Sexta de Oração",
    time: "19h30",
    body: "Hoje tem Sexta de Oração às 19h30. Não ande sozinho. Vem pra casa!",
  },
} as const;

export type PushEventKey = keyof typeof PUSH_EVENTS;

export function getPushEvent(eventKey: string) {
  return PUSH_EVENTS[eventKey as PushEventKey] ?? null;
}
