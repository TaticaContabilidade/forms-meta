const PDFDocument = require('pdfkit');

const PALETTE = {
  ink: '#171B24',
  inkSoft: '#4B5568',
  inkFaint: '#8891A6',
  primary: '#4B8B1E',
  primaryDark: '#2F5A12',
  primaryBg: '#EEF7DF',
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

function fmtBRL(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtPct(n) {
  return `${(Number(n) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function fmtQtd(n, unidade) {
  const v = Number(n) || 0;
  const casas = Number.isInteger(v) ? 0 : 1;
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })} ${unidade}`;
}

function sanitizeForFilename(str) {
  return String(str || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// nome do arquivo pedido: "${empresa} meta comercial.pdf"
function metaComercialFilename(empresa) {
  const nomeEmpresa = sanitizeForFilename(empresa);
  const base = nomeEmpresa ? `${nomeEmpresa} meta comercial` : 'Meta comercial';
  return `${base}.pdf`;
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

function ensureSpace(doc, height) {
  const bottom = doc.page.height - doc.page.margins.bottom - FOOTER_RESERVE;
  if (doc.y + height > bottom) {
    doc.addPage();
  }
}

function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function drawHeader(doc, data) {
  const pageWidth = doc.page.width;
  const margin = PAGE_MARGIN;
  const width = pageWidth - margin * 2;

  doc.rect(0, 0, pageWidth, 122).fill(PALETTE.headerBand);

  doc.fillColor('#C9D6A6').font('Helvetica-Bold').fontSize(9)
    .text('RELATÓRIO · EXERCÍCIO PRÁTICO DE TREINAMENTO COMERCIAL', margin, 34, {
      width, characterSpacing: 0.6,
    });

  const titulo = data.empresa ? `Meta comercial — ${data.empresa}` : 'Meta comercial';
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(21)
    .text(titulo, margin, 50, { width });

  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  const preparadoPara = data.nome_participante
    ? `Preparado para ${data.nome_participante} · ${dataFormatada}`
    : `Gerado em ${dataFormatada}`;
  doc.fillColor(PALETTE.headerFaint).font('Helvetica').fontSize(10.5)
    .text(preparadoPara, margin, 88, { width });

  doc.y = 148;
}

function sectionTitle(doc, texto, subtitulo) {
  ensureSpace(doc, subtitulo ? 54 : 34);
  doc.fillColor(PALETTE.ink).font('Helvetica-Bold').fontSize(13.5)
    .text(texto, PAGE_MARGIN, doc.y, { width: contentWidth(doc) });
  if (subtitulo) {
    doc.moveDown(0.15);
    doc.fillColor(PALETTE.inkSoft).font('Helvetica').fontSize(9.5)
      .text(subtitulo, PAGE_MARGIN, doc.y, { width: contentWidth(doc) });
  }
  doc.moveDown(0.6);
}

// grade de estatísticas em destaque (cards)
function drawStatCards(doc, items) {
  const width = contentWidth(doc);
  const gap = 12;
  const cardWidth = (width - gap * (items.length - 1)) / items.length;
  const cardHeight = 62;
  ensureSpace(doc, cardHeight + 10);
  const startY = doc.y;
  const startX = PAGE_MARGIN;

  items.forEach((item, i) => {
    const x = startX + i * (cardWidth + gap);
    doc.roundedRect(x, startY, cardWidth, cardHeight, 6)
      .fillAndStroke(item.destaque ? PALETTE.primaryBg : '#F6F7FA', PALETTE.border);
    doc.fillColor(PALETTE.inkFaint).font('Helvetica-Bold').fontSize(8)
      .text(item.label.toUpperCase(), x + 12, startY + 12, { width: cardWidth - 24, characterSpacing: 0.4 });
    doc.fillColor(item.destaque ? PALETTE.primaryDark : PALETTE.ink)
      .font('Helvetica-Bold').fontSize(item.destaque ? 19 : 15)
      .text(item.value, x + 12, startY + 30, { width: cardWidth - 24 });
  });

  doc.y = startY + cardHeight + 18;
}

// lista de linhas "rótulo ........ valor"
function drawFactList(doc, items) {
  const width = contentWidth(doc);
  items.forEach((item) => {
    const rowHeight = 24;
    ensureSpace(doc, rowHeight);
    const y = doc.y;

    doc.fillColor(PALETTE.inkSoft).font('Helvetica').fontSize(10.5)
      .text(item.label, PAGE_MARGIN, y, { width: width * 0.62 });

    doc.fillColor(item.destaque ? PALETTE.primaryDark : PALETTE.ink)
      .font(item.destaque ? 'Helvetica-Bold' : 'Helvetica').fontSize(10.5)
      .text(item.value, PAGE_MARGIN + width * 0.6, y, { width: width * 0.4, align: 'right' });

    doc.y = y + rowHeight;
    doc.moveTo(PAGE_MARGIN, doc.y - 6).lineTo(PAGE_MARGIN + width, doc.y - 6)
      .strokeColor(PALETTE.border).lineWidth(0.5).stroke();
  });
  doc.moveDown(0.4);
}

function drawCallout(doc, texto, tone) {
  const width = contentWidth(doc);
  const bg = tone === 'alert' ? PALETTE.alertBg : PALETTE.okBg;
  const barColor = tone === 'alert' ? PALETTE.alert : PALETTE.ok;
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

function drawTeamTable(doc, equipe, metaMensal) {
  const width = contentWidth(doc);
  const colNome = width * 0.42;
  const colPapel = width * 0.24;
  const colMeta = width * 0.34;
  const rowPad = 8;

  ensureSpace(doc, 30);
  const headerY = doc.y;
  doc.rect(PAGE_MARGIN, headerY, width, 26).fill(PALETTE.ink);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
  doc.text('NOME', PAGE_MARGIN + 12, headerY + 8, { width: colNome - 12 });
  doc.text('PAPEL', PAGE_MARGIN + colNome, headerY + 8, { width: colPapel });
  doc.text('META MENSAL', PAGE_MARGIN + colNome + colPapel, headerY + 8, {
    width: colMeta - 12, align: 'right',
  });
  doc.y = headerY + 26;

  let soma = 0;
  equipe.forEach((pessoa, i) => {
    const nome = pessoa.nome || `Pessoa ${i + 1}`;
    const tipo = pessoa.tipo || '—';
    const meta = Number(pessoa.meta) || 0;
    soma += meta;

    doc.font('Helvetica').fontSize(10);
    const rowHeight = Math.max(24, doc.heightOfString(nome, { width: colNome - 12 }) + rowPad * 2);
    ensureSpace(doc, rowHeight);
    const y = doc.y;

    if (i % 2 === 1) {
      doc.rect(PAGE_MARGIN, y, width, rowHeight).fill('#F6F7FA');
    }

    doc.fillColor(PALETTE.ink).font('Helvetica').fontSize(10)
      .text(nome, PAGE_MARGIN + 12, y + rowPad, { width: colNome - 12 });
    doc.fillColor(PALETTE.inkSoft)
      .text(tipo, PAGE_MARGIN + colNome, y + rowPad, { width: colPapel });
    doc.fillColor(PALETTE.ink).font('Helvetica-Bold')
      .text(fmtBRL(meta), PAGE_MARGIN + colNome + colPapel, y + rowPad, {
        width: colMeta - 12, align: 'right',
      });

    doc.y = y + rowHeight;
    doc.moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + width, doc.y)
      .strokeColor(PALETTE.border).lineWidth(0.5).stroke();
  });

  // total
  ensureSpace(doc, 28);
  const totalY = doc.y + 4;
  doc.fillColor(PALETTE.ink).font('Helvetica-Bold').fontSize(10.5)
    .text('Total distribuído', PAGE_MARGIN + 12, totalY, { width: colNome + colPapel - 12 });
  doc.text(fmtBRL(soma), PAGE_MARGIN + colNome + colPapel, totalY, {
    width: colMeta - 12, align: 'right',
  });
  doc.y = totalY + 24;

  const diff = metaMensal - soma;
  let statusTexto;
  let tone;
  if (equipe.length === 0 || metaMensal === 0) {
    return;
  } else if (Math.abs(diff) < 1) {
    statusTexto = `Fecha: ${fmtBRL(soma)} de ${fmtBRL(metaMensal)} distribuídos entre a equipe.`;
    tone = 'ok';
  } else if (diff > 0) {
    statusTexto = `Falta distribuir ${fmtBRL(diff)} para fechar a meta mensal da área (${fmtBRL(metaMensal)}).`;
    tone = 'alert';
  } else {
    statusTexto = `A soma das metas individuais está ${fmtBRL(Math.abs(diff))} acima da meta mensal da área (${fmtBRL(metaMensal)}).`;
    tone = 'alert';
  }
  drawCallout(doc, statusTexto, tone);
}

function drawFooter(doc, pageNumber, totalPages) {
  // Importante: o pdfkit dispara uma quebra de página automática se o texto
  // ultrapassar `page.height - margins.bottom`. Por isso o rodapé é desenhado
  // ACIMA dessa linha (dentro da área de conteúdo), dentro da faixa reservada
  // por FOOTER_RESERVE — nunca disputa espaço com o restante do conteúdo.
  const width = contentWidth(doc);
  const maxY = doc.page.height - doc.page.margins.bottom;
  const lineY = maxY - 20;
  const textY = lineY + 9;

  doc.moveTo(PAGE_MARGIN, lineY).lineTo(PAGE_MARGIN + width, lineY)
    .strokeColor(PALETTE.border).lineWidth(0.5).stroke();

  doc.fillColor(PALETTE.inkFaint).font('Helvetica').fontSize(8.5)
    .text('Gerado automaticamente pela calculadora de meta comercial', PAGE_MARGIN, textY, {
      width: width * 0.7, lineBreak: false,
    });
  doc.text(`Página ${pageNumber} de ${totalPages}`, PAGE_MARGIN + width * 0.7, textY, {
    width: width * 0.3, align: 'right', lineBreak: false,
  });
}

/**
 * Gera o relatório em PDF da meta comercial (não é uma cópia da página HTML,
 * e sim um documento formatado especificamente para leitura/impressão).
 * @param {object} data — mesmo formato aceito por POST /api/metas, mais `equipe`.
 * @returns {PDFDocument} stream pronto para ser "pipe"-ado na resposta.
 */
function generateMetaComercialPdf(data) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE_MARGIN, bottom: 60, left: PAGE_MARGIN, right: PAGE_MARGIN },
    bufferPages: true,
  });

  const faturamento = Number(data.faturamento) || 0;
  const crescimentoPct = Number(data.crescimento_pct) || 0;
  const churnPct = Number(data.churn_pct) || 0;
  const crescimentoReais = faturamento * (crescimentoPct / 100);
  const churnReais = faturamento * (churnPct / 100);
  const metaAnual = Number(data.meta_anual) || 0;
  const metaTrimestral = Number(data.meta_trimestral) || 0;
  const metaMensal = Number(data.meta_mensal) || 0;
  const ticket = Number(data.ticket) || 0;
  const contratosMes = Number(data.contratos_mes) || 0;
  const conversaoPct = Number(data.conversao_pct) || 0;
  const contatosNecessarios = Number(data.contatos_necessarios) || 0;
  const contatosPassado = Number(data.contatos_mes_passado) || 0;
  const hunterValor = Number(data.hunter_valor) || 0;
  const farmerValor = Number(data.farmer_valor) || 0;
  const equipe = Array.isArray(data.equipe) ? data.equipe : [];

  drawHeader(doc, data);

  drawStatCards(doc, [
    { label: 'Meta mensal', value: fmtBRL(metaMensal), destaque: true },
    { label: 'Meta trimestral', value: fmtBRL(metaTrimestral) },
    { label: 'Meta anual', value: fmtBRL(metaAnual) },
  ]);

  sectionTitle(doc, 'A meta da empresa', 'Você não vende só para crescer — vende também para repor quem sai.');
  drawFactList(doc, [
    { label: 'Faturamento mensal atual', value: fmtBRL(faturamento) },
    { label: `Crescimento desejado no ano (${fmtPct(crescimentoPct)})`, value: fmtBRL(crescimentoReais) },
    { label: `Perda estimada por churn no ano (${fmtPct(churnPct)})`, value: fmtBRL(churnReais) },
    { label: 'Meta anual (corporativa)', value: fmtBRL(metaAnual), destaque: true },
    { label: 'Meta trimestral', value: fmtBRL(metaTrimestral) },
    { label: 'Meta mensal (área comercial)', value: fmtBRL(metaMensal), destaque: true },
  ]);

  sectionTitle(doc, 'Da meta aos contatos necessários');
  drawFactList(doc, [
    { label: 'Ticket médio mensal', value: fmtBRL(ticket) },
    { label: 'Contratos novos necessários por mês', value: fmtQtd(contratosMes, 'contratos') },
    { label: 'Taxa de conversão', value: fmtPct(conversaoPct) },
    { label: 'Contatos necessários por mês', value: fmtQtd(Math.ceil(contatosNecessarios), 'contatos') },
  ]);

  if (contatosPassado > 0 && contatosNecessarios > 0) {
    const razao = contatosPassado / contatosNecessarios;
    if (razao < 0.7) {
      drawCallout(
        doc,
        `O problema não é o vendedor. Você precisa de ${Math.ceil(contatosNecessarios)} contatos por mês e só entraram ${Math.round(contatosPassado)}. Essa meta nunca teve chance de acontecer com esse volume de entrada.`,
        'alert'
      );
    } else {
      drawCallout(
        doc,
        `Entraram ${Math.round(contatosPassado)} de ${Math.ceil(contatosNecessarios)} contatos necessários. O volume de entrada sustenta essa meta.`,
        'ok'
      );
    }
  }

  sectionTitle(doc, 'Meta por pessoa', 'A meta da empresa precisa virar o pedaço de cada um — senão continua sendo um número que ninguém carrega.');
  drawFactList(doc, [
    { label: 'Clientes novos (hunter)', value: fmtBRL(hunterValor) },
    { label: 'Base — upsell e cross-sell (farmer)', value: fmtBRL(farmerValor) },
  ]);

  if (hunterValor > metaMensal && metaMensal > 0) {
    drawCallout(
      doc,
      `O valor de hunter (${fmtBRL(hunterValor)}) é maior que a meta mensal da área (${fmtBRL(metaMensal)}). Revise a divisão entre hunter e farmer.`,
      'alert'
    );
  }

  if (equipe.length > 0) {
    doc.moveDown(0.2);
    drawTeamTable(doc, equipe, metaMensal);
  }

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i - range.start + 1, range.count);
  }

  doc.end();
  return doc;
}

module.exports = {
  generateMetaComercialPdf,
  metaComercialFilename,
  contentDispositionFilename,
};
