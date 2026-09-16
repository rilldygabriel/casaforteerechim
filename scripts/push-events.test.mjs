import assert from "node:assert/strict";
import test from "node:test";
import { CHECKIN_EVENTS } from "../src/lib/programs.ts";
import { PUSH_EVENTS } from "../src/lib/push-events.ts";

test("o aviso da Quarta na Casa está configurado para 16h", () => {
  assert.equal(CHECKIN_EVENTS["quarta-ensino"].reminderTime, "16:00");
  assert.equal(PUSH_EVENTS["quarta-ensino"].title, "Quarta na Casa");
  assert.match(PUSH_EVENTS["quarta-ensino"].body, /dia de culto/i);
  assert.match(PUSH_EVENTS["quarta-ensino"].body, /19h30/);
});
