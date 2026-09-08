// Dados e cálculo do perfil DISC — fonte de verdade única pro backend
// recalcular natural/adaptado/intensidade a partir das respostas cruas, em
// vez de confiar nos escores que o cliente mandar no payload. Mesmo motivo
// do ARQUETIPO_MAP duplicado em src/reports/discReport.js: o backend não
// deve depender de nada que o cliente enviou além das respostas em si —
// antes desta mudança, dava pra abrir o console e fabricar um d_natural
// qualquer, e o servidor só recalculava perfil_dominante/arquetipo em cima
// dele (nunca as respostas).
//
// BLOCOS_A/INTENSIDADE_C são cópia fiel dos mesmos arrays em
// public/disc.html — se o conteúdo da avaliação mudar lá, precisa mudar
// aqui também (são intencionalmente duplicados, não importados, porque um
// é código de servidor e o outro é HTML/JS de cliente).
//
// Item 01 do reteste-e-plataforma-ideal.md (ver CLAUDE.md/CHANGELOG): a
// antiga Parte B (16 situações, escala 0..16) foi aposentada — os 2
// perfis agora vêm das mesmas 28 marcações da Parte A. MENOS forma o
// natural, MAIS forma o adaptado, ambos contagens de 0 a 28 (mesma
// escala, nunca negativas).

