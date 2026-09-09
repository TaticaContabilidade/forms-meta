const path = require('path');
const cluster = require('cluster');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const {
  metaComercialFilename,
  contentDispositionFilename,
} = require('./reports/metaComercialReport');
const {
  discFilename,
  resolverPerfilDominante,
  ARQUETIPO_MAP,
} = require('./reports/discReport');
const { calcNatural, calcAdaptado, calcIntensidade } = require('./discScoring');
const { meuPorqueFilename } = require('./reports/meuPorqueReport');
const { notificarLideresDisc } = require('./notifications/discNotifier');
// Geração de PDF acontece num worker à parte (pdfkit é síncrono/bloqueante
// — ver comentário perto das 3 rotas /pdf), não mais chamando
// generate*Pdf() direto aqui na thread principal.
const { generatePdfAsync } = require('./reports/pdfWorkerPool');
// Pool de conexões Postgres + promise de schema pronto — ver src/db.js.
// Só um require aqui, mesmo com cluster ligado (WEB_CONCURRENCY): cada
// worker forkado reexecuta este arquivo do zero, então cada um também
// reexecuta db.js e abre seu próprio pool, exatamente como cada worker já
// abria sua própria conexão SQLite antes da migração.
const { pool, ready } = require('./db');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'troque-isto';

const app = express();

// Robustez: o Render fica atrás de um proxy reverso — sem isso, `req.ip`
// (usado pelo rate limiting abaixo) enxergaria sempre o IP do proxy, não o
// do participante de verdade, e o limite acabaria valendo pra todo mundo
// junto em vez de por pessoa. `1` confia só no 1º proxy da cadeia
// (X-Forwarded-For), que é exatamente o caso do Render.
app.set('trust proxy', 1);

// Log de requisição (método, rota, status, tempo de resposta) — hoje não
// existe nenhuma visibilidade de latência/erro além do que cada rota loga
// manualmente. Desligado durante os testes (ver tests/server.test.js, que
// seta NODE_ENV=test) pra não poluir a saída do `npm test`.
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :response-time ms - :res[content-length]b'));
}

app.use(express.json());

// Rate limiting — nada impedia uma rajada de requisições (intencional ou
// não) de sobrecarregar a única instância. Limite geral generoso em toda
// /api (uso legítimo, mesmo em pico de palestra, não chega perto disso);
// limite bem mais apertado só nas 3 rotas de PDF, que são as mais caras de
// CPU (pdfkit é síncrono — ver generatePdfAsync/pdfWorkerPool.js).
//
// DISABLE_RATE_LIMIT=true desliga os 2 limites — só pra rodar teste de
// carga (scripts/loadtest.js) contra uma cópia local/staging e medir a
// capacidade de verdade do servidor, sem o limite mascarando o resultado.
// Nunca deve ser setado em produção.
const RATE_LIMITING_ATIVO = process.env.DISABLE_RATE_LIMIT !== 'true';
const semLimite = (req, res, next) => next();

const apiLimiter = RATE_LIMITING_ATIVO
  ? rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Muitas requisições em pouco tempo. Aguarde um instante e tente de novo.' },
    })
  : semLimite;
const pdfLimiter = RATE_LIMITING_ATIVO
  ? rateLimit({
      windowMs: 60 * 1000,
      limit: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Muitos PDFs gerados em pouco tempo. Aguarde um instante e tente de novo.' },
    })
  : semLimite;
app.use('/api/', apiLimiter);

// ---------- QR Code (deve ficar ANTES do express.static) ----------

function qrOpts(width) {
  return { type: 'png', width, margin: 2, color: { dark: '#141920', light: '#FFFFFF' } };
}

// GET /api/qr?url=... → PNG inline
app.get('/api/qr', (req, res) => {
  const target = req.query.url || (req.protocol + '://' + req.get('host') + '/');
  QRCode.toBuffer(target, qrOpts(320))
    .then(png => {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(png);
    })
    .catch(() => res.status(500).json({ error: 'Falha ao gerar QR code.' }));
});

