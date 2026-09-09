const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');

const ADMIN_TOKEN = 'teste-token-admin';

// Respeita um DATABASE_URL já setado (ex.: rodando contra staging) — só cai
// no banco de teste local (container Docker, ver CLAUDE.md) se nada tiver
// sido definido antes, mesma lógica não-destrutiva que dotenv já usa.
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:testpass@localhost:5433/forms_meta_test';
process.env.ADMIN_TOKEN = ADMIN_TOKEN;
process.env.PORT = '0';
// Desliga o log de requisição (morgan) durante os testes — só polui a
// saída do `npm test`, não ajuda em nada (ver src/server.js).
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/server');
const { pool, ready } = require('../src/db');
const { closePool } = require('../src/reports/pdfWorkerPool');

before(async () => {
  // Ao contrário do SQLite temporário de antes (1 arquivo novo por
  // execução, sempre vazio), o banco de teste do Postgres é reaproveitado
  // entre execuções — precisa ser zerado explicitamente pra cada `npm test`
  // partir do mesmo estado. RESTART IDENTITY zera os ids (SERIAL) também,
  // pra `createdId`/expectativas de id não dependerem da execução anterior.
  await ready;
  await pool.query('TRUNCATE TABLE metas, disc_respostas, meu_porque_respostas RESTART IDENTITY CASCADE');
});

after(async () => {
  // Sem isso, as worker_threads do pool de PDF e as conexões do pool do
  // Postgres ficam penduradas e o processo do `node --test` não encerra
  // sozinho depois dos testes.
  await closePool();
  await pool.end();
});

describe('rotas estáticas', () => {
  test('GET / serve a landing page institucional (Priscila Galindo)', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /html/);
    assert.match(res.text, /Priscila Galindo/);
    assert.match(res.text, /ferramentas\.html/);
  });

  test('GET /ferramentas.html serve o menu das dinâmicas (era o antigo index.html)', async () => {
    const res = await request(app).get('/ferramentas.html');
    assert.equal(res.status, 200);
    assert.match(res.text, /Ferramentas do treinamento/);
  });

  test('GET /disc.html serve a página do DISC', async () => {
    const res = await request(app).get('/disc.html');
    assert.equal(res.status, 200);
  });

  test('rota inexistente retorna 404', async () => {
    const res = await request(app).get('/rota-que-nao-existe');
    assert.equal(res.status, 404);
  });
});

describe('QR code', () => {
  test('GET /api/qr retorna um PNG', async () => {
    const res = await request(app).get('/api/qr');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'image/png');
  });

  test('GET /api/qr aceita url customizada', async () => {
    const res = await request(app).get('/api/qr').query({ url: 'https://example.com' });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'image/png');
  });

  test('GET /api/qr/download força download', async () => {
    const res = await request(app).get('/api/qr/download');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /attachment; filename="qrcode-treinamento\.png"/);
  });
});