// Parte A — 28 blocos de escolha forçada (1 palavra em Mais, 1 em Menos)
const BLOCOS_A = [
  { words: [
    { text: 'Decidido: escolho rápido e assumo a consequência', trait: 'D' },
    { text: 'Entusiasmado: contagio as pessoas com energia', trait: 'I' },
    { text: 'Paciente: espero o tempo certo sem me irritar', trait: 'S' },
    { text: 'Preciso: gosto de fazer certo nos detalhes', trait: 'C' },
  ]},
  { words: [
    { text: 'Competitivo: quero vencer e liderar o placar', trait: 'D' },
    { text: 'Sociável: converso com qualquer pessoa facilmente', trait: 'I' },
    { text: 'Leal: fico ao lado de quem confio, mesmo na crise', trait: 'S' },
    { text: 'Criterioso: só sigo quando os dados fecham', trait: 'C' },
  ]},
  { words: [
    { text: 'Assumo o comando quando ninguém decide', trait: 'D' },
    { text: 'Falo em público sem medo e com prazer', trait: 'I' },
    { text: 'Ouço mais do que falo nas reuniões', trait: 'S' },
    { text: 'Pergunto os números antes de opinar', trait: 'C' },
  ]},
  { words: [
    { text: 'Prefiro pedir perdão do que pedir permissão', trait: 'D' },
    { text: 'Prefiro convencer a impor', trait: 'I' },
    { text: 'Prefiro combinar antes de mudar qualquer coisa', trait: 'S' },
    { text: 'Prefiro seguir o procedimento já validado', trait: 'C' },
  ]},
  { words: [
    { text: 'Direto: digo o que penso, sem embalar', trait: 'D' },
    { text: 'Otimista: sempre vejo a saída positiva', trait: 'I' },
    { text: 'Calmo: mantenho a temperatura baixa na pressão', trait: 'S' },
    { text: 'Cuidadoso: reviso antes de entregar', trait: 'C' },
  ]},
  { words: [
    { text: 'Impaciência é meu maior defeito', trait: 'D' },
    { text: 'Falar demais é meu maior defeito', trait: 'I' },
    { text: 'Evitar conflito é meu maior defeito', trait: 'S' },
    { text: 'Perfeccionismo é meu maior defeito', trait: 'C' },
  ]},
  { words: [
    { text: 'Me energiza um desafio grande e difícil', trait: 'D' },
    { text: 'Me energiza reconhecimento e plateia', trait: 'I' },
    { text: 'Me energiza um time unido e previsível', trait: 'S' },
    { text: 'Me energiza dominar um assunto a fundo', trait: 'C' },
  ]},
  { words: [
    { text: 'Odeio perder tempo com reunião longa', trait: 'D' },
    { text: 'Odeio trabalhar sozinho e em silêncio', trait: 'I' },
    { text: 'Odeio mudança repentina de regra', trait: 'S' },
    { text: 'Odeio improviso e informação solta', trait: 'C' },
  ]},
  { words: [
    { text: 'Cobro resultado sem rodeio', trait: 'D' },
    { text: 'Motivo elogiando na frente de todos', trait: 'I' },
    { text: 'Apoio quem está travado, com paciência', trait: 'S' },
    { text: 'Corrijo mostrando o erro no processo', trait: 'C' },
  ]},
  { words: [
    { text: 'Sob pressão eu acelero e assumo', trait: 'D' },
    { text: 'Sob pressão eu falo e mobilizo gente', trait: 'I' },
    { text: 'Sob pressão eu absorvo e sigo firme', trait: 'S' },
    { text: 'Sob pressão eu me recolho e analiso', trait: 'C' },
  ]},
  { words: [
    { text: 'Foco no resultado final', trait: 'D' },
    { text: 'Foco nas pessoas envolvidas', trait: 'I' },
    { text: 'Foco em manter o time estável', trait: 'S' },
    { text: 'Foco na qualidade da entrega', trait: 'C' },
  ]},
  { words: [
    { text: 'Aceito risco alto por retorno alto', trait: 'D' },
    { text: 'Aposto na minha capacidade de convencer', trait: 'I' },
    { text: 'Prefiro ganho menor e mais garantido', trait: 'S' },
    { text: 'Só arrisco depois de simular cenários', trait: 'C' },
  ]},
  { words: [
    { text: 'Firme: mantenho posição mesmo contrariando', trait: 'D' },
    { text: 'Persuasivo: viro o jogo na conversa', trait: 'I' },
    { text: 'Conciliador: busco acordo entre as partes', trait: 'S' },
    { text: 'Lógico: argumento com fato, não emoção', trait: 'C' },
  ]},
  { words: [
    { text: 'Minha agenda é cheia de decisões', trait: 'D' },
    { text: 'Minha agenda é cheia de gente', trait: 'I' },
    { text: 'Minha agenda é rotineira e organizada', trait: 'S' },
    { text: 'Minha agenda tem bloco para analisar', trait: 'C' },
  ]},
  { words: [
    { text: 'Quero autonomia total no meu trabalho', trait: 'D' },
    { text: 'Quero liberdade para criar e circular', trait: 'I' },
    { text: 'Quero clareza de rotina e estabilidade', trait: 'S' },
    { text: 'Quero regras e padrões bem definidos', trait: 'C' },
  ]},
  { words: [
    { text: 'Me irrita indecisão', trait: 'D' },
    { text: 'Me irrita ambiente frio e formal', trait: 'I' },
    { text: 'Me irrita grosseria e briga', trait: 'S' },
    { text: 'Me irrita descuido e desleixo', trait: 'C' },
  ]},
  { words: [
    { text: 'Se der errado, eu mudo a rota na hora', trait: 'D' },
    { text: 'Se der errado, eu chamo gente pra ajudar', trait: 'I' },
    { text: 'Se der errado, eu insisto com constância', trait: 'S' },
    { text: 'Se der errado, eu investigo a causa raiz', trait: 'C' },
  ]},
  { words: [
    { text: 'Sou avaliado pelo que entrego', trait: 'D' },
    { text: 'Sou lembrado pela energia que trago', trait: 'I' },
    { text: 'Sou reconhecido pela confiança que passo', trait: 'S' },
    { text: 'Sou respeitado pelo meu domínio técnico', trait: 'C' },
  ]},
  { words: [
    { text: 'Negocio pressionando e testando limite', trait: 'D' },
    { text: 'Negocio criando clima e relação', trait: 'I' },
    { text: 'Negocio cedendo para preservar a relação', trait: 'S' },
    { text: 'Negocio com planilha e comparativo', trait: 'C' },
  ]},
  { words: [
    { text: 'Meta agressiva me acende', trait: 'D' },
    { text: 'Ranking e campanha me acendem', trait: 'I' },
    { text: 'Meta possível e constante me acende', trait: 'S' },
    { text: 'Meta bem justificada por dado me acende', trait: 'C' },
  ]},
  { words: [
    { text: 'Delego cobrando prazo curto', trait: 'D' },
    { text: 'Delego animando e acompanhando junto', trait: 'I' },
    { text: 'Delego explicando com calma e apoio', trait: 'S' },
    { text: 'Delego com instrução escrita e padrão', trait: 'C' },
  ]},
  { words: [
    { text: 'Tenho pouca paciência com detalhe', trait: 'D' },
    { text: 'Tenho pouca paciência com burocracia', trait: 'I' },
    { text: 'Tenho pouca paciência com pressa desnecessária', trait: 'S' },
    { text: 'Tenho pouca paciência com achismo', trait: 'C' },
  ]},
  { words: [
    { text: 'Meu maior medo é perder o controle', trait: 'D' },
    { text: 'Meu maior medo é ser rejeitado', trait: 'I' },
    { text: 'Meu maior medo é a instabilidade', trait: 'S' },
    { text: 'Meu maior medo é cometer um erro', trait: 'C' },
  ]},
  { words: [
    { text: 'No meu negócio eu puxo o crescimento', trait: 'D' },
    { text: 'No meu negócio eu abro mercado e relaciono', trait: 'I' },
    { text: 'No meu negócio eu sustento a operação', trait: 'S' },
    { text: 'No meu negócio eu organizo e controlo', trait: 'C' },
  ]},
  { words: [
    { text: 'Contrato quem entrega resultado, mesmo difícil de lidar', trait: 'D' },
    { text: 'Contrato quem tem energia e boa comunicação', trait: 'I' },
    { text: 'Contrato quem é leal e fica no time', trait: 'S' },
    { text: 'Contrato quem é técnico e não erra', trait: 'C' },
  ]},
  { words: [
    { text: 'Meu dinheiro eu reinvisto em crescimento agressivo', trait: 'D' },
    { text: 'Meu dinheiro eu coloco em marca, imagem e relacionamento', trait: 'I' },
    { text: 'Meu dinheiro eu guardo como reserva de segurança', trait: 'S' },
    { text: 'Meu dinheiro eu aplico depois de estudar bem', trait: 'C' },
  ]},
  { words: [
    { text: 'Quando discordo, bato de frente na hora', trait: 'D' },
    { text: 'Quando discordo, tento convencer com jeito', trait: 'I' },
    { text: 'Quando discordo, prefiro deixar passar', trait: 'S' },
    { text: 'Quando discordo, junto evidências e apresento depois', trait: 'C' },
  ]},
  { words: [
    { text: 'Sucesso pra mim é ter conquistado território', trait: 'D' },
    { text: 'Sucesso pra mim é ser admirado e lembrado', trait: 'I' },
    { text: 'Sucesso pra mim é ter paz e um time fiel', trait: 'S' },
    { text: 'Sucesso pra mim é ter feito com excelência', trait: 'C' },
  ]},
];