// GET /api/qr/download → força download do PNG (512px)
app.get('/api/qr/download', (req, res) => {
  const target = req.query.url || (req.protocol + '://' + req.get('host') + '/');
  QRCode.toBuffer(target, qrOpts(512))
    .then(png => {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'attachment; filename="qrcode-treinamento.png"');
      res.send(png);
    })
    .catch(() => res.status(500).json({ error: 'Falha ao gerar QR code.' }));
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------- banco ----------
// Conexão, schema (CREATE TABLE) e diagnóstico de boot ficam inteiramente
// em src/db.js — `ready` é a promise que resolve quando as 3 tabelas já
// existem; toda rota abaixo assume que o servidor só aceitou requisições
// depois de `ready` resolver (ver o bloco de `app.listen` no fim deste
// arquivo, e `tests/server.test.js`, que também espera `ready` antes de
// rodar qualquer teste).

// Health check — pra monitoramento externo (uptime, Render health check
// automático). Confirma não só que o processo está de pé, mas que o banco
// responde de verdade (SELECT rápido), sem depender de nenhuma tabela
// específica.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', uptime_s: Math.round(process.uptime()), timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', error: 'Banco de dados não respondeu.' });
  }
});

// ---------- auth simples pro admin ----------
function requireAdmin(req, res, next) {
  const token = req.get('x-admin-token') || req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token de admin inválido. Envie x-admin-token no header ou ?token= na URL.' });
  }
  next();
}

// ---------- rotas metas ----------

