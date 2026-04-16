const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const MASTER_RESET_KEY = process.env.MASTER_RESET_KEY || 'GADO@RESET@2026';
const JWT_SECRET = process.env.JWT_SECRET || 'gadomarket-jwt-secret-change-in-production';
const DATABASE_URL = process.env.DATABASE_URL;

const hashSenha = (senha) => crypto.createHash('sha256').update(senha).digest('hex');
const toNumber = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = parseFloat(val);
  return isNaN(num) ? 0 : num;
};

let pool;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err) => console.error('❌ Pool error:', err));
} else {
  console.error('❌ DATABASE_URL NÃO CONFIGURADA!');
}

// Middleware de autenticação
const autenticar = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    res.status(401).json({ erro: 'Token inválido' });
  }
};

// Resolver cliente_id a partir do nome ou do id
const resolveClienteId = async (nome, id) => {
  if (id != null && id !== '') return Number(id);
  if (!nome) return null;
  const r = await pool.query('SELECT id FROM clientes WHERE nome=$1', [nome]);
  return r.rows[0]?.id || null;
};

// Resolver frigorificos_id a partir do nome ou do id
const resolveFrigorifico = async (nome, id) => {
  if (id != null && id !== '') return Number(id);
  if (!nome) return null;
  const r = await pool.query('SELECT id FROM frigorificos WHERE nome=$1', [nome]);
  return r.rows[0]?.id || null;
};

