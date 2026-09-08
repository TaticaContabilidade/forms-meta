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
// enviou, só dos escores brutos (d_natural, i_natural, ...).
const ARQUETIPO_MAP = {
  D: {
    nome: 'O Executor',
    descricao: 'Perfil dominante — Dominância acima dos demais',
    // D-06 da auditoria: os 4 cards de referência usavam .descricao (que
    // afirma "perfil dominante") pros 4 traços ao mesmo tempo — o leitor
    // via a mesma alegação 4 vezes seguidas. .resumo é neutro, só descreve
    // o traço, e não afirma dominância de ninguém.
    resumo: 'Foco em resultado rápido: decide sob pressão, mobiliza gente e assume responsabilidade sem esperar aprovação.',
    performa: 'Você performa melhor em ambientes de alta pressão onde resultado rápido é o que importa. Tem capacidade natural de decidir sob incerteza, mobilizar pessoas para ação imediata e assumir responsabilidades que outros evitam. Funções de liderança direta, vendas consultivas de alta complexidade e qualquer papel que exija coragem para agir sem aprovação de todos são onde você entrega mais.',
    derail: 'Você pode derrubar sua própria performance ao atropelar pessoas que precisam de mais tempo, ao não ouvir feedback que contradiz sua visão ou ao criar urgência desnecessária que desgasta o time. A impaciência com processos e a tendência de decidir sozinho podem gerar resistência onde você mais precisa de adesão.',
  },
  I: {
    nome: 'O Comunicador',
    descricao: 'Perfil dominante — Influência acima dos demais',
    resumo: 'Foco em relacionamento: engaja, entusiasma e vende visões com facilidade natural para conectar pessoas.',
    performa: 'Você performa melhor em ambientes que exigem engajamento, construção de relacionamento e capacidade de inspirar pessoas a acreditar em algo. Tem talento natural para criar atmosfera positiva, vender visões e conectar pessoas. Funções de desenvolvimento de negócios, gestão de comunidade, treinamento e vendas relacionais são onde você entrega mais.',
    derail: 'Você pode derrubar sua performance ao deixar tarefas incompletas por excesso de ideias, ao evitar conversas difíceis para preservar o clima, ou ao superestimar o entusiasmo de outros como compromisso real. A falta de follow-through e o excesso de otimismo podem comprometer sua credibilidade nos momentos críticos.',
  },
  S: {
    nome: 'O Planejador',
    descricao: 'Perfil dominante — Estabilidade acima dos demais',
    resumo: 'Foco em consistência: sustenta ritmo, cuida das pessoas ao redor e garante que o combinado seja entregue.',
    performa: 'Você performa melhor em ambientes que valorizam consistência, profundidade e confiabilidade. Tem capacidade natural de sustentar ritmo, cuidar de pessoas e garantir que o que foi prometido seja entregue. Funções de customer success, gestão de projetos de longo prazo, atendimento e qualquer papel onde a confiança é o ativo central são onde você entrega mais.',
    derail: 'Você pode derrubar sua performance ao evitar conflitos necessários, ao resistir a mudanças que seriam boas mas geram desconforto, ou ao se sobrecarregar por dificuldade de dizer não. A tendência de priorizar harmonia pode fazer você segurar feedbacks importantes que precisam ser dados.',
  },
  C: {
    nome: 'O Analista',
    descricao: 'Perfil dominante — Conformidade acima dos demais',
    resumo: 'Foco em precisão: analisa risco antes de agir, estrutura processo com rigor e busca o padrão de qualidade certo.',
    performa: 'Você performa melhor em ambientes que valorizam qualidade, precisão e análise criteriosa. Tem capacidade natural de identificar riscos antes que se tornem problemas, estruturar processos com rigor e garantir que as entregas tenham o padrão esperado. Funções de operações, qualidade, análise de dados, produtos técnicos e consultoria são onde você entrega mais.',
    derail: 'Você pode derrubar sua performance ao paralisar por excesso de análise, ao rejeitar decisões tomadas com dados insuficientes (mesmo quando o timing exige ação) ou ao criticar sem oferecer alternativas. O perfeccionismo pode gerar atrasos e a exigência de precisão pode tornar a colaboração com perfis mais impulsivos difícil.',
  },
};

