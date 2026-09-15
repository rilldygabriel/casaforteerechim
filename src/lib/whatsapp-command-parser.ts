export type CasaCommandDraft =
  | { kind: "agenda-toggle"; active: boolean }
  | { kind: "agenda-publish"; date: string; start: string; end: string; host: "Rilldy" | "Lisi" | "Rilldy e Lisi"; location: string }
  | { kind: "event-create"; title: string; slug: string; date: string; time: string; location: string; description: string;
      registrationEnabled: boolean; registrationFeeCents: number; imageDraftPath?: string }
  | { kind: "announcement-send"; title: string; body: string };

export type ParsedCasaCommand =
  | { type: "help" }
  | { type: "agenda-list" }
  | { type: "draft"; draft: CasaCommandDraft }
  | { type: "confirm"; code: string }
  | { type: "cancel"; code: string }
  | { type: "invalid"; reason: string }
  | null;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const CODE = /^[A-F0-9]{8}$/;

function slugifyEvent(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function eventFeeCents(value: string) {
  const match = /^VALOR\s+(0|\d{1,5}(?:[,.]\d{2})?)$/i.exec(value.trim());
  if (!match) return null;
  const cents = Math.round(Number(match[1].replace(",", ".")) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 1_000_000 ? cents : null;
}

function validDate(value: string) {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeHost(value: string): "Rilldy" | "Lisi" | "Rilldy e Lisi" | null {
  const host = value.trim().toLowerCase();
  if (host === "rilldy") return "Rilldy";
  if (host === "lisi") return "Lisi";
  if (["rilldy e lisi", "os dois", "ambos"].includes(host)) return "Rilldy e Lisi";
  return null;
}

export function parseCasaCommand(body: string): ParsedCasaCommand {
  if (/^oi[\s,]+casa[.!?\s]*$/i.test(body.trim())) return { type: "help" };
  const match = /^casa(?:\s+([\s\S]+))?$/i.exec(body.trim());
  if (!match) return null;
  const command = (match[1] ?? "ajuda").trim();
  if (/^ajuda$/i.test(command)) return { type: "help" };
  if (/^agenda$/i.test(command)) return { type: "agenda-list" };
  if (/^agenda\s+abrir$/i.test(command)) return { type: "draft", draft: { kind: "agenda-toggle", active: true } };
  if (/^agenda\s+pausar$/i.test(command)) return { type: "draft", draft: { kind: "agenda-toggle", active: false } };

  const confirm = /^confirmar\s+([a-f0-9]{8})$/i.exec(command);
  if (confirm) return { type: "confirm", code: confirm[1].toUpperCase() };
  const cancel = /^cancelar\s+([a-f0-9]{8})$/i.exec(command);
  if (cancel) return { type: "cancel", code: cancel[1].toUpperCase() };

  if (/^agenda\s+novo\s+/i.test(command)) {
    const parts = command.replace(/^agenda\s+novo\s+/i, "").split("|").map((part) => part.trim());
    const [date, start, end, hostText, location] = parts;
    const host = normalizeHost(hostText ?? "");
    if (parts.length !== 5 || !validDate(date) || !TIME.test(start) || !TIME.test(end) || start >= end || !host || !location || location.length > 200) {
      return { type: "invalid", reason: "Use: CASA AGENDA NOVO 2026-09-20 | 14:00 | 15:00 | Rilldy | Local" };
    }
    return { type: "draft", draft: { kind: "agenda-publish", date, start, end, host, location } };
  }

  if (/^evento\s+/i.test(command)) {
    const parts = command.replace(/^evento\s+/i, "").split("|").map((part) => part.trim());
    const [title, date, time, location, description, registrationText, feeText] = parts;
    const baseSlug = slugifyEvent(title ?? "");
    const registrationEnabled = /^INSCRICAO\s+SIM$/i.test(registrationText ?? "");
    const feeCents = parts.length === 7 ? eventFeeCents(feeText ?? "") : 0;
    const validRegistration = parts.length === 5 || (parts.length === 7 &&
      /^(INSCRICAO\s+SIM|INSCRICAO\s+NAO)$/i.test(registrationText ?? "") && feeCents !== null &&
      (registrationEnabled || feeCents === 0));
    if (!validRegistration || !title || title.length < 3 || title.length > 160 || !baseSlug || !validDate(date) || !TIME.test(time) || !location || location.length > 200 || !description || description.length > 2000) {
      return { type: "invalid", reason: "Use: CASA EVENTO Título | 2026-09-20 | 19:00 | Local | Descrição | INSCRICAO SIM | VALOR 0" };
    }
    const slug = `${baseSlug}-${date}`;
    return { type: "draft", draft: { kind: "event-create", title, slug, date, time, location, description,
      registrationEnabled, registrationFeeCents: feeCents ?? 0 } };
  }

  if (/^aviso\s+/i.test(command)) {
    const parts = command.replace(/^aviso\s+/i, "").split("|").map((part) => part.trim());
    const [title, message] = parts;
    if (parts.length !== 2 || !title || title.length < 3 || title.length > 100 || !message || message.length < 3 || message.length > 900) {
      return { type: "invalid", reason: "Use: CASA AVISO Título | Texto da mensagem (até 900 caracteres)" };
    }
    return { type: "draft", draft: { kind: "announcement-send", title, body: message } };
  }

  return { type: "invalid", reason: "Comando não reconhecido. Envie CASA AJUDA para ver as opções." };
}

export function isExplicitCasaCommand(body: string) {
  const value = body.trim();
  return (/^oi[\s,]+casa[.!?\s]*$/i.test(value) ||
    /^casa\s+(?:ajuda|agenda|evento|aviso|confirmar|cancelar)\b/i.test(value)) &&
    Boolean(parseCasaCommand(value));
}

export function casaCommandHelp() {
  return [
    "Painel da Casa via WhatsApp (somente Pastor Rilldy):",
    "Oi casa — abrir este menu",
    "Você também pode conversar comigo por texto ou áudio, sem decorar comandos.",
    "CASA AGENDA — horários livres",
    "CASA AGENDA ABRIR ou CASA AGENDA PAUSAR",
    "CASA AGENDA NOVO 2026-09-20 | 14:00 | 15:00 | Rilldy | Local",
    "CASA EVENTO Título | 2026-09-20 | 19:00 | Local | Descrição | INSCRICAO SIM | VALOR 0",
    "Para capa, envie a foto antes do pedido. Ela fica privada até você confirmar o evento.",
    "CASA AVISO Título | Mensagem para todos",
    "Agenda, eventos com/sem inscrição e avisos geram uma prévia. Depois envie CASA CONFIRMAR CÓDIGO (ou CASA CANCELAR CÓDIGO).",
    "Outras alterações do site ainda não são publicadas automaticamente por este WhatsApp.",
  ].join("\n");
}

export function casaDraftPreview(draft: CasaCommandDraft, code: string) {
  if (!CODE.test(code)) throw new Error("Código de confirmação inválido.");
  let detail: string;
  if (draft.kind === "agenda-toggle") detail = draft.active ? "Reabrir reservas da Agenda Pastoral" : "Pausar novas reservas da Agenda Pastoral";
  else if (draft.kind === "agenda-publish") detail = `Publicar horário: ${draft.date}, ${draft.start}–${draft.end}, ${draft.host}, ${draft.location}`;
  else if (draft.kind === "event-create") detail = `Criar evento público: ${draft.title}, ${draft.date} às ${draft.time}, ${draft.location}. ${draft.description}. Inscrição: ${draft.registrationEnabled ? `aberta${draft.registrationFeeCents ? `, R$ ${(draft.registrationFeeCents / 100).toFixed(2).replace(".", ",")}` : ", gratuita"}` : "fechada"}. Capa: ${draft.imageDraftPath ? "foto enviada no WhatsApp" : "sem foto"}.`;
  else detail = `Publicar aviso no site e enviar pelo WhatsApp oficial para todos os cadastrados: ${draft.title} — ${draft.body}`;
  return `Prévia — ${detail}\n\nSe estiver correto, envie CASA CONFIRMAR ${code}. Para desistir, CASA CANCELAR ${code}. Código válido por 10 minutos.`;
}
