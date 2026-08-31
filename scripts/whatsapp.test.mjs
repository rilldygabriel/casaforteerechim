import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWhatsappTemplateParameter } from "../src/lib/whatsapp.ts";

test("normaliza parâmetros de modelo recusados pela Meta", () => {
  assert.equal(
    sanitizeWhatsappTemplateParameter("Nova contribuição\n\nValor:\t R$ 10,00     Pix"),
    "Nova contribuição Valor: R$ 10,00 Pix",
  );
});

test("limita o parâmetro ao tamanho aceito pelo modelo", () => {
  assert.equal(sanitizeWhatsappTemplateParameter("a".repeat(950)).length, 900);
});