// Inicializar banco de dados com retry
const initializeDB = async (tentativa = 1) => {
  if (!pool) { console.error('❌ Pool não disponível'); return; }
  try {
    const client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL');

    await client.query(`CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      email TEXT,
      resetKey TEXT,
      resetKeyExpiry BIGINT,
      criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      nome TEXT UNIQUE NOT NULL,
      contato TEXT,
      cidade TEXT,
      criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS frigorificos (
      id SERIAL PRIMARY KEY,
      nome TEXT UNIQUE NOT NULL,
      localizacao TEXT,
      criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS operacoes (
      id SERIAL PRIMARY KEY,
      data TEXT,
      cliente_id INTEGER REFERENCES clientes(id),
      frigorificos_id INTEGER REFERENCES frigorificos(id),
      sexo TEXT,
      status TEXT DEFAULT 'Concluída',
      cabecas INTEGER,
      pesoPorCabeca REAL,
      pesoTotal REAL,
      arrobas REAL,
      valorCompra REAL,
      valorVenda REAL,
      totalCompra REAL,
      totalVenda REAL,
      lucro REAL,
      margem REAL,
      observacoes TEXT,
      criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migrations: adicionar colunas se não existirem
    const migrations = [
      `ALTER TABLE operacoes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Concluída'`,
      `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cidade TEXT`,
    ];
    for (const m of migrations) {
      try { await client.query(m); } catch (e) { /* já existe */ }
    }

    await client.query(`CREATE TABLE IF NOT EXISTS despesas (
      id SERIAL PRIMARY KEY,
      operacao_id INTEGER NOT NULL REFERENCES operacoes(id) ON DELETE CASCADE,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL DEFAULT 0,
      criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Adicionar constraint ON DELETE CASCADE se necessário
    try {
      await client.query(`ALTER TABLE despesas DROP CONSTRAINT IF EXISTS despesas_operacao_id_fkey`);
      await client.query(`ALTER TABLE despesas ADD CONSTRAINT despesas_operacao_id_fkey FOREIGN KEY (operacao_id) REFERENCES operacoes(id) ON DELETE CASCADE`);
    } catch (e) { /* ignore */ }

    // Seed usuário admin
    const u = await client.query('SELECT id FROM usuarios WHERE username=$1', ['admin']);
    if (u.rows.length === 0) {
      await client.query('INSERT INTO usuarios (username, senha) VALUES ($1,$2)', ['admin', hashSenha('gado@2024')]);
      console.log('✅ Usuário admin criado');
    }

    // Seed clientes
    const cc = await client.query('SELECT COUNT(*) as c FROM clientes');
    if (parseInt(cc.rows[0].c) === 0) {
      const clientes = [
        ['José Aparecido Silva', '(67) 99876-5432', 'Campo Grande - MS'],
        ['Maria das Dores Ferreira', '(34) 98765-4321', 'Uberaba - MG'],
        ['Carlos Eduardo Nunes', '(65) 97654-3210', 'Cuiabá - MT'],
      ];
      for (const [nome, contato, cidade] of clientes) {
        await client.query('INSERT INTO clientes (nome,contato,cidade) VALUES ($1,$2,$3) ON CONFLICT (nome) DO NOTHING', [nome, contato, cidade]);
      }
      console.log('✅ Clientes seed criados');
    }

    // Seed frigoríficos
    const cf = await client.query('SELECT COUNT(*) as c FROM frigorificos');
    if (parseInt(cf.rows[0].c) === 0) {
      const frs = [
        ['JBS - Unidade Campo Grande', 'Campo Grande - MS'],
        ['Minerva Foods', 'Barretos - SP'],
        ['Marfrig', 'Promissão - SP'],
      ];
      for (const [nome, loc] of frs) {
        await client.query('INSERT INTO frigorificos (nome,localizacao) VALUES ($1,$2) ON CONFLICT (nome) DO NOTHING', [nome, loc]);
      }
      console.log('✅ Frigoríficos seed criados');
    }

    client.release();
    console.log('✅ Database inicializado com sucesso!');
  } catch (err) {
    console.error(`❌ Erro na inicialização (tentativa ${tentativa}):`, err.message);
    if (tentativa < 3) setTimeout(() => initializeDB(tentativa + 1), 2000);
  }
};

initializeDB();

// ── HEALTH / DIAGNÓSTICO ──────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    if (!pool) return res.status(503).json({ status: 'erro', database: 'desconectado' });
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'conectado', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'erro', message: err.message });
  }
});

app.get('/api/diagnostico', async (_req, res) => {
  try {
    const d = { timestamp: new Date().toISOString(), pool: !!pool };
    if (pool) {
      const tbls = ['usuarios', 'clientes', 'frigorificos', 'operacoes', 'despesas'];
      d.table_counts = {};
      for (const t of tbls) {
        const r = await pool.query(`SELECT COUNT(*) as c FROM ${t}`);
        d.table_counts[t] = parseInt(r.rows[0].c);
      }
    }
    res.json(d);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── AUTH ──────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ erro: 'Banco não disponível' });
    const { username, password } = req.body;
    const r = await pool.query('SELECT * FROM usuarios WHERE username=$1', [username]);
    const u = r.rows[0];
    if (!u || u.senha !== hashSenha(password)) return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    const token = jwt.sign({ id: u.id, username: u.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: u.username });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/api/me', autenticar, (req, res) => {
  res.json({ username: req.usuario.username, id: req.usuario.id });
});

app.post('/api/resetar-senha-master', async (req, res) => {
  try {
    const { username, masterKey, novaSenha } = req.body;
    if (masterKey !== MASTER_RESET_KEY) return res.status(401).json({ erro: 'Código secreto inválido' });
    const r = await pool.query('SELECT id FROM usuarios WHERE username=$1', [username]);
    if (!r.rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado' });
    await pool.query('UPDATE usuarios SET senha=$1 WHERE id=$2', [hashSenha(novaSenha), r.rows[0].id]);
    res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.get('/api/master-reset-key', autenticar, (req, res) => {
  if (req.usuario.username !== 'admin') return res.status(403).json({ erro: 'Acesso negado' });
  res.json({ masterKey: MASTER_RESET_KEY });
});

// ── CLIENTES ──────────────────────────────────────────────────────
app.get('/api/clientes', autenticar, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, nome, contato as telefone, cidade, criadoem as "criadoEm" FROM clientes ORDER BY nome');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/api/clientes', autenticar, async (req, res) => {
  try {
    const { nome, telefone, contato, cidade } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
    const r = await pool.query(
      'INSERT INTO clientes (nome,contato,cidade) VALUES ($1,$2,$3) RETURNING id',
      [nome, telefone || contato || '', cidade || '']
    );
    res.json({ id: r.rows[0].id, nome, telefone: telefone || contato || '', cidade: cidade || '' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.put('/api/clientes/:id', autenticar, async (req, res) => {
  try {
    const { nome, telefone, contato, cidade } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
    await pool.query(
      'UPDATE clientes SET nome=$1, contato=$2, cidade=$3 WHERE id=$4',
      [nome, telefone || contato || '', cidade || '', req.params.id]
    );
    res.json({ id: Number(req.params.id), nome, telefone: telefone || contato || '', cidade: cidade || '' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.delete('/api/clientes/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM clientes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── FRIGORÍFICOS ──────────────────────────────────────────────────
app.get('/api/frigorificos', autenticar, async (req, res) => {
  try {
    const r = await pool.query('SELECT id, nome, localizacao as cidade, criadoem as "criadoEm" FROM frigorificos ORDER BY nome');
    res.json(r.rows);
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.post('/api/frigorificos', autenticar, async (req, res) => {
  try {
    const { nome, cidade, localizacao } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
    const r = await pool.query(
      'INSERT INTO frigorificos (nome,localizacao) VALUES ($1,$2) RETURNING id',
      [nome, cidade || localizacao || '']
    );
    res.json({ id: r.rows[0].id, nome, cidade: cidade || localizacao || '' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.put('/api/frigorificos/:id', autenticar, async (req, res) => {
  try {
    const { nome, cidade, localizacao } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome obrigatório' });
    await pool.query(
      'UPDATE frigorificos SET nome=$1, localizacao=$2 WHERE id=$3',
      [nome, cidade || localizacao || '', req.params.id]
    );
    res.json({ id: Number(req.params.id), nome, cidade: cidade || localizacao || '' });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.delete('/api/frigorificos/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM frigorificos WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── OPERAÇÕES ─────────────────────────────────────────────────────
app.get('/api/operacoes', autenticar, async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ erro: 'Banco não disponível' });

    const result = await pool.query(`
      SELECT o.*,
             c.nome  AS cliente_nome,
             f.nome  AS frigorifico_nome
      FROM operacoes o
      LEFT JOIN clientes    c ON c.id = o.cliente_id
      LEFT JOIN frigorificos f ON f.id = o.frigorificos_id
      ORDER BY o.criadoem DESC
    `);

    const operacoes = await Promise.all(result.rows.map(async (op) => {
      const deps = await pool.query('SELECT id, descricao, valor FROM despesas WHERE operacao_id=$1', [op.id]);
      const despesas = deps.rows;
      const totalDespesas = despesas.reduce((s, d) => s + (d.valor || 0), 0);

      return {
        id: op.id,
        data: op.data,
        cliente_id: op.cliente_id,
        frigorificos_id: op.frigorificos_id,
        // Strings para o frontend exibir diretamente
        cliente: op.cliente_nome || '',
        frigorifico: op.frigorifico_nome || '',
        sexo: op.sexo,
        status: op.status || 'Concluída',
        cabecas: op.cabecas,
        pesoPorCabeca: op.pesoporcabeca,
        pesoTotal: op.pesototal,
        arrobasTotal: op.arrobas,
        valorCompraArroba: op.valorcompra,
        valorVendaArroba: op.valorvenda,
        totalCompra: op.totalcompra,
        totalVenda: op.totalvenda,
        totalDespesas,
        lucro: op.lucro,
        margem: op.margem,
        despesas,
        criadoEm: op.criadoem,
      };
    }));

    res.json(operacoes);
  } catch (err) {
    console.error('❌ Erro ao buscar operações:', err);
    res.status(500).json({ erro: err.message });
  }
});

// Função auxiliar para normalizar o body da operação
const normalizeOpBody = async (body) => {
  const b = body;

  // Resolver cliente_id
  const clienteId = await resolveClienteId(b.cliente, b.cliente_id);

  // Resolver frigorificos_id
  const frigoId = await resolveFrigorifico(b.frigorifico, b.frigorificos_id);

  // Aceitar aliases de campo
  const arrobas      = toNumber(b.arrobasTotal  ?? b.arrobas);
  const valorCompra  = toNumber(b.valorCompraArroba ?? b.valorCompra ?? b.precoCompra);
  const valorVenda   = toNumber(b.valorVendaArroba  ?? b.valorVenda  ?? b.precoVenda);
  const margem       = toNumber(b.margem);

  return {
    data:           b.data || new Date().toLocaleDateString('pt-BR'),
    cliente_id:     clienteId,
    frigorificos_id: frigoId,
    sexo:           b.sexo || 'Boi',
    status:         b.status || 'Concluída',
    cabecas:        toNumber(b.cabecas),
    pesoPorCabeca:  toNumber(b.pesoPorCabeca),
    pesoTotal:      toNumber(b.pesoTotal),
    arrobas,
    valorCompra,
    valorVenda,
    totalCompra:    toNumber(b.totalCompra),
    totalVenda:     toNumber(b.totalVenda),
    lucro:          toNumber(b.lucro),
    margem,
    observacoes:    b.observacoes || null,
    despesas:       Array.isArray(b.despesas) ? b.despesas.filter(d => d.descricao) : [],
  };
};

app.post('/api/operacoes', autenticar, async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ erro: 'Banco não disponível' });

    const op = await normalizeOpBody(req.body);

    if (!op.data || !op.cabecas) {
      return res.status(400).json({ erro: 'Campos obrigatórios: data, cabecas' });
    }

    const r = await pool.query(`
      INSERT INTO operacoes (data, cliente_id, frigorificos_id, sexo, status, cabecas,
        pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda,
        totalCompra, totalVenda, lucro, margem, observacoes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING id
    `, [op.data, op.cliente_id, op.frigorificos_id, op.sexo, op.status, op.cabecas,
        op.pesoPorCabeca, op.pesoTotal, op.arrobas, op.valorCompra, op.valorVenda,
        op.totalCompra, op.totalVenda, op.lucro, op.margem, op.observacoes]);

    const id = r.rows[0].id;

    // Salvar despesas
    for (const d of op.despesas) {
      await pool.query(
        'INSERT INTO despesas (operacao_id, descricao, valor) VALUES ($1,$2,$3)',
        [id, d.descricao, toNumber(d.valor)]
      );
    }

    res.json({ id, sucesso: true });
  } catch (err) {
    console.error('❌ Erro ao criar operação:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/operacoes/:id', autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const op = await normalizeOpBody(req.body);

    await pool.query(`
      UPDATE operacoes SET
        data=$1, cliente_id=$2, frigorificos_id=$3, sexo=$4, status=$5,
        cabecas=$6, pesoPorCabeca=$7, pesoTotal=$8, arrobas=$9,
        valorCompra=$10, valorVenda=$11, totalCompra=$12, totalVenda=$13,
        lucro=$14, margem=$15, observacoes=$16
      WHERE id=$17
    `, [op.data, op.cliente_id, op.frigorificos_id, op.sexo, op.status, op.cabecas,
        op.pesoPorCabeca, op.pesoTotal, op.arrobas, op.valorCompra, op.valorVenda,
        op.totalCompra, op.totalVenda, op.lucro, op.margem, op.observacoes, id]);

    // Substituir despesas
    await pool.query('DELETE FROM despesas WHERE operacao_id=$1', [id]);
    for (const d of op.despesas) {
      await pool.query(
        'INSERT INTO despesas (operacao_id, descricao, valor) VALUES ($1,$2,$3)',
        [id, d.descricao, toNumber(d.valor)]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('❌ Erro ao atualizar operação:', err);
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/operacoes/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM despesas WHERE operacao_id=$1', [req.params.id]);
    await pool.query('DELETE FROM operacoes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

// ── DESPESAS (endpoints avulsos para compatibilidade) ─────────────
app.post('/api/despesas', autenticar, async (req, res) => {
  try {
    const { operacao_id, descricao, valor } = req.body;
    const r = await pool.query(
      'INSERT INTO despesas (operacao_id, descricao, valor) VALUES ($1,$2,$3) RETURNING id',
      [operacao_id, descricao, toNumber(valor)]
    );
    res.json({ id: r.rows[0].id, sucesso: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

app.delete('/api/despesas/:id', autenticar, async (req, res) => {
  try {
    await pool.query('DELETE FROM despesas WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ erro: err.message }); }
});

module.exports = app;
// Deploy timestamp: Wed Apr 16 2026