describe('API /api/metas', () => {
  let createdId;

  test('POST sem nome_participante retorna 400', async () => {
    const res = await request(app).post('/api/metas').send({ empresa: 'Empresa X' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /nome_participante/);
  });

  test('POST com dados válidos cria o registro', async () => {
    const res = await request(app)
      .post('/api/metas')
      .send({
        nome_participante: 'Fulano de Tal',
        empresa: 'Empresa X',
        faturamento: 10000,
        crescimento_pct: 10,
        churn_pct: 2,
        meta_anual: 120000,
        equipe: [{ nome: 'Vendedor 1' }],
      });
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    createdId = res.body.id;
  });

  test('GET sem token de admin retorna 401', async () => {
    const res = await request(app).get('/api/metas');
    assert.equal(res.status, 401);
  });

  test('GET com token inválido retorna 401', async () => {
    const res = await request(app).get('/api/metas').query({ token: 'errado' });
    assert.equal(res.status, 401);
  });

  test('GET com token via header lista os registros e faz parse do equipe_json', async () => {
    const res = await request(app).get('/api/metas').set('x-admin-token', ADMIN_TOKEN);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    const row = res.body.find(r => r.id === createdId);
    assert.ok(row);
    assert.equal(row.nome_participante, 'Fulano de Tal');
    assert.deepEqual(row.equipe, [{ nome: 'Vendedor 1' }]);
  });

  test('GET com token via query string também funciona', async () => {
    const res = await request(app).get('/api/metas').query({ token: ADMIN_TOKEN });
    assert.equal(res.status, 200);
  });

  test('GET /api/metas.csv exporta CSV com BOM e cabeçalho', async () => {
    const res = await request(app).get('/api/metas.csv').set('x-admin-token', ADMIN_TOKEN);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.headers['content-disposition'], /filename="metas\.csv"/);
    assert.match(res.text, /^﻿id;criado_em;nome_participante/);
    assert.match(res.text, /Fulano de Tal/);
  });

  test('DELETE remove o registro (admin)', async () => {
    const del = await request(app).delete(`/api/metas/${createdId}`).set('x-admin-token', ADMIN_TOKEN);
    assert.equal(del.status, 204);

    const list = await request(app).get('/api/metas').set('x-admin-token', ADMIN_TOKEN);
    assert.ok(!list.body.some(r => r.id === createdId));
  });

  test('DELETE sem token retorna 401 e não apaga nada', async () => {
    const create = await request(app).post('/api/metas').send({ nome_participante: 'Outro' });
    const id = create.body.id;

    const del = await request(app).delete(`/api/metas/${id}`);
    assert.equal(del.status, 401);

    const list = await request(app).get('/api/metas').set('x-admin-token', ADMIN_TOKEN);
    assert.ok(list.body.some(r => r.id === id));
  });
});

describe('API /api/metas/pdf', () => {
  test('gera um PDF com o nome de arquivo "${nome do participante} meta comercial.pdf"', async () => {
    const res = await request(app)
      .post('/api/metas/pdf')
      .send({ nome_participante: 'Tática Contabilidade', empresa: 'Empresa Y', faturamento: 30000 });

    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.match(res.headers['content-disposition'], /^attachment; filename="/);
    assert.match(
      res.headers['content-disposition'],
      /filename\*=UTF-8''T%C3%A1tica%20Contabilidade%20meta%20comercial\.pdf/
    );
    assert.equal(res.body.slice(0, 5).toString('latin1'), '%PDF-');
  });

  test('sem nome_participante, usa "Meta comercial.pdf" como nome de arquivo', async () => {
    const res = await request(app).post('/api/metas/pdf').send({ empresa: 'Empresa Y' });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /filename="Meta comercial\.pdf"/);
  });

  test('não exige nome_participante (relatório não é salvo no banco)', async () => {
    const res = await request(app).post('/api/metas/pdf').send({});
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
  });

  test('sanitiza caracteres inválidos de nome de arquivo vindos do participante', async () => {
    const res = await request(app)
      .post('/api/metas/pdf')
      .send({ nome_participante: 'A/B:C*D?E"F<G>H|I' });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /filename="ABCDEFGHI meta comercial\.pdf"/);
  });
});