// recebe uma submissão da calculadora
app.post('/api/metas', async (req, res) => {
  const b = req.body || {};

  const row = {
    nome_participante: String(b.nome_participante || '').slice(0, 200),
    empresa: String(b.empresa || '').slice(0, 200),
    faturamento: Number(b.faturamento) || 0,
    crescimento_pct: Number(b.crescimento_pct) || 0,
    churn_pct: Number(b.churn_pct) || 0,
    meta_anual: Number(b.meta_anual) || 0,
    meta_trimestral: Number(b.meta_trimestral) || 0,
    meta_mensal: Number(b.meta_mensal) || 0,
    ticket: Number(b.ticket) || 0,
    contratos_mes: Number(b.contratos_mes) || 0,
    conversao_pct: Number(b.conversao_pct) || 0,
    contatos_necessarios: Number(b.contatos_necessarios) || 0,
    contatos_mes_passado: Number(b.contatos_mes_passado) || 0,
    hunter_valor: Number(b.hunter_valor) || 0,
    farmer_valor: Number(b.farmer_valor) || 0,
    equipe_json: JSON.stringify(Array.isArray(b.equipe) ? b.equipe : []),
  };

  if (!row.nome_participante) {
    return res.status(400).json({ error: 'nome_participante é obrigatório.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO metas (
        nome_participante, empresa, faturamento, crescimento_pct, churn_pct,
        meta_anual, meta_trimestral, meta_mensal, ticket, contratos_mes,
        conversao_pct, contatos_necessarios, contatos_mes_passado,
        hunter_valor, farmer_valor, equipe_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id`,
      [
        row.nome_participante, row.empresa, row.faturamento, row.crescimento_pct, row.churn_pct,
        row.meta_anual, row.meta_trimestral, row.meta_mensal, row.ticket, row.contratos_mes,
        row.conversao_pct, row.contatos_necessarios, row.contatos_mes_passado,
        row.hunter_valor, row.farmer_valor, row.equipe_json,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gravar a meta.' });
  }
});

// gera o relatório em PDF da meta comercial preenchida (não salva no banco —
// o participante pode baixar o relatório mesmo sem ter enviado a meta antes)
app.post('/api/metas/pdf', pdfLimiter, async (req, res) => {
  const b = req.body || {};

  const nome_participante = String(b.nome_participante || '').slice(0, 200);
  const empresa = String(b.empresa || '').slice(0, 200);

  const data = {
    nome_participante,
    empresa,
    faturamento: Number(b.faturamento) || 0,
    crescimento_pct: Number(b.crescimento_pct) || 0,
    churn_pct: Number(b.churn_pct) || 0,
    meta_anual: Number(b.meta_anual) || 0,
    meta_trimestral: Number(b.meta_trimestral) || 0,
    meta_mensal: Number(b.meta_mensal) || 0,
    ticket: Number(b.ticket) || 0,
    contratos_mes: Number(b.contratos_mes) || 0,
    conversao_pct: Number(b.conversao_pct) || 0,
    contatos_necessarios: Number(b.contatos_necessarios) || 0,
    contatos_mes_passado: Number(b.contatos_mes_passado) || 0,
    hunter_valor: Number(b.hunter_valor) || 0,
    farmer_valor: Number(b.farmer_valor) || 0,
    equipe: Array.isArray(b.equipe) ? b.equipe : [],
  };

  const filename = metaComercialFilename(nome_participante);
  try {
    const buffer = await generatePdfAsync('metaComercial', data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDispositionFilename(filename));
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar o PDF.' });
  }
});

// lista tudo (admin)
app.get('/api/metas', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM metas ORDER BY id DESC');
    const parsed = result.rows.map(r => ({ ...r, equipe: JSON.parse(r.equipe_json || '[]') }));
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar as metas.' });
  }
});

// exporta CSV (admin) — abre direto no Excel/Sheets
app.get('/api/metas.csv', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM metas ORDER BY id DESC');
    const cols = [
      'id','criado_em','nome_participante','empresa','faturamento','crescimento_pct',
      'churn_pct','meta_anual','meta_trimestral','meta_mensal','ticket','contratos_mes',
      'conversao_pct','contatos_necessarios','contatos_mes_passado','hunter_valor','farmer_valor'
    ];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = cols.join(';');
    const lines = result.rows.map(r => cols.map(c => esc(r[c])).join(';'));
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="metas.csv"');
    res.send('\uFEFF' + csv); // BOM pra acentuação abrir certo no Excel
  } catch (err) {
    res.status(500).json({ error: 'Falha ao exportar as metas.' });
  }
});

// apaga um registro específico (admin) — útil pra remover teste/duplicado
app.delete('/api/metas/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM metas WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Falha ao apagar a meta.' });
  }
});

// ---------- rotas DISC ----------

// recebe resultado de um participante
app.post('/api/disc', async (req, res) => {
  const b = req.body || {};
  const respostas = b.respostas || {};

  // Robustez: nunca confia em d_natural/i_natural/.../intensidade que o
  // cliente mandar no payload — sempre recalcula a partir das respostas
  // cruas, com a mesma lógica de calcNatural()/calcAdaptado()/
  // calcIntensidade() que antes só existia em public/disc.html (ver
  // src/discScoring.js). Antes desta mudança dava pra abrir o console e
  // enviar qualquer d_natural fabricado; o servidor só recalculava
  // perfil_dominante/arquetipo em cima dele, nunca o escore em si.
  //
  // natural e adaptado vêm os 2 de `respostas.a` (item 01 do reteste — ver
  // CLAUDE.md/CHANGELOG): a antiga Parte B (`respostas.b`) foi aposentada.
  const natural = calcNatural(respostas.a);
  const adaptado = calcAdaptado(respostas.a);
  const intensidade = calcIntensidade(respostas.c);

  // perfil_dominante e arquetipo são sempre recalculados a partir dos
  // escores brutos (agora também recalculados, não só recebidos) — nunca
  // gravamos o que o cliente mandou nesses dois campos, para não persistir
  // um resultado calculado por uma versão desatualizada/cacheada do
  // disc.html (ex.: o bug de empate sempre caindo em D por ordem de
  // checagem, e não por resultado real).
  const perfil = resolverPerfilDominante(natural);
  const infos = perfil.traits.map((t) => ARQUETIPO_MAP[t]);

  const row = {
    nome_participante: String(b.nome_participante || '').slice(0, 200),
    empresa: String(b.empresa || '').slice(0, 200),
    d_natural: natural.D,
    i_natural: natural.I,
    s_natural: natural.S,
    c_natural: natural.C,
    d_adaptado: adaptado.D,
    i_adaptado: adaptado.I,
    s_adaptado: adaptado.S,
    c_adaptado: adaptado.C,
    d_intensidade: intensidade.D,
    i_intensidade: intensidade.I,
    s_intensidade: intensidade.S,
    c_intensidade: intensidade.C,
    perfil_dominante: perfil.traits.join('+'),
    arquetipo: infos.map((info) => info.nome).join(' + '),
    respostas_json: JSON.stringify(respostas),
  };

  if (!row.nome_participante) {
    return res.status(400).json({ error: 'nome_participante é obrigatório.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO disc_respostas (
        nome_participante, empresa,
        d_natural, i_natural, s_natural, c_natural,
        d_adaptado, i_adaptado, s_adaptado, c_adaptado,
        d_intensidade, i_intensidade, s_intensidade, c_intensidade,
        perfil_dominante, arquetipo, respostas_json
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING id`,
      [
        row.nome_participante, row.empresa,
        row.d_natural, row.i_natural, row.s_natural, row.c_natural,
        row.d_adaptado, row.i_adaptado, row.s_adaptado, row.c_adaptado,
        row.d_intensidade, row.i_intensidade, row.s_intensidade, row.c_intensidade,
        row.perfil_dominante, row.arquetipo, row.respostas_json,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
    // Sem `await` de propósito — notificar os líderes da empresa (se
    // houver algum cadastrado) não deve atrasar nem derrubar a resposta
    // pro participante. Erros ficam só no log (ver discNotifier.js).
    notificarLideresDisc(row).catch((err) => {
      console.error('Falha ao notificar líderes do DISC:', err.message);
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gravar o resultado DISC.' });
  }
});

// gera o relatório em PDF do perfil DISC (não salva no banco — o
// participante pode baixar o relatório mesmo sem ter enviado o perfil antes)
app.post('/api/disc/pdf', pdfLimiter, async (req, res) => {
  const b = req.body || {};
  const respostas = b.respostas || {};

  // Mesma robustez do POST /api/disc: recalcula os escores a partir das
  // respostas cruas, não confia no que o cliente mandar. perfil_dominante
  // nem é lido do body — generateDiscPdf() (dentro do worker) já sempre
  // recalcula a partir dos escores (nunca usou o que vinha nesse campo,
  // então nem faz diferença esse valor estar certo ou não). natural e
  // adaptado vêm os 2 de `respostas.a` — ver comentário equivalente em
  // POST /api/disc.
  const natural = calcNatural(respostas.a);
  const adaptado = calcAdaptado(respostas.a);
  const intensidade = calcIntensidade(respostas.c);

  const data = {
    nome_participante: String(b.nome_participante || '').slice(0, 200),
    empresa: String(b.empresa || '').slice(0, 200),
    d_natural: natural.D,
    i_natural: natural.I,
    s_natural: natural.S,
    c_natural: natural.C,
    d_adaptado: adaptado.D,
    i_adaptado: adaptado.I,
    s_adaptado: adaptado.S,
    c_adaptado: adaptado.C,
    d_intensidade: intensidade.D,
    i_intensidade: intensidade.I,
    s_intensidade: intensidade.S,
    c_intensidade: intensidade.C,
  };

  const filename = discFilename(data.nome_participante);
  try {
    const buffer = await generatePdfAsync('disc', data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDispositionFilename(filename));
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar o PDF.' });
  }
});

// lista resultados DISC (admin)
app.get('/api/disc', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disc_respostas ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar os resultados DISC.' });
  }
});

// exporta resultados DISC em CSV (admin)
app.get('/api/disc.csv', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM disc_respostas ORDER BY id DESC');
    const cols = [
      'id','criado_em','nome_participante','empresa',
      'd_natural','i_natural','s_natural','c_natural',
      'd_adaptado','i_adaptado','s_adaptado','c_adaptado',
      'd_intensidade','i_intensidade','s_intensidade','c_intensidade',
      'perfil_dominante','arquetipo'
    ];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = cols.join(';');
    const lines = result.rows.map(r => cols.map(c => esc(r[c])).join(';'));
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="disc_respostas.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao exportar os resultados DISC.' });
  }
});

// apaga resultado DISC (admin)
app.delete('/api/disc/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM disc_respostas WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Falha ao apagar o resultado DISC.' });
  }
});

