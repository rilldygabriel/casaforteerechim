import assert from "node:assert/strict";
import test from "node:test";
import { eventRegistrationState, normalizePhone, validateEncounterRegistration, validateHamburgerRegistration, validateRegistration } from "../src/lib/events.ts";
import { canManageEvent, hasEventAdminAccess, hasScopedEventAdminAccess } from "../src/lib/event-admin-auth.ts";
import { summarizeBurgerOrders } from "../src/lib/event-report.ts";
import { createHamburgerEventReportPdf } from "../src/lib/event-report-pdf.ts";
import { parseEventTicketToken } from "../src/lib/event-ticket-token.ts";

test("limita a administração de eventos a membros aprovados com a permissão específica", () => {
  assert.equal(hasEventAdminAccess({ is_admin: false, can_manage_events: true, approval_status: "approved" }), true);
  assert.equal(hasEventAdminAccess({ is_admin: false, can_manage_events: false, approval_status: "approved" }), false);
  assert.equal(hasEventAdminAccess({ is_admin: false, can_manage_events: true, approval_status: "pending" }), false);
  assert.equal(hasEventAdminAccess({ is_admin: true, can_manage_events: false, approval_status: "approved" }), true);
});

test("limita um administrador específico somente ao evento atribuído", () => {
  const profile = { is_admin: false, can_manage_events: false, approval_status: "approved" };
  assert.equal(hasScopedEventAdminAccess(profile, ["evento-hamburguer"]), true);
  assert.equal(canManageEvent(profile, ["evento-hamburguer"], "evento-hamburguer"), true);
  assert.equal(canManageEvent(profile, ["evento-hamburguer"], "outro-evento"), false);
  assert.equal(hasScopedEventAdminAccess({ ...profile, approval_status: "pending" }, ["evento-hamburguer"]), false);
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
  const base = { fullName: "Ana Casa Forte", phone: "(54) 99999-9999", simpleQuantity: 1, doubleQuantity: 2 };
  assert.equal(validateHamburgerRegistration(base), null);
  assert.equal(validateHamburgerRegistration({ fullName: "Ana Casa Forte", simpleQuantity: 2, doubleQuantity: 3, isMember: true }), null);
  assert.match(validateHamburgerRegistration({ fullName: "", simpleQuantity: 1, doubleQuantity: 0, isMember: true }) ?? "", /nome completo/i);
  assert.match(validateHamburgerRegistration({ fullName: "Ana Casa Forte", simpleQuantity: 1, doubleQuantity: 0 }) ?? "", /telefone/i);
  assert.match(validateHamburgerRegistration({ ...base, simpleQuantity: 0, doubleQuantity: 0 }) ?? "", /pelo menos um/i);
  assert.match(validateHamburgerRegistration({ ...base, simpleQuantity: 60, doubleQuantity: 41 }) ?? "", /máximo 100/i);
});

test("extrai o ingresso tanto do QR completo quanto do código manual", () => {
  const token = "6ab3d0ad-1de7-4d36-9ab7-5d7ec1e6f752";
  assert.equal(parseEventTicketToken(token), token);
  assert.equal(parseEventTicketToken(`https://www.casaforteerechim.app.br/ingressos/${token}`), token);
  assert.equal(parseEventTicketToken("codigo-invalido"), "");
});

test("fecha inscrições lotadas, encerradas ou fora do prazo", () => {
  assert.equal(eventRegistrationState({ registration_enabled: true, registration_status: "open", registration_deadline: null, capacity: 20, registration_count: 20 }).label, "Vagas esgotadas");
  assert.equal(eventRegistrationState({ registration_enabled: true, registration_status: "closed", registration_deadline: null, capacity: null }).label, "Inscrições encerradas");
  assert.equal(eventRegistrationState({ registration_enabled: true, registration_status: "open", registration_deadline: "2020-01-01T00:00:00Z", capacity: null }).label, "Prazo encerrado");
});

test("resume somente os pedidos pagos usados no relatório", () => {
  const summary = summarizeBurgerOrders([
    { fullName: "Ana", simpleQuantity: 2, doubleQuantity: 1, grossCents: 7000, netCents: 6930, paymentMethod: "pix" },
    { fullName: "João", simpleQuantity: 0, doubleQuantity: 2, grossCents: 6000, netCents: 5700, paymentMethod: "master" },
  ]);
  assert.deepEqual(summary, { paidOrders: 2, simpleQuantity: 2, doubleQuantity: 3, totalItems: 5, grossCents: 13000, feeCents: 370, netCents: 12630 });
});

test("gera um PDF válido com o resumo do evento", async () => {
  const bytes = await createHamburgerEventReportPdf({
    eventTitle: "Hambúrguer da Casa",
    eventDate: "2026-09-20",
    generatedAt: new Date("2026-09-20T12:00:00Z"),
    orders: [{ fullName: "Ana Casa Forte", simpleQuantity: 2, doubleQuantity: 1, grossCents: 7000, netCents: 6930, paymentMethod: "pix" }],
  });
  assert.equal(Buffer.from(bytes).subarray(0, 4).toString("ascii"), "%PDF");
  assert.ok(bytes.length > 1000);
});
