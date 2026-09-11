// Camada de banco — PostgreSQL (via `pg`), substituindo o SQLite
// (`better-sqlite3`) usado até aqui. Migração pedida explicitamente pelo
// usuário (ver seção de robustez em CLAUDE.md): um único arquivo SQLite
// num único disco montado não pode ser compartilhado entre múltiplas
// instâncias do Render — só dava pra escalar trocando por uma instância
// maior (vertical), nunca somando instâncias. Postgres gerenciado resolve
// isso: várias instâncias do servidor podem apontar pro mesmo banco ao
// mesmo tempo.
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL não definida. Configure a connection string do Postgres ' +
    '(local, Docker, ou o Postgres gerenciado do Render) — ver .env.example e CLAUDE.md.'
  );
}

// Postgres gerenciado (Render incluído) normalmente exige SSL em conexões
// externas — a "Internal Database URL" (mesma região, rede interna do
// Render) não precisa. Detecta pelo host em vez de exigir mais uma
// variável de ambiente só pra isso.
const precisaSSL = /\.render\.com/.test(connectionString);

const pool = new Pool({
  connectionString,
  ssl: precisaSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Erro numa conexão ociosa do pool (ex.: o Postgres derrubou a conexão)
  // — sem este handler, isso derrubaria o processo inteiro sem log nenhum
  // (comportamento padrão do EventEmitter pra um evento 'error' sem
  // listener).
  console.error('Erro inesperado numa conexão ociosa do pool do Postgres:', err.message);
});

// Resumo seguro da connection string pra log (sem senha) — só host:porta/banco.
function resumoConexao() {
  try {
    const u = new URL(connectionString);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return '(não foi possível interpretar DATABASE_URL)';
  }
}

// `REAL`/`DOUBLE PRECISION`: o SQLite armazenava tudo como ponto flutuante
// de 8 bytes (double) independente do nome do tipo declarado — `REAL` no
// Postgres é de 4 bytes (single precision) e perderia dígitos exatos em
// valores grandes (ex.: faturamento na casa dos milhões). Usa
// DOUBLE PRECISION pra manter a mesma precisão de antes.
async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS metas (
      id SERIAL PRIMARY KEY,
      criado_em TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      nome_participante TEXT,
      empresa TEXT,
      email TEXT,
      faturamento DOUBLE PRECISION,
      crescimento_pct DOUBLE PRECISION,
      churn_pct DOUBLE PRECISION,
      meta_anual DOUBLE PRECISION,
      meta_trimestral DOUBLE PRECISION,
      meta_mensal DOUBLE PRECISION,
      ticket DOUBLE PRECISION,
      contratos_mes DOUBLE PRECISION,
      conversao_pct DOUBLE PRECISION,
      contatos_necessarios DOUBLE PRECISION,
      contatos_mes_passado DOUBLE PRECISION,
      hunter_valor DOUBLE PRECISION,
      farmer_valor DOUBLE PRECISION,
      equipe_json TEXT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS disc_respostas (
      id SERIAL PRIMARY KEY,
      criado_em TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      nome_participante TEXT,
      empresa TEXT,
      email TEXT,
      d_natural DOUBLE PRECISION,
      i_natural DOUBLE PRECISION,
      s_natural DOUBLE PRECISION,
      c_natural DOUBLE PRECISION,
      d_adaptado DOUBLE PRECISION,
      i_adaptado DOUBLE PRECISION,
      s_adaptado DOUBLE PRECISION,
      c_adaptado DOUBLE PRECISION,
      d_intensidade DOUBLE PRECISION,
      i_intensidade DOUBLE PRECISION,
      s_intensidade DOUBLE PRECISION,
      c_intensidade DOUBLE PRECISION,
      perfil_dominante TEXT,
      arquetipo TEXT,
      respostas_json TEXT
    )
  `);

  // Rastreio de notificação por e-mail aos líderes da empresa — NULL =
  // ainda não processado. Disparo é manual (botão "Notificar pendentes"
  // em admin.html, ver POST /api/disc/notificar-pendentes), não um job
  // agendado — mesmo assim precisa desse rastreio pra saber quem já foi
  // processado e não reenviar o mesmo e-mail toda vez que o botão for
  // clicado de novo.
  await pool.query(`ALTER TABLE disc_respostas ADD COLUMN IF NOT EXISTS notificado_em TEXT`);

  // "Meu Porquê" — ver comentário equivalente em CLAUDE.md sobre a
  // ausência de um cadastro único compartilhado entre as 3 ferramentas.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meu_porque_respostas (
      id SERIAL PRIMARY KEY,
      criado_em TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      nome_participante TEXT,
      empresa TEXT,
      email TEXT,
      objetivo TEXT,
      sonho TEXT,
      mudanca TEXT,
      visao_futuro TEXT
    )
  `);

  // Líderes/chefes de cada empresa cliente que devem ser notificados por
  // e-mail quando um colaborador daquela empresa preenche o DISC — ver
  // src/notifications/discNotifier.js. `empresa` aqui é comparada por
  // igualdade de texto com o campo `empresa` digitado livremente em
  // disc_respostas — grafias diferentes (maiúsculas, espaço, "Ltda" etc.)
  // não casam automaticamente; cadastre exatamente como os participantes
  // dessa empresa costumam digitar.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lideres_empresa (
      id SERIAL PRIMARY KEY,
      criado_em TEXT DEFAULT to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
      empresa TEXT NOT NULL,
      nome TEXT,
      email TEXT NOT NULL
    )
  `);

  // `email` (identidade do participante) pedido depois das 3 tabelas já
  // existirem em produção — `CREATE TABLE IF NOT EXISTS` acima não
  // adiciona coluna nova a uma tabela que já existia.
  await pool.query(`ALTER TABLE metas ADD COLUMN IF NOT EXISTS email TEXT`);
  await pool.query(`ALTER TABLE disc_respostas ADD COLUMN IF NOT EXISTS email TEXT`);
  await pool.query(`ALTER TABLE meu_porque_respostas ADD COLUMN IF NOT EXISTS email TEXT`);
}

// Dispara a criação do schema assim que este módulo é carregado (não só
// quando o servidor sobe de verdade) — `ready` é a mesma promise pra
// quem importar este módulo depois (server.js e os testes), então todo
// mundo espera exatamente a mesma inicialização, não uma cópia própria.
const ready = initSchema()
  .then(() => {
    console.log(`Postgres conectado e schema pronto: ${resumoConexao()}`);
  })
  .catch((err) => {
    console.error(`Falha ao conectar/inicializar o Postgres (${resumoConexao()}):`, err.message);
    throw err;
  });

module.exports = { pool, ready };