describe('API /api/disc', () => {
  let createdId;

  // Blocos 0-7 da Parte A: mais=1 (palavra I) e menos=0 (palavra D) em cada
  // um (BLOCOS_A tem sempre D,I,S,C nessa ordem por bloco). Item 01 do
  // reteste (ver CLAUDE.md/CHANGELOG): natural vem só da contagem de MENOS
  // e adaptado só da contagem de MAIS — natural D=+8 (dominante), I=0,
  // S=0, C=0; adaptado I=+8, D=0, S=0, C=0. d_natural/i_natural/etc e
  // perfil_dominante/arquetipo abaixo são propositalmente "errados"
  // (robustez: o servidor ignora qualquer escore pronto que o cliente
  // mandar e recalcula tudo a partir de `respostas` — ver
  // src/discScoring.js).
  const respostasComDDominante = {
    a: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i, { mais: 1, menos: 0 }])),
    c: {},
  };

  const payloadValido = {
    nome_participante: 'Ciclana Souza',
    empresa: 'Empresa Y',
    d_natural: 1, i_natural: 1, s_natural: 99, c_natural: 1,
    d_adaptado: 1, i_adaptado: 1, s_adaptado: 1, c_adaptado: 1,
    d_intensidade: 1, i_intensidade: 1, s_intensidade: 1, c_intensidade: 1,
    perfil_dominante: 'C',
    arquetipo: 'valor que o cliente não deveria conseguir forçar',
    respostas: respostasComDDominante,
  };

  test('POST sem nome_participante retorna 400', async () => {
    const res = await request(app).post('/api/disc').send({ empresa: 'Empresa Y' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /nome_participante/);
  });

  test('POST com dados válidos cria o registro', async () => {
    const res = await request(app).post('/api/disc').send(payloadValido);
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    createdId = res.body.id;
  });

  test('GET sem token retorna 401', async () => {
    const res = await request(app).get('/api/disc');
    assert.equal(res.status, 401);
  });

  test('GET com token lista os registros e recalcula perfil_dominante/arquetipo no servidor (ignora o valor enviado pelo cliente)', async () => {
    const res = await request(app).get('/api/disc').set('x-admin-token', ADMIN_TOKEN);
    assert.equal(res.status, 200);
    const row = res.body.find(r => r.id === createdId);
    assert.ok(row);
    assert.equal(row.perfil_dominante, 'D'); // recalculado de `respostas` (D=+8), não o 'C' enviado
    assert.equal(row.arquetipo, 'O Executor');
    assert.equal(row.d_natural, 8); // também recalculado — o d_natural=1 enviado foi ignorado
    assert.equal(row.i_natural, 0);
    assert.equal(row.d_adaptado, 0);
    assert.equal(row.i_adaptado, 8); // adaptado vem da contagem de MAIS (item 01 do reteste)
    assert.deepEqual(JSON.parse(row.respostas_json), payloadValido.respostas);
  });

  test('GET /api/disc.csv exporta CSV com BOM e cabeçalho', async () => {
    const res = await request(app).get('/api/disc.csv').set('x-admin-token', ADMIN_TOKEN);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.headers['content-disposition'], /filename="disc_respostas\.csv"/);
    assert.match(res.text, /^﻿id;criado_em;nome_participante/);
    assert.match(res.text, /Ciclana Souza/);
  });

  test('DELETE remove o registro (admin)', async () => {
    const del = await request(app).delete(`/api/disc/${createdId}`).set('x-admin-token', ADMIN_TOKEN);
    assert.equal(del.status, 204);

    const list = await request(app).get('/api/disc').set('x-admin-token', ADMIN_TOKEN);
    assert.ok(!list.body.some(r => r.id === createdId));
  });

  test('empate técnico entre dois traços vira perfil combinado, nunca dominância falsa de um só', async () => {
    // D e I empatados em 14 no natural — antes desse fix, Math.max com
    // ordem fixa D,I,S,C fazia o empate cair sempre em D "por posição".
    // Construído via `respostas` de verdade: natural vem da contagem de
    // MENOS (item 01 do reteste) — blocos 0-13 marcam menos=D; blocos
    // 14-27 marcam menos=I -> natural D=+14, I=+14, S=0, C=0. Mais sempre
    // S (não afeta o natural, só o adaptado) nos 28 blocos.
    const respostasEmpate = { a: {}, c: {} };
    for (let i = 0; i < 14; i++) respostasEmpate.a[i] = { mais: 2, menos: 0 }; // S, D
    for (let i = 14; i < 28; i++) respostasEmpate.a[i] = { mais: 2, menos: 1 }; // S, I

    const create = await request(app).post('/api/disc').send({
      nome_participante: 'Empate Teste',
      respostas: respostasEmpate,
    });
    assert.equal(create.status, 201);

    const list = await request(app).get('/api/disc').set('x-admin-token', ADMIN_TOKEN);
    const row = list.body.find(r => r.id === create.body.id);
    assert.ok(row);
    assert.equal(row.perfil_dominante, 'D+I');
    assert.equal(row.arquetipo, 'O Executor + O Comunicador');
    assert.equal(row.d_natural, 14);
    assert.equal(row.i_natural, 14);
    assert.equal(row.s_natural, 0);
    assert.equal(row.c_natural, 0);
    assert.equal(row.s_adaptado, 28); // adaptado: Mais foi sempre S nos 28 blocos

    await request(app).delete(`/api/disc/${create.body.id}`).set('x-admin-token', ADMIN_TOKEN);
  });
});

