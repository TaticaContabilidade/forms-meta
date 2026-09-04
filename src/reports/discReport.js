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

const PALETTE = { ...BASE_PALETTE };

const TRAITS = ['D', 'I', 'S', 'C'];

const TRAIT_COLORS = { D: '#D64545', I: '#C98423', S: '#1E9A66', C: '#3E76D6' };
const TRAIT_BG = { D: '#FBEAEA', I: '#FDF3E2', S: '#E4F5EC', C: '#E7F0FD' };
const TRAIT_LABELS = { D: 'Dominância', I: 'Influência', S: 'Estabilidade', C: 'Conformidade' };

// Mesmo conteúdo de public/disc.html (ARQUETIPO_MAP) — mantido aqui porque o
// relatório é gerado no servidor e não deve depender do texto que o cliente
// enviou (só dos números e da letra do perfil dominante).
const ARQUETIPO_MAP = {
  D: {
    nome: 'O Executor',
    descricao: 'Perfil dominante — Dominância acima dos demais',
    performa: 'Você performa melhor em ambientes de alta pressão onde resultado rápido é o que importa. Tem capacidade natural de decidir sob incerteza, mobilizar pessoas para ação imediata e assumir responsabilidades que outros evitam. Funções de liderança direta, vendas consultivas de alta complexidade e qualquer papel que exija coragem para agir sem aprovação de todos são onde você entrega mais.',
    derail: 'Você pode derrubar sua própria performance ao atropelar pessoas que precisam de mais tempo, ao não ouvir feedback que contradiz sua visão ou ao criar urgência desnecessária que desgasta o time. A impaciência com processos e a tendência de decidir sozinho podem gerar resistência onde você mais precisa de adesão.',
  },
  I: {
    nome: 'O Comunicador',
    descricao: 'Perfil dominante — Influência acima dos demais',
    performa: 'Você performa melhor em ambientes que exigem engajamento, construção de relacionamento e capacidade de inspirar pessoas a acreditar em algo. Tem talento natural para criar atmosfera positiva, vender visões e conectar pessoas. Funções de desenvolvimento de negócios, gestão de comunidade, treinamento e vendas relacionais são onde você entrega mais.',
    derail: 'Você pode derrubar sua performance ao deixar tarefas incompletas por excesso de ideias, ao evitar conversas difíceis para preservar o clima, ou ao superestimar o entusiasmo de outros como compromisso real. A falta de follow-through e o excesso de otimismo podem comprometer sua credibilidade nos momentos críticos.',
  },
  S: {
    nome: 'O Planejador',
    descricao: 'Perfil dominante — Estabilidade acima dos demais',
    performa: 'Você performa melhor em ambientes que valorizam consistência, profundidade e confiabilidade. Tem capacidade natural de sustentar ritmo, cuidar de pessoas e garantir que o que foi prometido seja entregue. Funções de customer success, gestão de projetos de longo prazo, atendimento e qualquer papel onde a confiança é o ativo central são onde você entrega mais.',
    derail: 'Você pode derrubar sua performance ao evitar conflitos necessários, ao resistir a mudanças que seriam boas mas geram desconforto, ou ao se sobrecarregar por dificuldade de dizer não. A tendência de priorizar harmonia pode fazer você segurar feedbacks importantes que precisam ser dados.',
  },
  C: {
    nome: 'O Analista',
    descricao: 'Perfil dominante — Conformidade acima dos demais',
    performa: 'Você performa melhor em ambientes que valorizam qualidade, precisão e análise criteriosa. Tem capacidade natural de identificar riscos antes que se tornem problemas, estruturar processos com rigor e garantir que as entregas tenham o padrão esperado. Funções de operações, qualidade, análise de dados, produtos técnicos e consultoria são onde você entrega mais.',
    derail: 'Você pode derrubar sua performance ao paralisar por excesso de análise, ao rejeitar decisões tomadas com dados insuficientes (mesmo quando o timing exige ação) ou ao criticar sem oferecer alternativas. O perfeccionismo pode gerar atrasos e a exigência de precisão pode tornar a colaboração com perfis mais impulsivos difícil.',
  },
};

