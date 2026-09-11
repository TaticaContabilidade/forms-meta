// Notifica os líderes cadastrados pra uma empresa (tabela lideres_empresa,
// ver src/db.js) quando um colaborador daquela empresa preenche o DISC —
// pedido explícito do usuário: "quando o colaborador preencher a dinâmica
// disc ela caia para os participantes" (aqui, "participantes" = chefes/
// líderes técnicos, responsáveis por decidir alocação de pessoas com base
// no perfil).
//
// O disparo é MANUAL — um botão "Notificar pendentes" em admin.html chama
// POST /api/disc/notificar-pendentes (ver processarNotificacoesPendentes
// abaixo), não dispara sozinho a cada POST /api/disc nem roda num job
// agendado (as duas abordagens já foram tentadas e descartadas por pedido
// explícito do usuário — ver CHANGELOG).
const { pool } = require('../db');
const { generatePdfAsync } = require('../reports/pdfWorkerPool');
const { discFilename } = require('../reports/discReport');
const { enviarEmail } = require('../email');

// Texto do e-mail — base fornecida pelo usuário (texto-email.md, na raiz
// do repo, não versionado — mesma convenção de material de referência
// solto do CLAUDE.md), incrementado a pedido (nota no fim do arquivo:
// "Incremente o texto e deixe mais elaborado"). A parte específica do
// colaborador/PDF fica inserida no meio, entre o parágrafo de "coloquem
// em prática" e o de encerramento — o resto é o texto motivacional
// original.
function montarTextoEmail(row) {
  return (
    'Foi uma alegria enorme dividir esse momento com vocês. Ver a sala inteira ' +
    'engajada — respondendo aos exercícios, preenchendo as metas e enviando o ' +
    'DISC pro time ali, na hora — me mostrou que a vontade de estruturar um ' +
    'comercial de verdade é real, e urgente, pra muita gente.\n\n' +
    'Tudo que compartilhei não é teoria: é o que vivemos na prática, com ' +
    'acertos e também com muitos tropeços pelo caminho. Se serviu de ' +
    'inspiração, meu trabalho já valeu a pena.\n\n' +
    'Agora vem a parte que realmente importa: colocar em prática. Usem a ' +
    'ferramenta com o time e comecem já na próxima segunda-feira a construir ' +
    'essa cultura comercial — passo a passo, sem pressa, mas com ' +
    'constância.\n\n' +
    `Falando nisso: ${row.nome_participante}, da ${row.empresa}, acabou de ` +
    'concluir a avaliação DISC. O perfil comportamental completo — natural, ' +
    'adaptado e a intensidade de cada traço — está no PDF anexado a este ' +
    'e-mail, pronto pra apoiar as próximas decisões de alocação e ' +
    'desenvolvimento do time.\n\n' +
    'E se em algum momento vocês precisarem de uma mão, de trocar uma ideia ' +
    'ou tirar uma dúvida nessa jornada, podem contar comigo. Fico à ' +
    'disposição pra colaborar com o crescimento de cada um.\n\n' +
    'Vamos construir juntos! 🚀'
  );
}

async function notificarLideresDisc(row) {
  const { rows: lideres } = await pool.query(
    'SELECT nome, email FROM lideres_empresa WHERE empresa = $1',
    [row.empresa]
  );
  if (lideres.length === 0) return;

  // Mesmo shape de `data` que POST /api/disc/pdf monta pro worker — sem
  // perfil_dominante/arquetipo, porque generateDiscPdf sempre recalcula
  // isso a partir dos escores (ver comentário em server.js).
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

  const pdfBuffer = await generatePdfAsync('disc', data);
  const filename = discFilename(row.nome_participante);

  await Promise.all(
    lideres.map((lider) =>
      enviarEmail({
        to: lider.email,
        subject: `Novo perfil DISC: ${row.nome_participante} (${row.empresa})`,
        text: montarTextoEmail(row),
        attachments: [{ filename, content: pdfBuffer }],
      }).catch((err) => {
        console.error(`Falha ao notificar líder ${lider.email} (${row.empresa}):`, err.message);
      })
    )
  );
}

// Máximo de linhas pendentes processadas numa única chamada — evita que um
// acúmulo grande prenda a requisição do botão por tempo desproporcional;
// se sobrar mais que isso, o admin só precisa clicar "Notificar pendentes"
// de novo.
const LOTE_MAXIMO_POR_EXECUCAO = 200;

// Reivindica 1 linha pendente (notificado_em IS NULL) de forma atômica —
// `FOR UPDATE SKIP LOCKED` evita que duas chamadas concorrentes (ex.: 2
// cliques rápidos no botão) processem a mesma linha 2 vezes. Marca a linha
// como notificada no mesmo instante em que a reivindica, não só depois do
// e-mail sair — troca "nunca perder uma notificação mesmo se o SMTP
// falhar" por "nunca notificar a mesma linha duas vezes". Erro de envio de
// verdade (SMTP fora do ar etc.) só é logado (ver notificarLideresDisc),
// sem retry automático — o admin pode reprocessar manualmente se quiser
// (removeria a marcação direto no banco, não há UI pra isso hoje).
async function reivindicarProximaLinhaPendente() {
  const { rows } = await pool.query(`
    UPDATE disc_respostas
    SET notificado_em = to_char(now(), 'YYYY-MM-DD HH24:MI:SS')
    WHERE id = (
      SELECT id FROM disc_respostas
      WHERE notificado_em IS NULL
      ORDER BY id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  return rows[0] || null;
}

// Chamada pelo botão "Notificar pendentes" (POST /api/disc/notificar-
// pendentes, ver server.js) — processa todas as linhas pendentes de uma
// vez (até o limite acima) e retorna quantas foram processadas.
async function processarNotificacoesPendentes() {
  let processadas = 0;
  for (; processadas < LOTE_MAXIMO_POR_EXECUCAO; processadas++) {
    const row = await reivindicarProximaLinhaPendente();
    if (!row) break;
    await notificarLideresDisc(row).catch((err) => {
      console.error(`Falha ao processar notificação do DISC id=${row.id}:`, err.message);
    });
  }
  return processadas;
}

module.exports = { notificarLideresDisc, processarNotificacoesPendentes };
