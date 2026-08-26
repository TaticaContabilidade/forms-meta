const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'troque-isto';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'metas.db');

const app = express();
app.use(express.json());
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

// ---------- auth simples pro admin ----------
function requireAdmin(req, res, next) {
  const token = req.get('x-admin-token') || req.query.token;
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token de admin inválido. Envie x-admin-token no header ou ?token= na URL.' });
  }
  next();
}

// ---------- rotas ----------

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

app.listen(PORT, () => {
  console.log(`Servidor no ar em http://localhost:${PORT}`);
  console.log(`Painel admin em http://localhost:${PORT}/admin.html`);
});