// Intensidade — 12 afirmações (3 por traço). Chamada de "Parte C" no nome
// da variável/funções por convenção histórica do instrumento — a antiga
// Parte B (16 situações) foi aposentada, ver comentário no topo do arquivo.
const INTENSIDADE_C = [
  { trait: 'D' }, { trait: 'D' }, { trait: 'D' },
  { trait: 'I' }, { trait: 'I' }, { trait: 'I' },
  { trait: 'S' }, { trait: 'S' }, { trait: 'S' },
  { trait: 'C' }, { trait: 'C' }, { trait: 'C' },
];

// respostasA: { [bIdx]: { mais: wordIdx, menos: wordIdx } } — escolha
// forçada (ver N-05 no CHANGELOG): só conta o bloco se as 2 estiverem
// definidas e forem palavras diferentes, exatamente como blocoARespondido()
// em public/disc.html.
//
// Item 01 do reteste-e-plataforma-ideal.md (ver CLAUDE.md/CHANGELOG): os 2
// perfis vêm das mesmas 28 marcações — MENOS forma o natural (o que exige
// menos esforço), MAIS forma o adaptado (o que aparece quando o ambiente
// pede diferente). Antes, calcNatural() somava/subtraía Mais(+1)/Menos(-1)
// num único escore (-28..+28) e calcAdaptado() vinha de uma Parte B de 16
// situações (0..16) — 2 escalas incompatíveis. Agora os 2 são só
// contagens (nunca negativas), cada uma de 0 a 28 — mesma escala.
function calcNatural(respostasA) {
  const scores = { D: 0, I: 0, S: 0, C: 0 };
  const ra = respostasA || {};
  BLOCOS_A.forEach((bloco, bIdx) => {
    const r = ra[bIdx];
    if (!r) return;
    const mais = Number(r.mais);
    const menos = Number(r.menos);
    if (!Number.isInteger(mais) || !Number.isInteger(menos) || mais === menos) return;
    const wMenos = bloco.words[menos];
    if (wMenos) scores[wMenos.trait] = (scores[wMenos.trait] || 0) + 1;
  });
  return scores;
}

function calcAdaptado(respostasA) {
  const scores = { D: 0, I: 0, S: 0, C: 0 };
  const ra = respostasA || {};
  BLOCOS_A.forEach((bloco, bIdx) => {
    const r = ra[bIdx];
    if (!r) return;
    const mais = Number(r.mais);
    const menos = Number(r.menos);
    if (!Number.isInteger(mais) || !Number.isInteger(menos) || mais === menos) return;
    const wMais = bloco.words[mais];
    if (wMais) scores[wMais.trait] = (scores[wMais.trait] || 0) + 1;
  });
  return scores;
}

// respostasC: { [aIdx]: nota de 1 a 5 } — média por traço (3 perguntas
// cada), mesmo arredondamento de calcIntensidade() em public/disc.html.
function calcIntensidade(respostasC) {
  const scores = { D: 0, I: 0, S: 0, C: 0 };
  const counts = { D: 0, I: 0, S: 0, C: 0 };
  const rc = respostasC || {};
  INTENSIDADE_C.forEach((item, aIdx) => {
    const v = Number(rc[aIdx]);
    if (!Number.isFinite(v)) return;
    scores[item.trait] += v;
    counts[item.trait]++;
  });
  Object.keys(scores).forEach((t) => {
    scores[t] = counts[t] > 0 ? parseFloat((scores[t] / counts[t]).toFixed(2)) : 0;
  });
  return scores;
}

module.exports = {
  BLOCOS_A,
  INTENSIDADE_C,
  calcNatural,
  calcAdaptado,
  calcIntensidade,
};
