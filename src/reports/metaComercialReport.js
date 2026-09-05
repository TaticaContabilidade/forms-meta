const {
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

function drawTeamTable(doc, equipe, metaMensal) {
  const width = contentWidth(doc);
  const colNome = width * 0.42;
  const colPapel = width * 0.24;
  const colMeta = width * 0.34;
  const rowPad = 8;

  // F-13 da auditoria: com só 2 pessoas cadastradas, a tabela partia no
  // meio — a 1ª pessoa fechava a página 1 e a 2ª abria a página 2 sozinha,
  // com o total e o rodapé, deixando quase uma folha em branco. Mede a
  // altura da tabela inteira (cabeçalho + linhas + total) antes de
  // desenhar; se ela cabe inteira numa página e só não cabe no que resta
  // da atual, empurra o bloco inteiro para a próxima — sem isso, times
  // grandes continuam paginando linha a linha normalmente.
  const soma = equipe.reduce((acc, pessoa) => acc + (Number(pessoa.meta) || 0), 0);
  const diff = metaMensal - soma;
  let statusTexto = null;
  let tone;
  if (equipe.length > 0 && metaMensal !== 0) {
    if (Math.abs(diff) < 1) {
      statusTexto = `Fecha: ${fmtBRL(soma)} de ${fmtBRL(metaMensal)} distribuídos entre a equipe.`;
      tone = 'ok';
    } else if (diff > 0) {
      statusTexto = `Falta distribuir ${fmtBRL(diff)} para fechar a meta mensal da área (${fmtBRL(metaMensal)}).`;
      tone = 'alert';
    } else {
      statusTexto = `A soma das metas individuais está ${fmtBRL(Math.abs(diff))} acima da meta mensal da área (${fmtBRL(metaMensal)}).`;
      tone = 'alert';
    }
  }

  const headerHeight = 26;
  const totalRowHeight = 28;
  doc.font('Helvetica').fontSize(10);
  const rowsHeight = equipe.reduce((acc, pessoa, i) => {
    const nome = pessoa.nome || `Pessoa ${i + 1}`;
    return acc + Math.max(24, doc.heightOfString(nome, { width: colNome - 12 }) + rowPad * 2);
  }, 0);
  const calloutHeight = statusTexto
    ? doc.heightOfString(statusTexto, { width: width - 32 }) + 24 + 16
    : 0;
  const tabelaHeightTotal = headerHeight + rowsHeight + totalRowHeight + calloutHeight;
  const alturaUtilPagina = doc.page.height - doc.page.margins.top - doc.page.margins.bottom - FOOTER_RESERVE;
  if (tabelaHeightTotal <= alturaUtilPagina) {
    ensureSpace(doc, tabelaHeightTotal);
  } else {
    ensureSpace(doc, 30);
  }

  const headerY = doc.y;
  doc.rect(PAGE_MARGIN, headerY, width, 26).fill(PALETTE.ink);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9);
  doc.text('NOME', PAGE_MARGIN + 12, headerY + 8, { width: colNome - 12 });
  doc.text('PAPEL', PAGE_MARGIN + colNome, headerY + 8, { width: colPapel });
  doc.text('META MENSAL', PAGE_MARGIN + colNome + colPapel, headerY + 8, {
    width: colMeta - 12, align: 'right',
  });
  doc.y = headerY + 26;

  equipe.forEach((pessoa, i) => {
    const nome = pessoa.nome || `Pessoa ${i + 1}`;
    const tipo = pessoa.tipo || '—';
    const meta = Number(pessoa.meta) || 0;

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

  if (statusTexto) drawCallout(doc, statusTexto, tone);
}

/**
 * Gera o relatório em PDF da meta comercial (não é uma cópia da página HTML,
 * e sim um documento formatado especificamente para leitura/impressão).
 * @param {object} data — mesmo formato aceito por POST /api/metas, mais `equipe`.
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
  const hunterValor = Number(data.hunter_valor) || 0;
  const farmerValor = Number(data.farmer_valor) || 0;
  const equipe = Array.isArray(data.equipe) ? data.equipe : [];

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

  return finalizeReport(doc, 'Gerado automaticamente pela calculadora de meta comercial');
}

module.exports = {
  generateMetaComercialPdf,
  metaComercialFilename,
  contentDispositionFilename,
};