function getArquetipoLetra(scores) {
  const max = Math.max(scores.D, scores.I, scores.S, scores.C);
  return TRAITS.find((t) => scores[t] === max) || 'D';
}

// nome do arquivo: "${nome do participante} perfil disc.pdf"
function discFilename(nomeParticipante) {
  const nome = sanitizeForFilename(nomeParticipante);
  const base = nome ? `${nome} perfil disc` : 'Perfil DISC';
  return `${base}.pdf`;
}

function drawTraitBar(doc, trait, pct, valueText) {
  const width = contentWidth(doc);
  const rowHeight = 24;
  ensureSpace(doc, rowHeight);
  const y = doc.y;
  const labelWidth = 140;
  const valueWidth = 46;
  const trackX = PAGE_MARGIN + labelWidth;
  const trackWidth = width - labelWidth - valueWidth;

  doc.fillColor(TRAIT_COLORS[trait]).font('Helvetica-Bold').fontSize(10)
    .text(`${trait} · ${TRAIT_LABELS[trait]}`, PAGE_MARGIN, y + 5, { width: labelWidth - 8, lineBreak: false });

  doc.roundedRect(trackX, y + 4, trackWidth, 11, 5.5).fill('#EEF0F4');
  const clamped = Math.max(0, Math.min(100, pct));
  const fillWidth = clamped > 0 ? Math.max(8, (trackWidth * clamped) / 100) : 0;
  if (fillWidth > 0) {
    doc.roundedRect(trackX, y + 4, fillWidth, 11, 5.5).fill(TRAIT_COLORS[trait]);
  }

  doc.fillColor(PALETTE.ink).font('Helvetica-Bold').fontSize(9.5)
    .text(valueText, trackX + trackWidth + 8, y + 5, { width: valueWidth - 8, align: 'right', lineBreak: false });

  doc.y = y + rowHeight;
}

// perfil natural/adaptado: escore com sinal, numa faixa de -ref a +ref
function drawSignedBarSection(doc, scores, ref) {
  TRAITS.forEach((t) => {
    const raw = scores[t] || 0;
    const pct = ((raw + ref) / (2 * ref)) * 100;
    const valueText = (raw > 0 ? '+' : '') + raw;
    drawTraitBar(doc, t, pct, valueText);
  });
  doc.moveDown(0.6);
}

// intensidade: média de 0 a 5
function drawIntensitySection(doc, scores) {
  TRAITS.forEach((t) => {
    const v = scores[t] || 0;
    const pct = (v / 5) * 100;
    drawTraitBar(doc, t, pct, v.toFixed(1));
  });
  doc.moveDown(0.6);
}

function drawTraitCards(doc) {
  const width = contentWidth(doc);
  const gap = 12;
  const cardWidth = (width - gap) / 2;

  for (let row = 0; row < 2; row++) {
    const rowTraits = TRAITS.slice(row * 2, row * 2 + 2);
    doc.font('Helvetica').fontSize(9);
    const cardHeight = Math.max(
      74,
      ...rowTraits.map((t) => 34 + doc.heightOfString(ARQUETIPO_MAP[t].descricao, { width: cardWidth - 32 }))
    );
    ensureSpace(doc, cardHeight + 12);
    const startY = doc.y;

    rowTraits.forEach((t, i) => {
      const x = PAGE_MARGIN + i * (cardWidth + gap);
      doc.rect(x, startY, cardWidth, cardHeight).fill(TRAIT_BG[t]);
      doc.rect(x, startY, 4, cardHeight).fill(TRAIT_COLORS[t]);

      doc.fillColor(TRAIT_COLORS[t]).font('Helvetica-Bold').fontSize(13)
        .text(t, x + 16, startY + 14, { width: 20, lineBreak: false });
      doc.fillColor(PALETTE.ink).font('Helvetica-Bold').fontSize(10.5)
        .text(ARQUETIPO_MAP[t].nome, x + 36, startY + 14, { width: cardWidth - 52 });
      doc.fillColor(PALETTE.inkSoft).font('Helvetica').fontSize(9)
        .text(ARQUETIPO_MAP[t].descricao, x + 16, startY + 32, { width: cardWidth - 32 });
    });

    doc.y = startY + cardHeight + 12;
  }
}