// D-10 da auditoria: o texto dizia "escala de 0 a 5" (0 nem existe como
// opção) e os valores saíam com ponto decimal em vez de vírgula.
function fmtDecimalPtBR(n) {
  return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Pontos mínimos de separação entre o 1º e o 2º traço para considerar que
// há um traço realmente dominante. Abaixo disso é empate técnico — nunca
// atribua dominância só porque a ordem de checagem D,I,S,C desempata sozinha.
// Mesmo limiar usado em public/disc.html (LIMIAR_EMPATE_TRACOS).
const LIMIAR_EMPATE_TRACOS = 2;

function resolverPerfilDominante(scores) {
  const ranking = [...TRAITS].sort((a, b) => scores[b] - scores[a]);
  const gap = scores[ranking[0]] - scores[ranking[1]];
  const empatado = gap < LIMIAR_EMPATE_TRACOS;
  return {
    traits: empatado ? [ranking[0], ranking[1]] : [ranking[0]],
    gap,
    empatado,
  };
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

// perfil natural/adaptado: contagem sem sinal (nunca negativa — ver
// calcNatural()/calcAdaptado() em src/discScoring.js), de 0 até `ref` (28).
function drawUnsignedBarSection(doc, scores, ref) {
  TRAITS.forEach((t) => {
    const raw = scores[t] || 0;
    const pct = ref > 0 ? (raw / ref) * 100 : 0;
    drawTraitBar(doc, t, pct, String(raw));
  });
  doc.moveDown(0.6);
}

// intensidade: média de 1 a 5
function drawIntensitySection(doc, scores) {
  TRAITS.forEach((t) => {
    const v = scores[t] || 0;
    const pct = (v / 5) * 100;
    drawTraitBar(doc, t, pct, fmtDecimalPtBR(v));
  });
  doc.moveDown(0.6);
}

// traitsDoParticipante: perfil.traits (1 ou 2 letras) — usado só pra
// destacar visualmente qual(is) card(s) é(são) do participante (D-06).
function drawTraitCards(doc, traitsDoParticipante) {
  const width = contentWidth(doc);
  const gap = 12;
  const cardWidth = (width - gap) / 2;

  for (let row = 0; row < 2; row++) {
    const rowTraits = TRAITS.slice(row * 2, row * 2 + 2);
    doc.font('Helvetica').fontSize(9);
    const cardHeight = Math.max(
      74,
      ...rowTraits.map((t) => 34 + doc.heightOfString(ARQUETIPO_MAP[t].resumo, { width: cardWidth - 32 }))
    );
    ensureSpace(doc, cardHeight + 12);
    const startY = doc.y;

    rowTraits.forEach((t, i) => {
      const x = PAGE_MARGIN + i * (cardWidth + gap);
      const ehDoParticipante = traitsDoParticipante.includes(t);
      doc.rect(x, startY, cardWidth, cardHeight).fill(TRAIT_BG[t]);
      doc.rect(x, startY, ehDoParticipante ? 6 : 4, cardHeight).fill(TRAIT_COLORS[t]);
      if (ehDoParticipante) {
        doc.roundedRect(x + cardWidth - 78, startY + 10, 68, 16, 8).fill(TRAIT_COLORS[t]);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5)
          .text('SEU PERFIL', x + cardWidth - 78, startY + 15, { width: 68, align: 'center', characterSpacing: 0.3 });
      }

      doc.fillColor(TRAIT_COLORS[t]).font('Helvetica-Bold').fontSize(13)
        .text(t, x + 16, startY + 14, { width: 20, lineBreak: false });
      doc.fillColor(PALETTE.ink).font('Helvetica-Bold').fontSize(10.5)
        .text(ARQUETIPO_MAP[t].nome, x + 36, startY + 14, { width: cardWidth - (ehDoParticipante ? 130 : 52) });
      doc.fillColor(PALETTE.inkSoft).font('Helvetica').fontSize(9)
        .text(ARQUETIPO_MAP[t].resumo, x + 16, startY + 32, { width: cardWidth - 32 });
    });

    doc.y = startY + cardHeight + 12;
  }
}

// traits: 1 elemento (perfil claramente dominante) ou 2 (empate técnico)
function drawArchetypeHero(doc, traits, infos, descricao) {
  const width = contentWidth(doc);
  ensureSpace(doc, 90);
  const y = doc.y;
  const height = 78;
  const empatado = traits.length > 1;
  const bg = empatado ? '#F1F2F6' : TRAIT_BG[traits[0]];

  doc.roundedRect(PAGE_MARGIN, y, width, height, 8).fillAndStroke(bg, PALETTE.border);
  // uma faixa de destaque por traço (2 faixas finas quando empatado)
  const barW = 6 / traits.length;
  traits.forEach((t, i) => {
    doc.rect(PAGE_MARGIN + i * barW, y, barW, height).fill(TRAIT_COLORS[t]);
  });

  doc.fillColor(PALETTE.inkFaint).font('Helvetica-Bold').fontSize(8)
    .text('SEU PERFIL COMPORTAMENTAL', PAGE_MARGIN + 24, y + 16, { characterSpacing: 0.4 });

  if (!empatado) {
    doc.fillColor(TRAIT_COLORS[traits[0]]).font('Helvetica-Bold').fontSize(20)
      .text(infos[0].nome, PAGE_MARGIN + 24, y + 30, { width: width - 48 });
  } else {
    doc.fillColor(PALETTE.ink).font('Helvetica-Bold').fontSize(17)
      .text(infos.map((i) => i.nome).join(' + '), PAGE_MARGIN + 24, y + 30, { width: width - 48 });
  }
  doc.fillColor(PALETTE.inkSoft).font('Helvetica').fontSize(10)
    .text(descricao, PAGE_MARGIN + 24, y + 56, { width: width - 48 });

  doc.y = y + height + 18;
}

// N-06 do reteste: drawAdaptacaoDelta() (era a correção do D-04 da
// auditoria anterior) subtraía o escore adaptado do natural pra achar "o
// traço que mais muda sob pressão", mas os dois perfis não estavam na
// mesma escala — natural vinha de 28 blocos (+1/-1, varia -28 a +28),
// adaptado vinha de 16 situações (só +1, varia 0 a 16). O traço natural
// mais negativo sempre "vencia" essa conta, artificialmente — não era uma
// leitura real de adaptação. Removida na época; o relatório mostrava as
// duas seções de barra lado a lado, sem comparação numérica entre elas.
//
// Item 01 do reteste-e-plataforma-ideal.md (ver CLAUDE.md/CHANGELOG): os 2
// perfis agora vêm das mesmas 28 marcações da Parte A (MENOS forma o
// natural, MAIS forma o adaptado) — ambos contagens de 0 a 28, mesma
// escala de verdade. Um comparativo textual/numérico entre eles voltou a
// ser matematicamente válido, mas ainda não foi decidido/implementado —
// as barras continuam lado a lado, sem delta.

// D-05: quando as 4 intensidades saem muito parecidas, é sinal de
// respostas pouco diferenciadas na Parte C — vale avisar.
function drawIntensidadeAviso(doc, intensidade) {
  const valores = TRAITS.map((t) => intensidade[t] || 0);
  const spread = Math.max(...valores) - Math.min(...valores);
  if (spread >= 1) return;
  const texto = `Suas quatro intensidades ficaram bem parecidas (diferença de só ${fmtDecimalPtBR(spread)} ponto entre a maior e a menor). Isso pode ser porque os quatro traços realmente pesam parecido em você, ou porque as respostas da Parte C foram pouco diferenciadas.`;
  drawCallout(doc, texto, 'alert');
}

// D-05: frase que modula o texto de "como você performa" pela intensidade
// medida na Parte C — antes o texto saía igual pra quem respondeu 1 ou 5
// em tudo.
function fraseIntensidade(trait, valor) {
  const label = TRAIT_LABELS[trait];
  const fmt = fmtDecimalPtBR(valor);
  if (valor >= 4) return `Sua intensidade de ${label} é alta (${fmt} de 5) — esse traço aparece com força no seu dia a dia.`;
  if (valor <= 2) return `Sua intensidade de ${label} é baixa (${fmt} de 5) — esse traço aparece de forma mais moderada no seu comportamento.`;
  return `Sua intensidade de ${label} é moderada (${fmt} de 5).`;
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

  // Sempre recalculado a partir dos escores brutos — nunca confia num
  // perfil_dominante já salvo, que pode ter sido gravado por uma versão
  // anterior (com o bug de empate sempre caindo em D).
  const perfil = resolverPerfilDominante(natural);
  const infos = perfil.traits.map((t) => ARQUETIPO_MAP[t]);

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

  const heroDescricao = !perfil.empatado
    ? infos[0].descricao
    : `Empate técnico entre ${perfil.traits[0]} e ${perfil.traits[1]} — diferença de só ${perfil.gap} ponto${perfil.gap === 1 ? '' : 's'} no perfil natural. Considere as duas descrições abaixo, não apenas uma.`;
  drawArchetypeHero(doc, perfil.traits, infos, heroDescricao);

  sectionTitle(doc, 'Perfil natural', 'O que exige menos esforço de você — seu estilo em repouso, sem pressão do ambiente.');
  drawUnsignedBarSection(doc, natural, 28);

  sectionTitle(doc, 'Perfil adaptado', 'O que você mostra mais quando o ambiente pede um comportamento diferente do natural.');
  drawUnsignedBarSection(doc, adaptado, 28);

  sectionTitle(doc, 'Intensidade por traço', 'Força de cada traço, numa escala de 1 a 5.');
  drawIntensitySection(doc, intensidade);
  drawIntensidadeAviso(doc, intensidade);

  sectionTitle(doc, 'Os quatro perfis DISC');
  drawTraitCards(doc, perfil.traits);

  infos.forEach((info, i) => {
    const t = perfil.traits[i];
    sectionTitle(doc, `${info.nome} em ação`);
    drawCallout(doc, `${fraseIntensidade(t, intensidade[t])} ${info.performa}`, 'ok');
  });

  infos.forEach((info) => {
    sectionTitle(doc, `O que pode derrubar a performance de ${info.nome}`);
    drawCallout(doc, info.derail, 'alert');
  });

  return finalizeReport(doc, 'Gerado automaticamente pela avaliação DISC');
}

module.exports = {
  generateDiscPdf,
  discFilename,
  contentDispositionFilename,
  resolverPerfilDominante,
  ARQUETIPO_MAP,
};
