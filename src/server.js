const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const Database = require('better-sqlite3');
const QRCode = require('qrcode');
const {
  generateMetaComercialPdf,
  metaComercialFilename,
  contentDispositionFilename,
} = require('./reports/metaComercialReport');
const {
  generateDiscPdf,
  discFilename,
  resolverPerfilDominante,
  ARQUETIPO_MAP,
} = require('./reports/discReport');
const { calcNatural, calcAdaptado, calcIntensidade } = require('./discScoring');
const {
  generateMeuPorquePdf,
  meuPorqueFilename,
} = require('./reports/meuPorqueReport');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'troque-isto';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'metas.db');

const app = express();
app.use(express.json());

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
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS metas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    criado_em TEXT DEFAULT (datetime('now','localtime')),
    nome_participante TEXT,
    empresa TEXT,
    faturamento REAL,
    crescimento_pct REAL,
    churn_pct REAL,
    meta_anual REAL,
    meta_trimestral REAL,
    meta_mensal REAL,
    ticket REAL,
    contratos_mes REAL,
    conversao_pct REAL,
    contatos_necessarios REAL,
    contatos_mes_passado REAL,
    hunter_valor REAL,
    farmer_valor REAL,
    equipe_json TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS disc_respostas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    criado_em TEXT DEFAULT (datetime('now','localtime')),
    nome_participante TEXT,
    empresa TEXT,
    d_natural REAL,
    i_natural REAL,
    s_natural REAL,
    c_natural REAL,
    d_adaptado REAL,
    i_adaptado REAL,
    s_adaptado REAL,
    c_adaptado REAL,
    d_intensidade REAL,
    i_intensidade REAL,
    s_intensidade REAL,
    c_intensidade REAL,
    perfil_dominante TEXT,
    arquetipo TEXT,
    respostas_json TEXT
  )
`);

// "Meu Porquê" — dinâmica simples de reflexão (nova dinamica simples.md),
// 4 perguntas abertas, sem cálculo/perfil nenhum. Cada resposta é
// relacionada ao participante pelas mesmas colunas nome_participante/
// empresa que metas/disc_respostas já usam — não existe (ainda) um
// cadastro único compartilhado entre as 3 ferramentas (ver item 06 do
// backlog em CLAUDE.md).
db.exec(`
  CREATE TABLE IF NOT EXISTS meu_porque_respostas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    criado_em TEXT DEFAULT (datetime('now','localtime')),
    nome_participante TEXT,
    empresa TEXT,
    objetivo TEXT,
    sonho TEXT,
    mudanca TEXT,
    visao_futuro TEXT
  )
`);

const insertStmt = db.prepare(`
  INSERT INTO metas (
    nome_participante, empresa, faturamento, crescimento_pct, churn_pct,
    meta_anual, meta_trimestral, meta_mensal, ticket, contratos_mes,
    conversao_pct, contatos_necessarios, contatos_mes_passado,
    hunter_valor, farmer_valor, equipe_json
  ) VALUES (
    @nome_participante, @empresa, @faturamento, @crescimento_pct, @churn_pct,
    @meta_anual, @meta_trimestral, @meta_mensal, @ticket, @contratos_mes,
    @conversao_pct, @contatos_necessarios, @contatos_mes_passado,
    @hunter_valor, @farmer_valor, @equipe_json
  )
`);

const insertDiscStmt = db.prepare(`
  INSERT INTO disc_respostas (
    nome_participante, empresa,
    d_natural, i_natural, s_natural, c_natural,
    d_adaptado, i_adaptado, s_adaptado, c_adaptado,
    d_intensidade, i_intensidade, s_intensidade, c_intensidade,
    perfil_dominante, arquetipo, respostas_json
  ) VALUES (
    @nome_participante, @empresa,
    @d_natural, @i_natural, @s_natural, @c_natural,
    @d_adaptado, @i_adaptado, @s_adaptado, @c_adaptado,
    @d_intensidade, @i_intensidade, @s_intensidade, @c_intensidade,
    @perfil_dominante, @arquetipo, @respostas_json
  )
`);

const insertMeuPorqueStmt = db.prepare(`
  INSERT INTO meu_porque_respostas (
    nome_participante, empresa, objetivo, sonho, mudanca, visao_futuro
  ) VALUES (
    @nome_participante, @empresa, @objetivo, @sonho, @mudanca, @visao_futuro
  )
