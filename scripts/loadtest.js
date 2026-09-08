#!/usr/bin/env node
// Teste de carga sintético (autocannon) — resposta concreta pra "nenhum
// teste de carga real foi rodado" (ver seção de robustez em CLAUDE.md).
//
// Nome do arquivo SEM hífen antes de "test" de propósito: `node --test`
// (usado por `npm test`) descobre arquivo de teste sozinho por padrão de
// nome, e um dos padrões é `*-test.js` — chamar isso de "load-test.js"
// fazia o `npm test` rodar esta carga inteira (30s+, contra um servidor
// de verdade) como se fosse mais um teste unitário. Não renomeie de volta
// pra "load-test.js".
// Roda 3 rodadas separadas (páginas estáticas, escrita simples, geração de
// PDF) contra uma URL alvo e imprime requisições/segundo + latência de
// cada uma — números de verdade, não estimativa por leitura de código.
//
// Uso:
//   node scripts/loadtest.js                        # localhost:3000, 50 conexões, 10s cada rodada
//   LOAD_TEST_URL=http://localhost:3999 node scripts/loadtest.js
//   LOAD_TEST_CONNECTIONS=200 LOAD_TEST_DURATION=20 node scripts/loadtest.js
//
// NUNCA aponte isso pra produção sem combinar antes — mesmo com
// DISABLE_RATE_LIMIT=true no servidor alvo (senão o rate limiting mascara
// o resultado, ver src/server.js), uma rajada real de centenas de conexões
// pode degradar um serviço em uso por outras pessoas.
const autocannon = require('autocannon');

const URL = process.env.LOAD_TEST_URL || 'http://localhost:3000';
const CONNECTIONS = Number(process.env.LOAD_TEST_CONNECTIONS) || 50;
const DURATION = Number(process.env.LOAD_TEST_DURATION) || 10;

function run(title, opts) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${title} (${CONNECTIONS} conexões, ${DURATION}s) ===`);
    const instance = autocannon({
      url: URL,
      connections: CONNECTIONS,
      duration: DURATION,
      ...opts,
    }, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    autocannon.track(instance, { renderProgressBar: false });
  });
}

function resumo(result) {
  const erros = result.errors + result.timeouts + result.non2xx;
  console.log([
    `requisições/s: média ${result.requests.average} · p99 ${result.requests.p99}`,
    `latência (ms): média ${result.latency.average} · p99 ${result.latency.p99}`,
    `total: ${result.requests.total} requisições em ${DURATION}s`,
    `erros/timeouts/não-2xx: ${erros}`,
  ].join('\n'));
}

async function main() {
  console.log(`Alvo: ${URL}`);

  const paginas = await run('Páginas estáticas (GET)', {
    requests: [
      { method: 'GET', path: '/' },
      { method: 'GET', path: '/ferramentas.html' },
      { method: 'GET', path: '/calculadora.html' },
      { method: 'GET', path: '/disc.html' },
      { method: 'GET', path: '/meu-porque.html' },
    ],
  });
  resumo(paginas);

  const escritas = await run('Escrita simples (POST /api/metas, /api/disc, /api/meu-porque)', {
    requests: [
      {
        method: 'POST',
        path: '/api/metas',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome_participante: 'Carga Teste', empresa: 'Empresa Teste', faturamento: 100000 }),
      },
      {
        method: 'POST',
        path: '/api/disc',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nome_participante: 'Carga Teste',
          respostas: { a: Object.fromEntries(Array.from({ length: 28 }, (_, i) => [i, { mais: 0, menos: 1 }])), c: {} },
        }),
      },
      {
        method: 'POST',
        path: '/api/meu-porque',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome_participante: 'Carga Teste', objetivo: 'a', sonho: 'b', mudanca: 'c', visao_futuro: 'd' }),
      },
    ],
  });
  resumo(escritas);

  const pdfs = await run('Geração de PDF (as 3 rotas /pdf — o ponto mais caro de CPU)', {
    requests: [
      {
        method: 'POST',
        path: '/api/metas/pdf',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome_participante: 'Carga Teste', faturamento: 100000, crescimento_pct: 20, churn_pct: 5, ticket: 900, conversao_pct: 20 }),
      },
      {
        method: 'POST',
        path: '/api/disc/pdf',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nome_participante: 'Carga Teste',
          respostas: { a: Object.fromEntries(Array.from({ length: 28 }, (_, i) => [i, { mais: 0, menos: 1 }])), c: {} },
        }),
      },
      {
        method: 'POST',
        path: '/api/meu-porque/pdf',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome_participante: 'Carga Teste', objetivo: 'a', sonho: 'b', mudanca: 'c', visao_futuro: 'd' }),
      },
    ],
  });
  resumo(pdfs);
}

main().catch((err) => {
  console.error('Falha no teste de carga:', err.message);
  process.exit(1);
});
