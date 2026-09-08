// Worker de geração de PDF — roda numa thread separada da que atende as
// requisições HTTP (ver pdfWorkerPool.js). pdfkit é síncrono/bloqueante
// (medição de texto, paginação etc. rodam na mesma tick) — gerar direto no
// handler da requisição travava o event loop inteiro durante a geração,
// não só pra quem pediu aquele PDF (ver CLAUDE.md, seção de robustez).
const { parentPort } = require('worker_threads');
const { generateMetaComercialPdf } = require('./metaComercialReport');
const { generateDiscPdf } = require('./discReport');
const { generateMeuPorquePdf } = require('./meuPorqueReport');

const GERADORES = {
  metaComercial: generateMetaComercialPdf,
  disc: generateDiscPdf,
  meuPorque: generateMeuPorquePdf,
};

parentPort.on('message', ({ id, type, data }) => {
  try {
    const gerar = GERADORES[type];
    if (!gerar) throw new Error(`Tipo de relatório desconhecido: ${type}`);

    const doc = gerar(data);
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => {
      parentPort.postMessage({ id, buffer: Buffer.concat(chunks) });
    });
    doc.on('error', (err) => {
      parentPort.postMessage({ id, error: err.message });
    });
  } catch (err) {
    parentPort.postMessage({ id, error: err.message });
  }
});