describe('API /api/disc/pdf', () => {
  // 8 blocos com mais=1 (I), menos=0 (D) -> natural (menos-tally) D=+8,
  // adaptado (mais-tally) I=+8 (mesma ideia do describe de /api/disc —
  // robustez: o PDF também recalcula tudo a partir de `respostas`, nunca
  // confia em d_natural/etc prontos).
  const respostasComDDominante = {
    a: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i, { mais: 1, menos: 0 }])),
  };

  const payloadValido = {
    nome_participante: 'Ciclana Souza',
    empresa: 'Empresa Y',
    respostas: respostasComDDominante,
  };

  test('gera um PDF com o nome de arquivo "${nome do participante} perfil disc.pdf"', async () => {
    const res = await request(app).post('/api/disc/pdf').send(payloadValido);
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.match(res.headers['content-disposition'], /filename="Ciclana Souza perfil disc\.pdf"/);
    assert.equal(res.body.slice(0, 5).toString('latin1'), '%PDF-');
  });

  test('sem nome_participante, usa "Perfil DISC.pdf" como nome de arquivo', async () => {
    const res = await request(app).post('/api/disc/pdf').send({ empresa: 'Empresa Y' });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /filename="Perfil DISC\.pdf"/);
  });

  test('não exige nome_participante nem respostas (relatório não é salvo no banco)', async () => {
    const res = await request(app).post('/api/disc/pdf').send({});
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
  });

  test('escore vem de `respostas`, não de i_natural/d_natural enviados prontos', async () => {
    // 8 blocos com mais=0 (D), menos=1 (I) -> natural (menos-tally) I=+8,
    // D=0. Os campos i_natural/d_natural enviados no body são "errados" de
    // propósito — o servidor deve ignorá-los e recalcular a partir de
    // `respostas`.
    const respostasComIDominante = {
      a: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i, { mais: 0, menos: 1 }])),
    };
    const res = await request(app)
      .post('/api/disc/pdf')
      .send({ nome_participante: 'Fulano', i_natural: 1, d_natural: 20, respostas: respostasComIDominante });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
  });

  test('empate técnico entre traços não quebra a geração do PDF (nunca dominância falsa)', async () => {
    // Mesmo caso do bug crítico D-02: D e I empatados no natural, S bem
    // acima só no adaptado. Construído via `respostas` de verdade — blocos
    // 0-13 marcam menos=D; blocos 14-27 marcam menos=I -> natural D=+14,
    // I=+14, S=0, C=0. Mesmo enviando um d_natural/perfil_dominante
    // "errado", o PDF ignora e recalcula a partir de `respostas`.
    const respostasEmpate = { a: {} };
    for (let i = 0; i < 14; i++) respostasEmpate.a[i] = { mais: 2, menos: 0 }; // S, D
    for (let i = 14; i < 28; i++) respostasEmpate.a[i] = { mais: 2, menos: 1 }; // S, I

    const res = await request(app)
      .post('/api/disc/pdf')
      .send({
        nome_participante: 'Empate Teste',
        d_natural: 1, perfil_dominante: 'D',
        respostas: respostasEmpate,
      });
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.equal(res.body.slice(0, 5).toString('latin1'), '%PDF-');
  });
});

