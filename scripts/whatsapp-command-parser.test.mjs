import assert from "node:assert/strict";
import test from "node:test";
import { parseCasaCommand, casaDraftPreview } from "../src/lib/whatsapp-command-parser.ts";

test("não executa mensagens comuns do WhatsApp", () => {
  assert.equal(parseCasaCommand("Boa tarde, como faço inscrição?"), null);
  assert.equal(parseCasaCommand("agenda"), null);
});

test("agenda pastoral aceita apenas datas, horas e responsável explícitos", () => {
  assert.deepEqual(parseCasaCommand("CASA AGENDA NOVO 2026-09-20 | 14:00 | 15:00 | os dois | Casa pastores"), {
    type: "draft", draft: { kind: "agenda-publish", date: "2026-09-20", start: "14:00", end: "15:00", host: "Rilldy e Lisi", location: "Casa pastores" },
  });
  assert.equal(parseCasaCommand("CASA AGENDA NOVO 2026-02-30 | 14:00 | 15:00 | Rilldy | Casa")?.type, "invalid");
  assert.equal(parseCasaCommand("CASA AGENDA NOVO 2026-09-20 | 15:00 | 14:00 | Rilldy | Casa")?.type, "invalid");
});

test("evento e aviso ficam em rascunho até confirmação", () => {
  const event = parseCasaCommand("CASA EVENTO Vigília de Oração | 2026-09-20 | 21:00 | Igreja | Uma noite de oração");
  assert.equal(event?.type, "draft");
  assert.equal(event?.draft.kind, "event-create");
  assert.equal(event?.draft.slug, "vigilia-de-oracao");
  const notice = parseCasaCommand("CASA AVISO Culto hoje | Hoje nos vemos às 19h!");
  assert.equal(notice?.type, "draft");
  assert.match(casaDraftPreview(notice.draft, "A1B2C3D4"), /CASA CONFIRMAR A1B2C3D4/);
});

test("confirmação exige código exato de oito caracteres", () => {
  assert.deepEqual(parseCasaCommand("casa confirmar a1b2c3d4"), { type: "confirm", code: "A1B2C3D4" });
  assert.equal(parseCasaCommand("casa confirmar 123")?.type, "invalid");
});
