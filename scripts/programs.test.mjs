import assert from "node:assert/strict";
import test from "node:test";
import {
  formatProgramDate,
  getNextProgramDate,
  getNextSundayDate,
} from "../src/lib/programs.ts";

test("calcula o próximo domingo na virada do mês", () => {
  assert.equal(
    getNextSundayDate(new Date("2026-07-30T15:00:00Z")),
    "2026-08-02",
  );
});

test("mantém a programação do próprio dia", () => {
  assert.equal(
    getNextProgramDate(3, new Date("2026-07-29T15:00:00Z")),
    "2026-07-29",
  );
});

test("formata a data do culto em português", () => {
  assert.equal(formatProgramDate("2026-08-02"), "domingo, 2 de agosto");
});
