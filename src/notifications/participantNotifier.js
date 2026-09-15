// Notifica por e-mail quem preencheu "Meu Porquê" — essa tabela é a
// REFERÊNCIA de destinatário válido (pedido explícito do usuário: "Sua
// tabela de referências para email será a Meu Porquê"). Pra cada
// (email, empresa) pendente em `meu_porque_respostas`, manda 1 e-mail
// só com:
//   1. o(s) PDF(s) do próprio Meu Porquê dessa pessoa (por e-mail);
//   2. o(s) PDF(s) da própria Calculadora de Meta, SE ela também
//      preencheu com o mesmo e-mail (por e-mail);
//   3. os PDFs de DISC de TODOS os colaboradores da MESMA EMPRESA — não
//      só os dela (por empresa, já que o DISC normalmente é preenchido
//      pelo time, não por quem faz o Meu Porquê).
// Substitui tanto a feature de "líderes por empresa" (cadastro manual,
// removida) quanto o desenho anterior de "notifica quem preencheu
// qualquer uma das 3, agrupado só por e-mail" — os 2 descartados por
// pedido explícito do usuário, ver CHANGELOG.
//
// Roda como uma ROTINA que liga/desliga via botão em admin.html
// (`iniciarRotina`/`pararRotina` abaixo, expostas em
// POST /api/rotina-notificacao/{ativar,desativar}). Estado (ativa/
// inativa) fica só em memória — reinicia desligada a cada boot.
//
// Limitação conhecida: como o destinatário só é identificado a partir de
// linhas PENDENTES de `meu_porque_respostas`, depois que o Meu Porquê de
// alguém já foi processado 1 vez, ela não é mais "descoberta" como
// destinatário — novos DISCs da mesma empresa que chegarem depois disso
// só seriam enviados se essa pessoa preencher o Meu Porquê de novo (ou
// outra pessoa da mesma empresa preencher o dela pela 1ª vez). Não
// resolvido de propósito — não foi pedido, e mudar isso significaria
// rastrear notificação por (destinatário, linha) em vez de só por linha.
const { pool } = require('../db');
const { generatePdfAsync } = require('../reports/pdfWorkerPool');
const { discFilename } = require('../reports/discReport');
const { metaComercialFilename } = require('../reports/metaComercialReport');
const { meuPorqueFilename } = require('../reports/meuPorqueReport');
const { enviarEmail } = require('../email');

// Texto do e-mail — base fornecida pelo usuário (texto-email.md, na raiz
// do repo, não versionado — material de referência), incrementado e
// depois reescrito pra tirar a 1ª pessoa de quem esteve na palestra
// (quem dispara o e-mail via SMTP_FROM não é necessariamente quem deu o
// treinamento). A parte específica dos anexos descreve dinamicamente o
// que foi incluído — pode ser só o Meu Porquê, ou também a Calculadora,
// e/ou os DISCs da equipe.
function montarTextoEmail(recipiente, itens) {
  const { empresa } = recipiente;
  const temMeuPorque = itens.some((i) => i.tipo === 'meuPorque');
  const temMetas = itens.some((i) => i.tipo === 'metas');
  const discs = itens.filter((i) => i.tipo === 'disc');

  const partes = [];
  if (temMeuPorque) partes.push('o seu Meu Porquê');
  if (temMetas) partes.push('a sua Calculadora de Meta Comercial');
  if (discs.length === 1) partes.push(`o perfil DISC de 1 colaborador da ${empresa}`);
  else if (discs.length > 1) partes.push(`os perfis DISC de ${discs.length} colaboradores da ${empresa}`);

  const listaAnexos = partes.length > 1
    ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1]
    : partes[0];

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
    `Falando nisso: segue anexado ${listaAnexos}. Os relatórios completos ` +
    'estão anexados a este e-mail.\n\n' +
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

// Reivindica (UPDATE ... RETURNING) atomicamente as linhas pendentes de 1
// tabela que batem com `whereClause` — um UPDATE comum já garante isso
// (as linhas afetadas ficam bloqueadas até o commit implícito do próprio
// `pool.query`), sem precisar de FOR UPDATE SKIP LOCKED. Nome de tabela é
// sempre um literal fixo no código (nunca vindo de entrada externa) —
// seguro interpolar direto no SQL, já que não dá pra usar parâmetro
// posicional ($1) pra nome de tabela/coluna, só pra valor.
async function reivindicarPendentes(tabela, whereClause, params) {
  const { rows } = await pool.query(
    `UPDATE ${tabela}
     SET notificado_em = to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
     WHERE ${whereClause} AND notificado_em IS NULL
     RETURNING *`,
    params
  );
  return rows;
}

// Lista os destinatários válidos: (email, empresa, nome) distintos com
// pelo menos 1 Meu Porquê ainda não processado. Só quem tem uma linha
// pendente em `meu_porque_respostas` vira destinatário — é a tabela de
// referência, ver comentário no topo do arquivo.
async function buscarRecipientesPendentes() {
  const { rows } = await pool.query(`
    SELECT DISTINCT ON (email, empresa) email, empresa, nome_participante
    FROM meu_porque_respostas
    WHERE notificado_em IS NULL AND email IS NOT NULL AND email <> ''
    ORDER BY email, empresa, id
  `);
  return rows;
}

// Processa 1 destinatário: reivindica o(s) Meu Porquê dele (por e-mail +
// empresa exatos), a Calculadora dele (por e-mail) e os DISCs de toda a
// empresa (por empresa) — gera 1 PDF por item e manda tudo junto num
// e-mail só. Retorna false se não sobrou nada pra reivindicar (ex.: outro
// ciclo da rotina já processou esse destinatário entre a listagem e
// agora).
async function processarRecipiente(recipiente) {
  const { email, empresa } = recipiente;
  const itens = [];

  const porques = await reivindicarPendentes('meu_porque_respostas', 'email = $1 AND empresa = $2', [email, empresa]);
  porques.forEach((row) => itens.push({ tipo: 'meuPorque', row }));

  const metas = await reivindicarPendentes('metas', 'email = $1', [email]);
  metas.forEach((row) => itens.push({ tipo: 'metas', row }));

  const discs = await reivindicarPendentes('disc_respostas', 'empresa = $1', [empresa]);
  discs.forEach((row) => itens.push({ tipo: 'disc', row }));

  if (itens.length === 0) return false;

  const attachments = await Promise.all(
    itens.map(async (item) => {
      const { buffer, filename } = await gerarPdfItem(item);
      return { filename, content: buffer };
    })
  );

  await enviarEmail({
    to: email,
    subject: `Materiais do treinamento — ${recipiente.nome_participante} (${empresa})`,
    text: montarTextoEmail(recipiente, itens),
    attachments,
  });

  return true;
}

async function executarCicloRotina() {
  let recipientes;
  try {
    recipientes = await buscarRecipientesPendentes();
  } catch (err) {
    console.error('Falha ao buscar pendentes na rotina de notificação:', err.message);
    return;
  }

  for (const recipiente of recipientes) {
    await processarRecipiente(recipiente).catch((err) => {
      console.error(`Falha ao notificar ${recipiente.email} (${recipiente.empresa}):`, err.message);
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