function drawArchetypeHero(doc, trait, nome, descricao) {
  const width = contentWidth(doc);
  ensureSpace(doc, 90);
  const y = doc.y;
  const height = 78;

  doc.roundedRect(PAGE_MARGIN, y, width, height, 8)
    .fillAndStroke(TRAIT_BG[trait], PALETTE.border);
  doc.rect(PAGE_MARGIN, y, 6, height).fill(TRAIT_COLORS[trait]);

  doc.fillColor(PALETTE.inkFaint).font('Helvetica-Bold').fontSize(8)
    .text('SEU PERFIL COMPORTAMENTAL', PAGE_MARGIN + 24, y + 16, { characterSpacing: 0.4 });
  doc.fillColor(TRAIT_COLORS[trait]).font('Helvetica-Bold').fontSize(20)
    .text(nome, PAGE_MARGIN + 24, y + 30, { width: width - 48 });
  doc.fillColor(PALETTE.inkSoft).font('Helvetica').fontSize(10)
    .text(descricao, PAGE_MARGIN + 24, y + 56, { width: width - 48 });

  doc.y = y + height + 18;
}

/**
 * Gera o relatório em PDF da avaliação DISC (não é uma cópia da página HTML,
 * e sim um documento formatado especificamente para leitura/impressão).
 * @param {object} data — mesmo formato aceito por POST /api/disc.
 * @returns {PDFDocument} stream pronto para ser "pipe"-ado na resposta.
 */
function generateDiscPdf(data) {
  const doc = createReportDocument();

  const natural = {
    D: Number(data.d_natural) || 0,
    I: Number(data.i_natural) || 0,
    S: Number(data.s_natural) || 0,
    C: Number(data.c_natural) || 0,
  };
  const adaptado = {
    D: Number(data.d_adaptado) || 0,
    I: Number(data.i_adaptado) || 0,
    S: Number(data.s_adaptado) || 0,
    C: Number(data.c_adaptado) || 0,
  };
  const intensidade = {
    D: Number(data.d_intensidade) || 0,
    I: Number(data.i_intensidade) || 0,
    S: Number(data.s_intensidade) || 0,
    C: Number(data.c_intensidade) || 0,
  };

  const trait = TRAITS.includes(data.perfil_dominante)
    ? data.perfil_dominante
    : getArquetipoLetra(natural);
  const info = ARQUETIPO_MAP[trait];

  const dataFormatada = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
  drawHeaderBand(doc, {
    eyebrow: 'RELATÓRIO · AVALIAÇÃO DISC PROFUNDA',
    title: data.empresa ? `Perfil comportamental — ${data.empresa}` : 'Perfil comportamental',
    subtitle: data.nome_participante
      ? `Preparado para ${data.nome_participante} · ${dataFormatada}`
      : `Gerado em ${dataFormatada}`,
  });

  drawArchetypeHero(doc, trait, info.nome, info.descricao);

  sectionTitle(doc, 'Perfil natural', 'O que é mais parecido com você — como você é, não como gostaria de ser.');
  drawSignedBarSection(doc, natural, 28);

  sectionTitle(doc, 'Perfil adaptado (trabalho)', 'Como você se comporta em situações reais no ambiente de trabalho.');
  drawSignedBarSection(doc, adaptado, 16);

  sectionTitle(doc, 'Intensidade por traço', 'Força de cada traço, numa escala de 0 a 5.');
  drawIntensitySection(doc, intensidade);

  sectionTitle(doc, 'Os quatro perfis DISC');
  drawTraitCards(doc);

  sectionTitle(doc, 'Como você performa');
  drawCallout(doc, info.performa, 'ok');

  sectionTitle(doc, 'O que pode derrubar sua performance');
  drawCallout(doc, info.derail, 'alert');

  return finalizeReport(doc, 'Gerado automaticamente pela avaliação DISC');
}

module.exports = {
  generateDiscPdf,
  discFilename,
  contentDispositionFilename,
};
