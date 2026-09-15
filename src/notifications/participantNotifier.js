// Notifica o PRÓPRIO participante por e-mail com os PDFs de tudo que ele
// preencheu (calculadora, DISC, Meu Porquê) que ainda não foi enviado.
// Substitui a feature anterior de "líderes por empresa" (cadastro manual
// de quem recebia notificação por empresa, removida por pedido explícito
// do usuário — ver CLAUDE.md/CHANGELOG). Agrupa por `email` entre as 3
// tabelas e manda **1 único e-mail** por pessoa, com todos os PDFs
// pendentes anexados — não 1 e-mail por envio.
//
// Roda como uma ROTINA que liga/desliga via botão em admin.html
// (`iniciarRotina`/`pararRotina` abaixo, expostas em
// POST /api/rotina-notificacao/{ativar,desativar}) — não é automática a
// cada envio, nem um botão de disparo único (já passou pelos 2 formatos
// antes deste, os 2 descartados por pedido explícito do usuário). Estado
// (ativa/inativa) fica só em memória — reinicia desligada a cada boot do
// servidor, de propósito (não persiste em banco, pra sempre exigir uma
// ativação manual consciente depois de um deploy/restart).
const { pool } = require('../db');
const { generatePdfAsync } = require('../reports/pdfWorkerPool');
const { discFilename } = require('../reports/discReport');
const { metaComercialFilename } = require('../reports/metaComercialReport');
const { meuPorqueFilename } = require('../reports/meuPorqueReport');
const { enviarEmail } = require('../email');

const NOMES_FERRAMENTA = {
  metas: 'Calculadora de Meta Comercial',
  disc: 'Avaliação DISC',
  meuPorque: 'Meu Porquê',
};

// Texto do e-mail — base fornecida pelo usuário (texto-email.md, na raiz
// do repo, não versionado — material de referência), incrementado a
// pedido ("Incremente o texto e deixe mais elaborado"). Reescrito depois
// pra tirar a 1ª pessoa de quem esteve na palestra — quem dispara o
// e-mail (o usuário, via SMTP_FROM) não é necessariamente quem deu o
// treinamento, então o texto fala da Tática/do treinamento de forma mais
// geral, sem alegar presença pessoal na sala. A parte específica do
// participante/PDFs fica no meio, listando dinamicamente quais
// ferramentas ele completou (pode ser 1, 2 ou as 3).
function montarTextoEmail(itens) {
  const { nome_participante, empresa } = itens[0].row;
  const ferramentas = [...new Set(itens.map((i) => NOMES_FERRAMENTA[i.tipo]))].join(', ');
  const plural = itens.length > 1;

  return (
    'Foi uma alegria enorme ver o quanto vocês se engajaram no treinamento — ' +
    'respondendo aos exercícios, preenchendo as metas e enviando o DISC pro ' +
    'time ali, na hora. Isso mostra que a vontade de estruturar um comercial ' +
    'de verdade é real, e urgente, pra muita gente.\n\n' +
    'Tudo que foi compartilhado ali não é teoria: é o que a Tática vive na ' +
    'prática, com acertos e também com muitos tropeços pelo caminho. Se ' +
    'serviu de inspiração, o objetivo já foi alcançado.\n\n' +
    'Agora vem a parte que realmente importa: colocar em prática. Usem a ' +
    'ferramenta com o time e comecem já na próxima segunda-feira a construir ' +
    'essa cultura comercial — passo a passo, sem pressa, mas com ' +
    'constância.\n\n' +
    `Falando nisso: ${nome_participante}, da ${empresa}, acabou de concluir ` +
    `${ferramentas}. ${plural ? 'Os relatórios completos estão anexados' : 'O relatório completo está anexado'} ` +
    'a este e-mail.\n\n' +
    'E se em algum momento vocês precisarem de uma mão, de trocar uma ideia ' +
    'ou tirar uma dúvida nessa jornada, podem contar com a gente. Ficamos à ' +
    'disposição pra colaborar com o crescimento de cada um.\n\n' +
    'Vamos construir juntos! 🚀'
  );
}

// Gera o PDF de 1 item pendente, no mesmo formato de `data` que as rotas
// POST /api/{metas,disc,meu-porque}/pdf já montam em server.js.
async function gerarPdfItem({ tipo, row }) {
  if (tipo === 'metas') {
    const data = {
      nome_participante: row.nome_participante,
      empresa: row.empresa,
      email: row.email,
      faturamento: row.faturamento,
      crescimento_pct: row.crescimento_pct,
      churn_pct: row.churn_pct,
      meta_anual: row.meta_anual,
      meta_trimestral: row.meta_trimestral,
      meta_mensal: row.meta_mensal,
      ticket: row.ticket,
      contratos_mes: row.contratos_mes,
      conversao_pct: row.conversao_pct,
      contatos_necessarios: row.contatos_necessarios,
      contatos_mes_passado: row.contatos_mes_passado,
      hunter_valor: row.hunter_valor,
      farmer_valor: row.farmer_valor,
      equipe: JSON.parse(row.equipe_json || '[]'),
    };
    return {
      buffer: await generatePdfAsync('metaComercial', data),
      filename: metaComercialFilename(row.nome_participante),
    };
  }

  if (tipo === 'disc') {
    const data = {
      nome_participante: row.nome_participante,
      empresa: row.empresa,
      d_natural: row.d_natural,
      i_natural: row.i_natural,
      s_natural: row.s_natural,
      c_natural: row.c_natural,
      d_adaptado: row.d_adaptado,
      i_adaptado: row.i_adaptado,
      s_adaptado: row.s_adaptado,
      c_adaptado: row.c_adaptado,
      d_intensidade: row.d_intensidade,
      i_intensidade: row.i_intensidade,
      s_intensidade: row.s_intensidade,
      c_intensidade: row.c_intensidade,
    };
    return {
      buffer: await generatePdfAsync('disc', data),
      filename: discFilename(row.nome_participante),
    };
  }

  // meuPorque
  const data = {
    nome_participante: row.nome_participante,
    empresa: row.empresa,
    email: row.email,
    objetivo: row.objetivo,
    sonho: row.sonho,
    mudanca: row.mudanca,
    visao_futuro: row.visao_futuro,
  };
  return {
    buffer: await generatePdfAsync('meuPorque', data),
    filename: meuPorqueFilename(row.nome_participante),
  };
}

