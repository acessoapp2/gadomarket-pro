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

console.log('🔌 DATABASE_URL configurada:', !!DATABASE_URL);

const hashSenha = (senha) => crypto.createHash('sha256').update(senha).digest('hex');

let pool;
if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  pool.on('error', (err) => {
    console.error('❌ Pool error:', err);
  });
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

// Inicializar banco de dados
const initializeDB = async () => {
  if (!pool) {
    console.error('❌ Pool não disponível');
    return;
  }
  
  try {
    const client = await pool.connect();
    console.log('✅ Conectado ao PostgreSQL');
    
    // Criar tabelas
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        email TEXT,
        resetKey TEXT,
        resetKeyExpiry BIGINT,
        criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela usuarios criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nome TEXT UNIQUE NOT NULL,
        contato TEXT,
        criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela clientes criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS frigorificos (
        id SERIAL PRIMARY KEY,
        nome TEXT UNIQUE NOT NULL,
        localizacao TEXT,
        criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela frigorificos criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS operacoes (
        id SERIAL PRIMARY KEY,
        data TEXT,
        cliente_id INTEGER REFERENCES clientes(id),
        frigorificos_id INTEGER REFERENCES frigorificos(id),
        cabecas INTEGER,
        pesoPorCabeca REAL,
        pesoTotal REAL,
        arrobas REAL,
        valorCompra REAL,
        valorVenda REAL,
        precoCompra REAL,
        precoVenda REAL,
        totalCompra REAL,
        totalVenda REAL,
        lucro REAL,
        margem REAL,
        observacoes TEXT,
        criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela operacoes criada/verificada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS despesas (
        id SERIAL PRIMARY KEY,
        operacao_id INTEGER NOT NULL REFERENCES operacoes(id),
        descricao TEXT NOT NULL,
        valor REAL NOT NULL,
        criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela despesas criada/verificada');

    // Verificar se admin existe
    const result = await client.query('SELECT * FROM usuarios WHERE username = $1', ['admin']);
    if (result.rows.length === 0) {
      await client.query('INSERT INTO usuarios (username, senha) VALUES ($1, $2)', ['admin', hashSenha('gado@2024')]);
      console.log('✅ Usuário admin criado');
    } else {
      console.log('✅ Usuário admin já existe');
    }

    client.release();
    console.log('✅ Database inicializado com sucesso!');
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    console.error(err.stack);
  }
};

initializeDB();

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    database: pool ? 'conectado' : 'desconectado',
    timestamp: new Date().toISOString()
  });
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ erro: 'Banco de dados não disponível' });
    }
    
    const { username, password } = req.body;
    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    const usuario = result.rows[0];
    
    if (!usuario || usuario.senha !== hashSenha(password)) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    const token = jwt.sign({ id: usuario.id, username: usuario.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, username: usuario.username });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ erro: 'Erro no login: ' + err.message });
  }
});

// Get current user
app.get('/api/me', autenticar, (req, res) => {
  res.json({ username: req.usuario.username, id: req.usuario.id });
});

// Reset Master
app.post('/api/resetar-senha-master', async (req, res) => {
  try {
    const { username, masterKey, novaSenha } = req.body;
    
    if (masterKey !== MASTER_RESET_KEY) {
      return res.status(401).json({ erro: 'Código secreto inválido' });
    }

    const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
    const usuario = result.rows[0];
    
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    await pool.query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hashSenha(novaSenha), usuario.id]);
    res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Master Reset Key (admin only)
app.get('/api/master-reset-key', autenticar, async (req, res) => {
  try {
    if (req.usuario.username !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    res.json({ masterKey: MASTER_RESET_KEY });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// CRUD Operações
app.get('/api/operacoes', autenticar, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM operacoes ORDER BY criadoEm DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/operacoes', autenticar, async (req, res) => {
  try {
    const { data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes } = req.body;
    
    const result = await pool.query(`
      INSERT INTO operacoes (data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `, [data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes]);
    
    res.json({ id: result.rows[0].id, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/operacoes/:id', autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes } = req.body;
    
    await pool.query(`
      UPDATE operacoes SET data=$1, cliente_id=$2, frigorificos_id=$3, cabecas=$4, pesoPorCabeca=$5, pesoTotal=$6, arrobas=$7, valorCompra=$8, valorVenda=$9, precoCompra=$10, precoVenda=$11, totalCompra=$12, totalVenda=$13, lucro=$14, margem=$15, observacoes=$16 WHERE id=$17
    `, [data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes, id]);
    
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/operacoes/:id', autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM operacoes WHERE id=$1', [id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Despesas
app.post('/api/despesas', autenticar, async (req, res) => {
  try {
    const { operacao_id, descricao, valor } = req.body;
    const result = await pool.query('INSERT INTO despesas (operacao_id, descricao, valor) VALUES ($1, $2, $3) RETURNING id', [operacao_id, descricao, valor]);
    res.json({ id: result.rows[0].id, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/despesas/:id', autenticar, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM despesas WHERE id=$1', [id]);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Clientes
app.get('/api/clientes', autenticar, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clientes ORDER BY nome');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/clientes', autenticar, async (req, res) => {
  try {
    const { nome, contato } = req.body;
    const result = await pool.query('INSERT INTO clientes (nome, contato) VALUES ($1, $2) RETURNING id', [nome, contato]);
    res.json({ id: result.rows[0].id, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Frigoríficos
app.get('/api/frigorificos', autenticar, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM frigorificos ORDER BY nome');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/frigorificos', autenticar, async (req, res) => {
  try {
    const { nome, localizacao } = req.body;
    const result = await pool.query('INSERT INTO frigorificos (nome, localizacao) VALUES ($1, $2) RETURNING id', [nome, localizacao]);
    res.json({ id: result.rows[0].id, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = app;
