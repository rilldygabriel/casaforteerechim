import assert from "node:assert/strict";
import test from "node:test";
import {
  CHURCH_EVENTS,
  formatEventTime,
} from "../src/lib/calendar-events.ts";

test("usa a grafia Ekklesia no seminário", () => {
  assert.equal(CHURCH_EVENTS.some((item) => item.title.includes("Eclesia")), false);
  assert.equal(CHURCH_EVENTS.some((item) => item.title.includes("Ekklesia")), true);
});

test("todas as programações recorrentes possuem horário definido", () => {
  const recurring = CHURCH_EVENTS.filter((item) => item.recurring);
  assert.ok(recurring.length > 0);
  assert.equal(
    recurring.some((item) => formatEventTime(item) === "Horário a definir"),
    false,
  );
});

test("domingos usam 19h e as demais recorrências usam 19h30", () => {
  for (const item of CHURCH_EVENTS.filter((event) => event.recurring)) {
    if (item.title.startsWith("Culto na Casa") || item.title.startsWith("Culto de Ceia")) {
      assert.equal(item.startTime, "19:00");
    } else {
      assert.equal(item.startTime, "19:30");
    }
  }
});

test("as datas mensais de ceia estão corretas", () => {
  const dates = CHURCH_EVENTS.filter((item) => item.category === "Ceia e Batismo").map(
    (item) => item.startDate,
  );
  assert.deepEqual(dates, [
    "2026-08-09",
    "2026-09-13",
    "2026-10-11",
    "2026-11-08",
    "2026-12-13",
  ]);
});

test("reuniões de equipes ocupam a primeira e a segunda terça-feira", () => {
  const investmentDates = CHURCH_EVENTS.filter((item) =>
    item.title.includes("Equipe de Investimento"),
  ).map((item) => item.startDate);
  const volunteerDates = CHURCH_EVENTS.filter((item) =>
    item.title.includes("Voluntários e Servos"),
  ).map((item) => item.startDate);

  assert.deepEqual(investmentDates, ["2026-08-04", "2026-09-01", "2026-10-06", "2026-11-03", "2026-12-01"]);
  assert.deepEqual(volunteerDates, ["2026-08-11", "2026-09-08", "2026-10-13", "2026-11-10", "2026-12-08"]);
});

test("eventos internos e o Encontrão de 14 de novembro não aparecem", () => {
  assert.equal(CHURCH_EVENTS.some((item) => item.id === "jantar-voluntarios"), false);
  assert.equal(CHURCH_EVENTS.some((item) => item.startDate === "2026-11-14" && item.title.includes("Encontrão")), false);
});
