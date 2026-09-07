const {
  BASE_PALETTE,
  PAGE_MARGIN,
  sanitizeForFilename,
  contentDispositionFilename,
  createReportDocument,
  ensureSpace,
  contentWidth,
  drawHeaderBand,
  sectionTitle,
  drawCallout,
  finalizeReport,
} = require('./pdfLayout');

const PALETTE = {
  ...BASE_PALETTE,
  primary: '#4B8B1E',
  primaryDark: '#2F5A12',
  primaryBg: '#EEF7DF',
};

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

// D-13 da auditoria do DISC: os dois PDFs nomeavam o arquivo por convenções
// diferentes (participante vs. empresa) — quem fazia as duas dinâmicas no
// mesmo treinamento acabava com dois arquivos inconsistentes na pasta de
// downloads. Padronizado por participante nos dois.
// nome do arquivo: "${nome do participante} meta comercial.pdf"
function metaComercialFilename(nomeParticipante) {
  const nome = sanitizeForFilename(nomeParticipante);
  const base = nome ? `${nome} meta comercial` : 'Meta comercial';
  return `${base}.pdf`;
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

/**
 * Gera o relatório em PDF da meta comercial (não é uma cópia da página HTML,
 * e sim um documento formatado especificamente para leitura/impressão).
 * @param {object} data — mesmo formato aceito por POST /api/metas.
 * @returns {PDFDocument} stream pronto para ser "pipe"-ado na resposta.
 */
function generateMetaComercialPdf(data) {
  const doc = createReportDocument();

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

  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  drawHeaderBand(doc, {
    eyebrow: 'RELATÓRIO · EXERCÍCIO PRÁTICO DE TREINAMENTO COMERCIAL',
    title: data.empresa ? `Meta comercial — ${data.empresa}` : 'Meta comercial',
    subtitle: data.nome_participante
      ? `Preparado para ${data.nome_participante} · ${dataFormatada}`
      : `Gerado em ${dataFormatada}`,
  });

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

  return finalizeReport(doc, 'Gerado automaticamente pela calculadora de meta comercial');
}

module.exports = {
  generateMetaComercialPdf,
  metaComercialFilename,
  contentDispositionFilename,
};
