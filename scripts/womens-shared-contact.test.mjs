import assert from "node:assert/strict";
import test from "node:test";
import { eventContactParticipantKey, WOMENS_ENCOUNTER_SLUG } from "../src/lib/womens-encounter-policy.ts";

test("separates women sharing one phone by participant name", () => {
  assert.notEqual(eventContactParticipantKey(WOMENS_ENCOUNTER_SLUG, "Ana da Silva"), eventContactParticipantKey(WOMENS_ENCOUNTER_SLUG, "Maria da Silva"));
});

test("normalizes case and whitespace to prevent duplicate participant reservations", () => {
  assert.equal(eventContactParticipantKey(WOMENS_ENCOUNTER_SLUG, "  ANA\tVitória  da Silva \n"), "ana vitória da silva");
  assert.equal(eventContactParticipantKey(WOMENS_ENCOUNTER_SLUG, "Ana Vitória da Silva"), "ana vitória da silva");
});

test("preserves phone-only identity for burger and other event checkouts", () => {
  assert.equal(eventContactParticipantKey("hamburguer-da-casa-20-09", "Ana da Silva"), null);
  assert.equal(eventContactParticipantKey("encontro-com-deus-homens-2026", "José da Silva"), null);
});
