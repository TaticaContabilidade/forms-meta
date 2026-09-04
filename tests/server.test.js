const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ADMIN_TOKEN = 'teste-token-admin';
const dbPath = path.join(os.tmpdir(), `metas-test-${process.pid}-${Date.now()}.db`);

process.env.DB_PATH = dbPath;
process.env.ADMIN_TOKEN = ADMIN_TOKEN;
process.env.PORT = '0';

const request = require('supertest');
const app = require('../src/server');

after(() => {
  for (const ext of ['', '-shm', '-wal']) {
    fs.rmSync(dbPath + ext, { force: true });
  }
});

describe('rotas estáticas', () => {
  test('GET / serve o index.html', async () => {
    const res = await request(app).get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /html/);
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

describe('API /api/disc', () => {
  let createdId;

  const payloadValido = {
    nome_participante: 'Ciclana Souza',
    empresa: 'Empresa Y',
    d_natural: 8, i_natural: 5, s_natural: 3, c_natural: 4,
    d_adaptado: 7, i_adaptado: 6, s_adaptado: 4, c_adaptado: 3,
    d_intensidade: 1, i_intensidade: -1, s_intensidade: 1, c_intensidade: -1,
    perfil_dominante: 'D',
    arquetipo: 'Executor',
    respostas: { bloco1: ['a', 'b'] },
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

  test('GET com token lista os registros e mantém respostas_json serializado', async () => {
    const res = await request(app).get('/api/disc').set('x-admin-token', ADMIN_TOKEN);
    assert.equal(res.status, 200);
    const row = res.body.find(r => r.id === createdId);
    assert.ok(row);
    assert.equal(row.perfil_dominante, 'D');
    assert.equal(row.arquetipo, 'Executor');
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
});
