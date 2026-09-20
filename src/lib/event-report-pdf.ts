import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { paymentMethodLabel, summarizeBurgerOrders, type PaidBurgerOrder } from "./event-report.ts";

type ReportInput = {
  eventTitle: string;
  eventDate: string;
  generatedAt: Date;
  orders: PaidBurgerOrder[];
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 34;
const NAVY = rgb(49 / 255, 56 / 255, 81 / 255);
const INK = rgb(22 / 255, 26 / 255, 36 / 255);
const SLATE = rgb(92 / 255, 99 / 255, 115 / 255);
const ICE = rgb(194 / 255, 203 / 255, 211 / 255);
const PAPER = rgb(246 / 255, 243 / 255, 237 / 255);
const LIME = rgb(208 / 255, 239 / 255, 53 / 255);

function currency(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100).replace(/\u00a0/g, " ");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let clipped = text;
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}...`, size) > maxWidth) clipped = clipped.slice(0, -1);
  return `${clipped.trim()}...`;
}

function drawFooter(page: PDFPage, font: PDFFont, pageNumber: number) {
  page.drawLine({ start: { x: MARGIN, y: 25 }, end: { x: PAGE_WIDTH - MARGIN, y: 25 }, thickness: 0.6, color: ICE });
  page.drawText("Igreja Casa Forte Erechim - relatório administrativo", { x: MARGIN, y: 12, size: 7.5, font, color: SLATE });
  page.drawText(`Página ${pageNumber}`, { x: PAGE_WIDTH - MARGIN - 42, y: 12, size: 7.5, font, color: SLATE });
}

export async function createHamburgerEventReportPdf(input: ReportInput) {
  const summary = summarizeBurgerOrders(input.orders);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let pageNumber = 0;

  function addPage() {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pageNumber += 1;
    page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: PAPER });
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 76, width: PAGE_WIDTH, height: 76, color: NAVY });
    page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 43, width: 23, height: 4, color: LIME });
    page.drawText("CASA FORTE", { x: MARGIN + 32, y: PAGE_HEIGHT - 48, size: 9, font: bold, color: rgb(1, 1, 1) });
    page.drawText(input.eventTitle, { x: MARGIN, y: PAGE_HEIGHT - 66, size: 18, font: bold, color: rgb(1, 1, 1) });
    drawFooter(page, regular, pageNumber);
    return page;
  }

  let page = addPage();
  page.drawText(`Evento: ${dateLabel(input.eventDate)}`, { x: MARGIN, y: 496, size: 9, font: regular, color: SLATE });
  page.drawText(`Gerado em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(input.generatedAt)}`, { x: PAGE_WIDTH - MARGIN - 170, y: 496, size: 8, font: regular, color: SLATE });

  const metrics = [
    ["Pedidos pagos", String(summary.paidOrders)],
    ["Ingressos vendidos", String(summary.totalItems)],
    ["Simples", String(summary.simpleQuantity)],
    ["Duplos", String(summary.doubleQuantity)],
    ["Arrecadado", currency(summary.grossCents)],
    ["Taxas", currency(summary.feeCents)],
  ];
  const metricGap = 8;
  const metricWidth = (PAGE_WIDTH - MARGIN * 2 - metricGap * (metrics.length - 1)) / metrics.length;
  metrics.forEach(([label, value], index) => {
    const x = MARGIN + index * (metricWidth + metricGap);
    page.drawRectangle({ x, y: 425, width: metricWidth, height: 56, color: index % 2 === 0 ? rgb(1, 1, 1) : ICE, borderColor: ICE, borderWidth: 0.7 });
    page.drawText(label.toUpperCase(), { x: x + 10, y: 462, size: 6.5, font: bold, color: SLATE });
    page.drawText(fitText(value, bold, 14, metricWidth - 20), { x: x + 10, y: 439, size: 14, font: bold, color: INK });
  });
  page.drawText(`Líquido recebido: ${currency(summary.netCents)}`, { x: MARGIN, y: 405, size: 9, font: bold, color: NAVY });

  const columns = [
    { label: "Cliente", width: 220 },
    { label: "Simples", width: 55 },
    { label: "Duplos", width: 55 },
    { label: "Itens", width: 48 },
    { label: "Bruto", width: 82 },
    { label: "Taxa", width: 72 },
    { label: "Líquido", width: 82 },
    { label: "Pagamento", width: 95 },
  ];

  function drawTableHeader(target: PDFPage, y: number) {
    target.drawRectangle({ x: MARGIN, y: y - 4, width: columns.reduce((sum, item) => sum + item.width, 0), height: 24, color: NAVY });
    let x = MARGIN;
    for (const column of columns) {
      target.drawText(column.label.toUpperCase(), { x: x + 7, y: y + 4, size: 6.5, font: bold, color: rgb(1, 1, 1) });
      x += column.width;
    }
    return y - 22;
  }

  let y = drawTableHeader(page, 377);
  input.orders.forEach((order, index) => {
    if (y < 52) {
      page = addPage();
      y = drawTableHeader(page, 483);
    }
    if (index % 2 === 0) page.drawRectangle({ x: MARGIN, y: y - 4, width: columns.reduce((sum, item) => sum + item.width, 0), height: 22, color: rgb(1, 1, 1) });
    const fee = Math.max(order.grossCents - order.netCents, 0);
    const values = [order.fullName, String(order.simpleQuantity), String(order.doubleQuantity), String(order.simpleQuantity + order.doubleQuantity), currency(order.grossCents), currency(fee), currency(order.netCents), paymentMethodLabel(order.paymentMethod)];
    let x = MARGIN;
    values.forEach((value, columnIndex) => {
      page.drawText(fitText(value, regular, 7.5, columns[columnIndex].width - 14), { x: x + 7, y: y + 3, size: 7.5, font: regular, color: INK });
      x += columns[columnIndex].width;
    });
    y -= 22;
  });

  if (input.orders.length === 0) page.drawText("Nenhum pagamento aprovado até o momento.", { x: MARGIN + 8, y: y, size: 10, font: regular, color: SLATE });
  return pdf.save();
}
