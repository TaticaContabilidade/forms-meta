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
const { generateDiscPdf, discFilename } = require('./reports/discReport');

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

  const filename = metaComercialFilename(empresa);
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

  const row = {
    nome_participante: String(b.nome_participante || '').slice(0, 200),
    empresa: String(b.empresa || '').slice(0, 200),
    d_natural: Number(b.d_natural) || 0,
    i_natural: Number(b.i_natural) || 0,
    s_natural: Number(b.s_natural) || 0,
    c_natural: Number(b.c_natural) || 0,
    d_adaptado: Number(b.d_adaptado) || 0,
    i_adaptado: Number(b.i_adaptado) || 0,
    s_adaptado: Number(b.s_adaptado) || 0,
    c_adaptado: Number(b.c_adaptado) || 0,
    d_intensidade: Number(b.d_intensidade) || 0,
    i_intensidade: Number(b.i_intensidade) || 0,
    s_intensidade: Number(b.s_intensidade) || 0,
    c_intensidade: Number(b.c_intensidade) || 0,
    perfil_dominante: String(b.perfil_dominante || '').slice(0, 100),
    arquetipo: String(b.arquetipo || '').slice(0, 100),
    respostas_json: JSON.stringify(b.respostas || {}),
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

  const data = {
    nome_participante: String(b.nome_participante || '').slice(0, 200),
    empresa: String(b.empresa || '').slice(0, 200),
    d_natural: Number(b.d_natural) || 0,
    i_natural: Number(b.i_natural) || 0,
    s_natural: Number(b.s_natural) || 0,
    c_natural: Number(b.c_natural) || 0,
    d_adaptado: Number(b.d_adaptado) || 0,
    i_adaptado: Number(b.i_adaptado) || 0,
    s_adaptado: Number(b.s_adaptado) || 0,
    c_adaptado: Number(b.c_adaptado) || 0,
    d_intensidade: Number(b.d_intensidade) || 0,
    i_intensidade: Number(b.i_intensidade) || 0,
    s_intensidade: Number(b.s_intensidade) || 0,
    c_intensidade: Number(b.c_intensidade) || 0,
    perfil_dominante: String(b.perfil_dominante || '').slice(0, 100),
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

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor no ar em http://localhost:${PORT}`);
    console.log(`Painel admin em http://localhost:${PORT}/admin.html`);
    console.log(`QR Code em    http://localhost:${PORT}/api/qr`);
  });
}

module.exports = app;