`);

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
app.post('/api/metas', (req, res) => {
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

  const info = insertStmt.run(row);
  res.status(201).json({ id: info.lastInsertRowid });
});

// gera o relatório em PDF da meta comercial preenchida (não salva no banco —
// o participante pode baixar o relatório mesmo sem ter enviado a meta antes)
app.post('/api/metas/pdf', (req, res) => {
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
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', contentDispositionFilename(filename));
  generateMetaComercialPdf(data).pipe(res);
});

// lista tudo (admin)
app.get('/api/metas', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM metas ORDER BY id DESC').all();
  const parsed = rows.map(r => ({ ...r, equipe: JSON.parse(r.equipe_json || '[]') }));
  res.json(parsed);
});

// exporta CSV (admin) — abre direto no Excel/Sheets
app.get('/api/metas.csv', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM metas ORDER BY id DESC').all();
  const cols = [
    'id','criado_em','nome_participante','empresa','faturamento','crescimento_pct',
    'churn_pct','meta_anual','meta_trimestral','meta_mensal','ticket','contratos_mes',
    'conversao_pct','contatos_necessarios','contatos_mes_passado','hunter_valor','farmer_valor'
  ];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = cols.join(';');
  const lines = rows.map(r => cols.map(c => esc(r[c])).join(';'));
  const csv = [header, ...lines].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="metas.csv"');
  res.send('\uFEFF' + csv); // BOM pra acentuação abrir certo no Excel
});

// apaga um registro específico (admin) — útil pra remover teste/duplicado
app.delete('/api/metas/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM metas WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- rotas DISC ----------

// recebe resultado de um participante
app.post('/api/disc', (req, res) => {
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

  const info = insertDiscStmt.run(row);
  res.status(201).json({ id: info.lastInsertRowid });
});

// gera o relatório em PDF do perfil DISC (não salva no banco — o
// participante pode baixar o relatório mesmo sem ter enviado o perfil antes)
app.post('/api/disc/pdf', (req, res) => {
  const b = req.body || {};
  const respostas = b.respostas || {};

  // Mesma robustez do POST /api/disc: recalcula os escores a partir das
  // respostas cruas, não confia no que o cliente mandar. perfil_dominante
  // nem é lido do body — generateDiscPdf() já sempre recalcula a partir
  // dos escores (nunca usou o que vinha nesse campo, então nem faz
  // diferença esse valor estar certo ou não). natural e adaptado vêm os 2
  // de `respostas.a` — ver comentário equivalente em POST /api/disc.
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
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', contentDispositionFilename(filename));
  generateDiscPdf(data).pipe(res);
});

// lista resultados DISC (admin)
app.get('/api/disc', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM disc_respostas ORDER BY id DESC').all();
  res.json(rows);
});

// exporta resultados DISC em CSV (admin)
app.get('/api/disc.csv', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM disc_respostas ORDER BY id DESC').all();
  const cols = [
    'id','criado_em','nome_participante','empresa',
    'd_natural','i_natural','s_natural','c_natural',
    'd_adaptado','i_adaptado','s_adaptado','c_adaptado',
    'd_intensidade','i_intensidade','s_intensidade','c_intensidade',
    'perfil_dominante','arquetipo'
  ];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = cols.join(';');
  const lines = rows.map(r => cols.map(c => esc(r[c])).join(';'));
  const csv = [header, ...lines].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="disc_respostas.csv"');
  res.send('\uFEFF' + csv);
});

// apaga resultado DISC (admin)
app.delete('/api/disc/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM disc_respostas WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

// ---------- rotas Meu Porquê ----------

// recebe resultado de um participante — sem cálculo nenhum, só grava as
// 4 respostas cruas (dinâmica "simples", ver nova dinamica simples.md)
app.post('/api/meu-porque', (req, res) => {
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

  const info = insertMeuPorqueStmt.run(row);
  res.status(201).json({ id: info.lastInsertRowid });
});

// gera o relatório em PDF do Meu Porquê (não salva no banco — o
// participante pode baixar o relatório mesmo sem ter enviado as respostas
// antes, mesmo padrão de POST /api/metas/pdf e POST /api/disc/pdf)
app.post('/api/meu-porque/pdf', (req, res) => {
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
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', contentDispositionFilename(filename));
  generateMeuPorquePdf(data).pipe(res);
});

// lista respostas do Meu Porquê (admin)
app.get('/api/meu-porque', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM meu_porque_respostas ORDER BY id DESC').all();
  res.json(rows);
});

// exporta respostas do Meu Porquê em CSV (admin)
app.get('/api/meu-porque.csv', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM meu_porque_respostas ORDER BY id DESC').all();
  const cols = ['id', 'criado_em', 'nome_participante', 'empresa', 'objetivo', 'sonho', 'mudanca', 'visao_futuro'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = cols.join(';');
  const lines = rows.map(r => cols.map(c => esc(r[c])).join(';'));
  const csv = [header, ...lines].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="meu_porque_respostas.csv"');
  res.send('\uFEFF' + csv);
});

// apaga resposta do Meu Porquê (admin)
app.delete('/api/meu-porque/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM meu_porque_respostas WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor no ar em http://localhost:${PORT}`);
    console.log(`Painel admin em http://localhost:${PORT}/admin.html`);
    console.log(`QR Code em    http://localhost:${PORT}/api/qr`);
  });
}

module.exports = app;