// Nomes de tabela literais, nunca vindos de entrada externa — seguro
// interpolar direto no SQL (não dá pra usar parâmetro posicional ($1)
// pra nome de tabela/coluna, só pra valor).
const TABELAS = [
  { tabela: 'metas', tipo: 'metas' },
  { tabela: 'disc_respostas', tipo: 'disc' },
  { tabela: 'meu_porque_respostas', tipo: 'meuPorque' },
];

// Reivindica (UPDATE ... RETURNING) todas as linhas pendentes de 1 tabela
// pra 1 e-mail, de forma atômica — um UPDATE comum já garante isso (as
// linhas afetadas ficam bloqueadas até o commit implícito do próprio
// `pool.query`), sem precisar de FOR UPDATE SKIP LOCKED (esse padrão
// reivindicava 1 linha por vez de uma fila compartilhada; aqui cada
// chamada já mira só as linhas de 1 e-mail específico).
async function reivindicarPendentes(tabela, email) {
  const { rows } = await pool.query(
    `UPDATE ${tabela}
     SET notificado_em = to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
     WHERE email = $1 AND notificado_em IS NULL
     RETURNING *`,
    [email]
  );
  return rows;
}

// Lista os e-mails com pelo menos 1 registro pendente em qualquer das 3
// tabelas — cada um vira 1 e-mail (não 1 por tabela).
async function buscarEmailsPendentes() {
  const { rows } = await pool.query(`
    SELECT DISTINCT email FROM (
      SELECT email FROM metas WHERE notificado_em IS NULL AND email IS NOT NULL AND email <> ''
      UNION
      SELECT email FROM disc_respostas WHERE notificado_em IS NULL AND email IS NOT NULL AND email <> ''
      UNION
      SELECT email FROM meu_porque_respostas WHERE notificado_em IS NULL AND email IS NOT NULL AND email <> ''
    ) pendentes
    ORDER BY email
  `);
  return rows.map((r) => r.email);
}

// Processa 1 participante: reivindica os pendentes dele nas 3 tabelas,
// gera 1 PDF por item e manda tudo junto num e-mail só. Retorna false se
// não sobrou nada pra reivindicar (ex.: outro ciclo da rotina já processou
// esse e-mail entre a listagem e agora).
async function processarParticipante(email) {
  const itens = [];
  for (const { tabela, tipo } of TABELAS) {
    const rows = await reivindicarPendentes(tabela, email);
    rows.forEach((row) => itens.push({ tipo, row }));
  }

  if (itens.length === 0) return false;

  const attachments = await Promise.all(
    itens.map(async (item) => {
      const { buffer, filename } = await gerarPdfItem(item);
      return { filename, content: buffer };
    })
  );

  await enviarEmail({
    to: email,
    subject: `Seus resultados do treinamento — ${itens[0].row.nome_participante}`,
    text: montarTextoEmail(itens),
    attachments,
  });

  return true;
}

async function executarCicloRotina() {
  let emails;
  try {
    emails = await buscarEmailsPendentes();
  } catch (err) {
    console.error('Falha ao buscar pendentes na rotina de notificação:', err.message);
    return;
  }

  for (const email of emails) {
    await processarParticipante(email).catch((err) => {
      console.error(`Falha ao notificar participante ${email}:`, err.message);
    });
  }
}

const INTERVALO_PADRAO_MS = Number(process.env.NOTIFICATION_ROUTINE_INTERVAL_MS) || 120000;
let intervalHandle = null;

// Liga a rotina — roda 1 ciclo imediatamente (não espera o 1º intervalo)
// e depois repete a cada `intervaloMs`. Retorna false se já estava ativa
// (idempotente, evita 2 intervalos rodando em paralelo se o botão for
// clicado 2x seguidas).
function iniciarRotina(intervaloMs = INTERVALO_PADRAO_MS) {
  if (intervalHandle) return false;
  executarCicloRotina().catch((err) => {
    console.error('Falha no 1º ciclo da rotina de notificação:', err.message);
  });
  intervalHandle = setInterval(() => {
    executarCicloRotina().catch((err) => {
      console.error('Falha num ciclo da rotina de notificação:', err.message);
    });
  }, intervaloMs);
  intervalHandle.unref();
  return true;
}

function pararRotina() {
  if (!intervalHandle) return false;
  clearInterval(intervalHandle);
  intervalHandle = null;
  return true;
}

function statusRotina() {
  return { ativa: intervalHandle !== null };
}

module.exports = {
  iniciarRotina,
  pararRotina,
  statusRotina,
  // exportados só pra teste direto, sem esperar o setInterval
  executarCicloRotina,
};
