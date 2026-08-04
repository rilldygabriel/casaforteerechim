import assert from "node:assert/strict";
import test from "node:test";
import { eventRegistrationState, normalizePhone, validateRegistration } from "../src/lib/events.ts";

test("normaliza telefone brasileiro para impedir duplicidades", () => {
  assert.equal(normalizePhone("+55 (54) 99999-9999"), "54999999999");
  assert.equal(normalizePhone("(54) 99999-9999"), "54999999999");
});

test("exige consentimento e dados válidos", () => {
  assert.match(validateRegistration({ fullName: "Ana Casa Forte", phone: "54999999999", attendanceDuration: "1_to_3_months", notes: "", consent: false }) ?? "", /autorizar/i);
  assert.equal(validateRegistration({ fullName: "Ana Casa Forte", phone: "54999999999", attendanceDuration: "1_to_3_months", notes: "", consent: true }), null);
});

test("fecha inscrições lotadas, encerradas ou fora do prazo", () => {
  assert.equal(eventRegistrationState({ registration_enabled: true, registration_status: "open", registration_deadline: null, capacity: 20, registration_count: 20 }).label, "Vagas esgotadas");
  assert.equal(eventRegistrationState({ registration_enabled: true, registration_status: "closed", registration_deadline: null, capacity: null }).label, "Inscrições encerradas");
  assert.equal(eventRegistrationState({ registration_enabled: true, registration_status: "open", registration_deadline: "2020-01-01T00:00:00Z", capacity: null }).label, "Prazo encerrado");
});
