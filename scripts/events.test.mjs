import assert from "node:assert/strict";
import test from "node:test";
import { eventRegistrationState, normalizePhone, validateEncounterRegistration, validateHamburgerRegistration, validateRegistration } from "../src/lib/events.ts";
import { hasEventAdminAccess } from "../src/lib/event-admin-auth.ts";

test("limita a administração de eventos a membros aprovados com a permissão específica", () => {
  assert.equal(hasEventAdminAccess({ is_admin: false, can_manage_events: true, approval_status: "approved" }), true);
  assert.equal(hasEventAdminAccess({ is_admin: false, can_manage_events: false, approval_status: "approved" }), false);
  assert.equal(hasEventAdminAccess({ is_admin: false, can_manage_events: true, approval_status: "pending" }), false);
  assert.equal(hasEventAdminAccess({ is_admin: true, can_manage_events: false, approval_status: "approved" }), true);
});

test("normaliza telefone brasileiro para impedir duplicidades", () => {
  assert.equal(normalizePhone("+55 (54) 99999-9999"), "54999999999");
  assert.equal(normalizePhone("(54) 99999-9999"), "54999999999");
});

test("exige consentimento e dados válidos", () => {
  assert.match(validateRegistration({ fullName: "Ana Casa Forte", phone: "54999999999", attendanceDuration: "1_to_3_months", notes: "", consent: false }) ?? "", /autorizar/i);
  assert.equal(validateRegistration({ fullName: "Ana Casa Forte", phone: "54999999999", attendanceDuration: "1_to_3_months", notes: "", consent: true }), null);
});

test("valida os três dados da inscrição do Encontro com Deus", () => {
  assert.match(validateEncounterRegistration({ fullName: "Ana Casa Forte", email: "email-invalido", phone: "54999999999" }) ?? "", /e-mail/i);
  assert.equal(validateEncounterRegistration({ fullName: "Ana Casa Forte", email: "ana@example.com", phone: "(54) 99999-9999" }), null);
});

test("valida uma reserva de hambúrgueres simplificada", () => {
  const base = { phone: "(54) 99999-9999", simpleQuantity: 1, doubleQuantity: 2 };
  assert.equal(validateHamburgerRegistration(base), null);
  assert.equal(validateHamburgerRegistration({ simpleQuantity: 2, doubleQuantity: 3, isMember: true }), null);
  assert.match(validateHamburgerRegistration({ simpleQuantity: 1, doubleQuantity: 0 }) ?? "", /telefone/i);
  assert.match(validateHamburgerRegistration({ ...base, simpleQuantity: 0, doubleQuantity: 0 }) ?? "", /pelo menos um/i);
  assert.match(validateHamburgerRegistration({ ...base, simpleQuantity: 60, doubleQuantity: 41 }) ?? "", /máximo 100/i);
});

test("fecha inscrições lotadas, encerradas ou fora do prazo", () => {
  assert.equal(eventRegistrationState({ registration_enabled: true, registration_status: "open", registration_deadline: null, capacity: 20, registration_count: 20 }).label, "Vagas esgotadas");
  assert.equal(eventRegistrationState({ registration_enabled: true, registration_status: "closed", registration_deadline: null, capacity: null }).label, "Inscrições encerradas");
  assert.equal(eventRegistrationState({ registration_enabled: true, registration_status: "open", registration_deadline: "2020-01-01T00:00:00Z", capacity: null }).label, "Prazo encerrado");
});
