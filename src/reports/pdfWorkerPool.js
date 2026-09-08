// Pool fixo de worker_threads pra geração de PDF (ver pdfWorker.js) — evita
// tanto gerar na thread principal (bloqueia o event loop pra todo mundo,
// não só quem pediu o PDF) quanto abrir uma thread nova a cada requisição
// (criar uma thread/isolate do zero tem custo — não compensa pra um
// relatório que demora poucos milissegundos pra gerar). Um pool pequeno e
// fixo, reaproveitado entre requisições, é o meio-termo certo pro volume
// esperado aqui.
const { Worker } = require('worker_threads');
const path = require('path');

const WORKER_PATH = path.join(__dirname, 'pdfWorker.js');
const POOL_SIZE = Number(process.env.PDF_WORKER_POOL_SIZE) || 2;

let workers = [];
let pendingByWorker = new WeakMap(); // worker -> Map(requestId -> {resolve, reject})
let nextWorkerIndex = 0;
let requestCounter = 0;

function criarWorker() {
  const worker = new Worker(WORKER_PATH);
  pendingByWorker.set(worker, new Map());

  worker.on('message', (msg) => {
    const pendentes = pendingByWorker.get(worker);
    const entry = pendentes && pendentes.get(msg.id);
    if (!entry) return;
    pendentes.delete(msg.id);
    if (msg.error) entry.reject(new Error(msg.error));
    else entry.resolve(msg.buffer);
  });

  // Se o worker morrer (erro fatal, OOM etc.), rejeita tudo que estava
  // pendente nele e sobe um substituto — sem isso, o pool encolheria pra
  // sempre a cada worker perdido, até não sobrar nenhum.
  worker.on('error', (err) => {
    const pendentes = pendingByWorker.get(worker);
    if (pendentes) {
      pendentes.forEach((entry) => entry.reject(err));
      pendentes.clear();
    }
    substituirWorker(worker);
  });

  return worker;
}

function substituirWorker(worker) {
  const idx = workers.indexOf(worker);
  if (idx === -1) return; // já foi substituído (ex.: closePool() rodou antes)
  workers[idx] = criarWorker();
}

function garantirPool() {
  if (workers.length === 0) {
    workers = Array.from({ length: POOL_SIZE }, criarWorker);
  }
}

// gera 1 PDF num worker do pool, sem bloquear a thread principal.
// `type`: 'metaComercial' | 'disc' | 'meuPorque' (ver GERADORES em
// pdfWorker.js). Retorna uma Promise<Buffer> com o PDF pronto.
function generatePdfAsync(type, data) {
  garantirPool();
  const worker = workers[nextWorkerIndex];
  nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;

  const id = ++requestCounter;
  return new Promise((resolve, reject) => {
    pendingByWorker.get(worker).set(id, { resolve, reject });
    worker.postMessage({ id, type, data });
  });
}

// encerra o pool — usado nos testes (ver tests/server.test.js) pra não
// deixar threads penduradas depois do `node --test` terminar.
async function closePool() {
  await Promise.all(workers.map((w) => w.terminate()));
  workers = [];
}

module.exports = { generatePdfAsync, closePool };
