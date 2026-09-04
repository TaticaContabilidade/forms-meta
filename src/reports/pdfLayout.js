const PDFDocument = require('pdfkit');

// Paleta base compartilhada entre os relatórios (cada relatório pode somar
// as suas próprias cores de destaque em cima desta).
const BASE_PALETTE = {
  ink: '#171B24',
  inkSoft: '#4B5568',
  inkFaint: '#8891A6',
  ok: '#1E8F5F',
  okBg: '#E4F5EC',
  alert: '#B23A3A',
  alertBg: '#FBEAEA',
  border: '#DCE0E8',
  headerBand: '#171B24',
  headerFaint: '#AEB8CC',
};

const PAGE_MARGIN = 50;
// Espaço, acima da margem inferior, reservado exclusivamente para o rodapé —
// o conteúdo normal nunca entra nessa faixa (ver ensureSpace/drawFooter).
const FOOTER_RESERVE = 34;

function sanitizeForFilename(str) {
  return String(str || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Content-Disposition com suporte a acentos (RFC 5987), com fallback ASCII.
function contentDispositionFilename(filename) {
  const ascii = filename
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

function createReportDocument() {
  return new PDFDocument({
    size: 'A4',
    margins: { top: PAGE_MARGIN, bottom: 60, left: PAGE_MARGIN, right: PAGE_MARGIN },
    bufferPages: true,
  });
}

function ensureSpace(doc, height) {
  const bottom = doc.page.height - doc.page.margins.bottom - FOOTER_RESERVE;
  if (doc.y + height > bottom) {
    doc.addPage();
  }
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

// faixa colorida no topo da primeira página, com selo + título + subtítulo
function drawHeaderBand(doc, { eyebrow, title, subtitle }) {
  const pageWidth = doc.page.width;
  const margin = PAGE_MARGIN;
  const width = pageWidth - margin * 2;

  doc.rect(0, 0, pageWidth, 122).fill(BASE_PALETTE.headerBand);

  doc.fillColor('#C9D6A6').font('Helvetica-Bold').fontSize(9)
    .text(eyebrow, margin, 34, { width, characterSpacing: 0.6 });

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(21)
    .text(title, margin, 50, { width });

  doc.fillColor(BASE_PALETTE.headerFaint).font('Helvetica').fontSize(10.5)
    .text(subtitle, margin, 88, { width });

  doc.y = 148;
}

function sectionTitle(doc, texto, subtitulo) {
  ensureSpace(doc, subtitulo ? 54 : 34);
  doc.fillColor(BASE_PALETTE.ink).font('Helvetica-Bold').fontSize(13.5)
    .text(texto, PAGE_MARGIN, doc.y, { width: contentWidth(doc) });
  if (subtitulo) {
    doc.moveDown(0.15);
    doc.fillColor(BASE_PALETTE.inkSoft).font('Helvetica').fontSize(9.5)
      .text(subtitulo, PAGE_MARGIN, doc.y, { width: contentWidth(doc) });
  }
  doc.moveDown(0.6);
}

function drawCallout(doc, texto, tone) {
  const width = contentWidth(doc);
  const bg = tone === 'alert' ? BASE_PALETTE.alertBg : BASE_PALETTE.okBg;
  const barColor = tone === 'alert' ? BASE_PALETTE.alert : BASE_PALETTE.ok;
  const textColor = tone === 'alert' ? '#7A2323' : '#146443';

  doc.font('Helvetica').fontSize(10);
  const textHeight = doc.heightOfString(texto, { width: width - 32 });
  const boxHeight = textHeight + 24;
  ensureSpace(doc, boxHeight + 12);
  const y = doc.y;

  doc.rect(PAGE_MARGIN, y, width, boxHeight).fill(bg);
  doc.rect(PAGE_MARGIN, y, 4, boxHeight).fill(barColor);
  doc.fillColor(textColor).font('Helvetica').fontSize(10)
    .text(texto, PAGE_MARGIN + 20, y + 12, { width: width - 40 });

  doc.y = y + boxHeight + 16;
}

function drawFooter(doc, pageNumber, totalPages, label) {
  // Importante: o pdfkit dispara uma quebra de página automática se o texto
  // ultrapassar `page.height - margins.bottom`. Por isso o rodapé é desenhado
  // ACIMA dessa linha (dentro da área de conteúdo), dentro da faixa reservada
  // por FOOTER_RESERVE — nunca disputa espaço com o restante do conteúdo.
  const width = contentWidth(doc);
  const maxY = doc.page.height - doc.page.margins.bottom;
  const lineY = maxY - 20;
  const textY = lineY + 9;

  doc.moveTo(PAGE_MARGIN, lineY).lineTo(PAGE_MARGIN + width, lineY)
    .strokeColor(BASE_PALETTE.border).lineWidth(0.5).stroke();

  doc.fillColor(BASE_PALETTE.inkFaint).font('Helvetica').fontSize(8.5)
    .text(label, PAGE_MARGIN, textY, { width: width * 0.7, lineBreak: false });
  doc.text(`Página ${pageNumber} de ${totalPages}`, PAGE_MARGIN + width * 0.7, textY, {
    width: width * 0.3, align: 'right', lineBreak: false,
  });
}

// desenha o rodapé (com numeração) em todas as páginas já bufferizadas e
// finaliza o documento — último passo de qualquer gerador de relatório.
function finalizeReport(doc, footerLabel) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i - range.start + 1, range.count, footerLabel);
  }
  doc.end();
  return doc;
}

module.exports = {
  BASE_PALETTE,
  PAGE_MARGIN,
  FOOTER_RESERVE,
  sanitizeForFilename,
  contentDispositionFilename,
  createReportDocument,
  ensureSpace,
  contentWidth,
  drawHeaderBand,
  sectionTitle,
  drawCallout,
  finalizeReport,
};
