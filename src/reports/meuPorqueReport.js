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
  finalizeReport,
} = require('./pdfLayout');

const PALETTE = { ...BASE_PALETTE };

// nome do arquivo por participante (não por empresa) — mesma convenção da
// calculadora e do DISC (D-13 da auditoria do DISC, ver CLAUDE.md/CHANGELOG).
function meuPorqueFilename(nomeParticipante) {
  const nome = sanitizeForFilename(nomeParticipante);
  const base = nome ? `${nome} meu porque` : 'Meu Porque';
  return `${base}.pdf`;
}

// corpo de texto livre de uma resposta — sem caixa/callout, só o texto
// corrido, com fallback pra quem enviou o PDF sem responder aquela pergunta.
function drawAnswer(doc, texto) {
  const width = contentWidth(doc);
  const corpo = texto && String(texto).trim() ? String(texto).trim() : 'Não respondida.';
  const semResposta = corpo === 'Não respondida.';

  doc.font(semResposta ? 'Helvetica-Oblique' : 'Helvetica').fontSize(10.5);
  const height = doc.heightOfString(corpo, { width });
  ensureSpace(doc, height + 22);

  doc.fillColor(semResposta ? PALETTE.inkFaint : PALETTE.ink)
    .text(corpo, PAGE_MARGIN, doc.y, { width, lineGap: 3 });
  doc.moveDown(1.3);
}

/**
 * Gera o relatório em PDF da dinâmica "Meu Porquê" (não é uma cópia da
 * página HTML — as 4 respostas formatadas como um documento de leitura).
 * @param {object} data — mesmo formato aceito por POST /api/meu-porque.
 * @returns {PDFDocument} stream pronto para ser "pipe"-ado na resposta.
 */
function generateMeuPorquePdf(data) {
  const doc = createReportDocument();

  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  drawHeaderBand(doc, {
    eyebrow: 'RELATÓRIO · MEU PORQUÊ',
    title: data.empresa ? `Meu Porquê — ${data.empresa}` : 'Meu Porquê',
    subtitle: data.nome_participante
      ? `Preparado para ${data.nome_participante} · ${dataFormatada}`
      : `Gerado em ${dataFormatada}`,
  });

  sectionTitle(doc, '1. Qual é o seu objetivo?', 'O que você quer conquistar — de forma clara e específica.');
  drawAnswer(doc, data.objetivo);

  sectionTitle(doc, '2. Qual é o seu sonho?', 'Aquilo que você quer de verdade, não o que acham que você deveria querer.');
  drawAnswer(doc, data.sonho);

  sectionTitle(doc, '3. Qual é a sua mudança?', 'O que precisa mudar em você, hoje, pra esse sonho ser possível.');
  drawAnswer(doc, data.mudanca);

  sectionTitle(doc, '4. Qual é a sua visão de futuro?', 'Como é a sua vida e a sua empresa quando isso acontecer.');
  drawAnswer(doc, data.visao_futuro);

  return finalizeReport(doc, 'Gerado automaticamente pela dinâmica Meu Porquê');
}

module.exports = {
  generateMeuPorquePdf,
  meuPorqueFilename,
  contentDispositionFilename,
};