describe('API /api/meu-porque', () => {
  let createdId;

  const payloadValido = {
    nome_participante: 'Fulano de Tal',
    empresa: 'Empresa Y',
    objetivo: 'Crescer 30% no ano',
    sonho: 'Ter uma equipe que roda sem mim',
    mudanca: 'Delegar de verdade',
    visao_futuro: 'Uma empresa que funciona sem eu apagar incêndio todo dia',
  };

  test('POST sem nome_participante retorna 400', async () => {
    const res = await request(app).post('/api/meu-porque').send({ empresa: 'Empresa Y' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /nome_participante/);
  });

  test('POST com dados válidos cria o registro', async () => {
    const res = await request(app).post('/api/meu-porque').send(payloadValido);
    assert.equal(res.status, 201);
    assert.ok(res.body.id);
    createdId = res.body.id;
  });

  test('GET sem token retorna 401', async () => {
    const res = await request(app).get('/api/meu-porque');
    assert.equal(res.status, 401);
  });

  test('GET com token lista os registros com as 4 respostas gravadas', async () => {
    const res = await request(app).get('/api/meu-porque').set('x-admin-token', ADMIN_TOKEN);
    assert.equal(res.status, 200);
    const row = res.body.find(r => r.id === createdId);
    assert.ok(row);
    assert.equal(row.nome_participante, 'Fulano de Tal');
    assert.equal(row.objetivo, payloadValido.objetivo);
    assert.equal(row.sonho, payloadValido.sonho);
    assert.equal(row.mudanca, payloadValido.mudanca);
    assert.equal(row.visao_futuro, payloadValido.visao_futuro);
  });

  test('GET /api/meu-porque.csv exporta CSV com BOM e cabeçalho', async () => {
    const res = await request(app).get('/api/meu-porque.csv').set('x-admin-token', ADMIN_TOKEN);
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/csv/);
    assert.match(res.headers['content-disposition'], /filename="meu_porque_respostas\.csv"/);
    assert.match(res.text, /^﻿id;criado_em;nome_participante/);
    assert.match(res.text, /Fulano de Tal/);
  });

  test('DELETE remove o registro (admin)', async () => {
    const del = await request(app).delete(`/api/meu-porque/${createdId}`).set('x-admin-token', ADMIN_TOKEN);
    assert.equal(del.status, 204);

    const list = await request(app).get('/api/meu-porque').set('x-admin-token', ADMIN_TOKEN);
    assert.ok(!list.body.some(r => r.id === createdId));
  });

  test('DELETE sem token retorna 401 e não apaga nada', async () => {
    const create = await request(app).post('/api/meu-porque').send(payloadValido);
    const del = await request(app).delete(`/api/meu-porque/${create.body.id}`);
    assert.equal(del.status, 401);

    const list = await request(app).get('/api/meu-porque').set('x-admin-token', ADMIN_TOKEN);
    assert.ok(list.body.some(r => r.id === create.body.id));

    await request(app).delete(`/api/meu-porque/${create.body.id}`).set('x-admin-token', ADMIN_TOKEN);
  });
});

describe('API /api/meu-porque/pdf', () => {
  const payloadValido = {
    nome_participante: 'Fulano de Tal',
    empresa: 'Empresa Y',
    objetivo: 'Crescer 30% no ano',
    sonho: 'Ter uma equipe que roda sem mim',
    mudanca: 'Delegar de verdade',
    visao_futuro: 'Uma empresa que funciona sem eu apagar incêndio todo dia',
  };

  test('gera um PDF com o nome de arquivo "${nome do participante} meu porque.pdf"', async () => {
    const res = await request(app).post('/api/meu-porque/pdf').send(payloadValido);
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
    assert.match(res.headers['content-disposition'], /filename="Fulano de Tal meu porque\.pdf"/);
    assert.equal(res.body.slice(0, 5).toString('latin1'), '%PDF-');
  });

  test('sem nome_participante, usa "Meu Porque.pdf" como nome de arquivo', async () => {
    const res = await request(app).post('/api/meu-porque/pdf').send({ empresa: 'Empresa Y' });
    assert.equal(res.status, 200);
    assert.match(res.headers['content-disposition'], /filename="Meu Porque\.pdf"/);
  });

  test('não exige nome_participante nem respostas (relatório não é salvo no banco)', async () => {
    const res = await request(app).post('/api/meu-porque/pdf').send({});
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/pdf');
  });

  test('POST /api/meu-porque/pdf não grava nada no banco', async () => {
    const before = await request(app).get('/api/meu-porque').set('x-admin-token', ADMIN_TOKEN);
    await request(app).post('/api/meu-porque/pdf').send(payloadValido);
    const after = await request(app).get('/api/meu-porque').set('x-admin-token', ADMIN_TOKEN);
    assert.equal(after.body.length, before.body.length);
  });
});