// ---------- rotas líderes por empresa (notificação do DISC) ----------
// Cadastro de quem recebe o e-mail com o perfil DISC de cada empresa (ver
// src/notifications/discNotifier.js) — CRUD simples, mesma autenticação
// (x-admin-token) das outras 3 tabelas, sem sistema de login separado.

app.post('/api/lideres', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const row = {
    empresa: String(b.empresa || '').trim().slice(0, 200),
    nome: String(b.nome || '').trim().slice(0, 200),
    email: String(b.email || '').trim().slice(0, 200),
  };

  if (!row.empresa || !row.email) {
    return res.status(400).json({ error: 'empresa e email são obrigatórios.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO lideres_empresa (empresa, nome, email) VALUES ($1,$2,$3) RETURNING id',
      [row.empresa, row.nome, row.email]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao cadastrar o líder.' });
  }
});

app.get('/api/lideres', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM lideres_empresa ORDER BY empresa, nome');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar os líderes.' });
  }
});

app.delete('/api/lideres/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM lideres_empresa WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Falha ao apagar o líder.' });
  }
});

// ---------- rotas Meu Porquê ----------

// recebe resultado de um participante — sem cálculo nenhum, só grava as
// 4 respostas cruas (dinâmica "simples", ver nova dinamica simples.md)
app.post('/api/meu-porque', async (req, res) => {
  const b = req.body || {};

  const row = {
    nome_participante: String(b.nome_participante || '').slice(0, 200),
    empresa: String(b.empresa || '').slice(0, 200),
    objetivo: String(b.objetivo || '').slice(0, 4000),
    sonho: String(b.sonho || '').slice(0, 4000),
    mudanca: String(b.mudanca || '').slice(0, 4000),
    visao_futuro: String(b.visao_futuro || '').slice(0, 4000),
  };

  if (!row.nome_participante) {
    return res.status(400).json({ error: 'nome_participante é obrigatório.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO meu_porque_respostas (
        nome_participante, empresa, objetivo, sonho, mudanca, visao_futuro
      ) VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id`,
      [row.nome_participante, row.empresa, row.objetivo, row.sonho, row.mudanca, row.visao_futuro]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gravar as respostas.' });
  }
});

// gera o relatório em PDF do Meu Porquê (não salva no banco — o
// participante pode baixar o relatório mesmo sem ter enviado as respostas
// antes, mesmo padrão de POST /api/metas/pdf e POST /api/disc/pdf)
app.post('/api/meu-porque/pdf', pdfLimiter, async (req, res) => {
  const b = req.body || {};

  const data = {
    nome_participante: String(b.nome_participante || '').slice(0, 200),
    empresa: String(b.empresa || '').slice(0, 200),
    objetivo: String(b.objetivo || '').slice(0, 4000),
    sonho: String(b.sonho || '').slice(0, 4000),
    mudanca: String(b.mudanca || '').slice(0, 4000),
    visao_futuro: String(b.visao_futuro || '').slice(0, 4000),
  };

  const filename = meuPorqueFilename(data.nome_participante);
  try {
    const buffer = await generatePdfAsync('meuPorque', data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDispositionFilename(filename));
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar o PDF.' });
  }
});

// lista respostas do Meu Porquê (admin)
app.get('/api/meu-porque', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM meu_porque_respostas ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao listar as respostas.' });
  }
});

// exporta respostas do Meu Porquê em CSV (admin)
app.get('/api/meu-porque.csv', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM meu_porque_respostas ORDER BY id DESC');
    const cols = ['id', 'criado_em', 'nome_participante', 'empresa', 'objetivo', 'sonho', 'mudanca', 'visao_futuro'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = cols.join(';');
    const lines = result.rows.map(r => cols.map(c => esc(r[c])).join(';'));
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="meu_porque_respostas.csv"');
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao exportar as respostas.' });
  }
});

// apaga resposta do Meu Porquê (admin)
app.delete('/api/meu-porque/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM meu_porque_respostas WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Falha ao apagar a resposta.' });
  }
});

// Cluster opcional (desligado por padrão — WEB_CONCURRENCY ausente ou 1 se
// comporta exatamente como antes, um processo só). O plano atual do Render
// (starter) tem CPU fracionária, então ligar isso hoje não ajuda em nada
// (pode até piorar, por causa do overhead de trocar de contexto entre
// processos) — existe pronto pra quando/se o plano for atualizado pra ter
// mais de 1 núcleo de verdade. Cada worker forkado reexecuta este arquivo
// inteiro do zero, então abre seu próprio pool de conexões com o Postgres
// (ao contrário do SQLite/WAL de antes, isso agora também escala entre
// INSTÂNCIAS separadas do Render — várias instâncias, cada uma com seu
// próprio pool, podem apontar pro mesmo Postgres gerenciado ao mesmo tempo;
// ver seção de robustez em CLAUDE.md).
if (require.main === module) {
  const webConcurrency = Number(process.env.WEB_CONCURRENCY) || 1;

  if (webConcurrency > 1 && cluster.isPrimary) {
    console.log(`Cluster: iniciando ${webConcurrency} processos worker (WEB_CONCURRENCY=${webConcurrency})`);
    for (let i = 0; i < webConcurrency; i++) cluster.fork();
    cluster.on('exit', (worker, code, signal) => {
      console.log(`Worker ${worker.process.pid} encerrado (${signal || code}) — reiniciando`);
      cluster.fork();
    });
  } else {
    // Só sobe o servidor HTTP depois que o schema estiver garantidamente
    // criado — sem isso, uma requisição podendo chegar antes da 1ª tabela
    // existir levaria a um erro "relation does not exist" só na pior hora
    // (justo o primeiro request depois do deploy). Erro de conexão/schema
    // já é logado dentro de src/db.js; aqui só decide não subir o
    // listener nesse caso, em vez de subir "pela metade".
    ready
      .then(() => {
        app.listen(PORT, () => {
          const papel = cluster.isWorker ? ` (worker ${process.pid})` : '';
          console.log(`Servidor no ar em http://localhost:${PORT}${papel}`);
          console.log(`Painel admin em http://localhost:${PORT}/admin.html`);
          console.log(`QR Code em    http://localhost:${PORT}/api/qr`);
        });
      })
      .catch(() => process.exit(1));
  }
}

module.exports = app;
