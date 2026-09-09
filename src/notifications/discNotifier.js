// Notifica os líderes cadastrados pra uma empresa (tabela lideres_empresa,
// ver src/db.js) sempre que um colaborador daquela empresa preenche o
// DISC — pedido explícito do usuário: "quando o colaborador preencher a
// dinâmica disc ela caia para os participantes" (aqui, "participantes" =
// chefes/líderes técnicos, responsáveis por decidir alocação de pessoas
// com base no perfil).
//
// Chamada em src/server.js SEM `await` no caminho de resposta do POST
// /api/disc — a submissão do participante nunca deve demorar ou falhar
// por causa de um problema de e-mail. Erros daqui só são logados.
const { pool } = require('../db');
const { generatePdfAsync } = require('../reports/pdfWorkerPool');
const { discFilename } = require('../reports/discReport');
const { enviarEmail } = require('../email');

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
        text:
          `${row.nome_participante}, da ${row.empresa}, acabou de preencher a avaliação DISC.\n\n` +
          `Perfil dominante: ${row.perfil_dominante}\n` +
          `Arquétipo: ${row.arquetipo}\n\n` +
          `O relatório completo está anexado em PDF.`,
        attachments: [{ filename, content: pdfBuffer }],
      }).catch((err) => {
        console.error(`Falha ao notificar líder ${lider.email} (${row.empresa}):`, err.message);
      })
    )
  );
}

module.exports = { notificarLideresDisc };
