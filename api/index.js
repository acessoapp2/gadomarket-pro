const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const MASTER_RESET_KEY = process.env.MASTER_RESET_KEY || 'GADO@RESET@2026';
const JWT_SECRET = process.env.JWT_SECRET || 'gadomarket-jwt-secret-change-in-production';
const DB_PATH = process.env.DB_PATH || path.join('/tmp', 'gadomarket.db');

const hashSenha = (senha) => crypto.createHash('sha256').update(senha).digest('hex');

let db;
try {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.error('Database connection error:', err);
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
const initializeDB = () => {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        email TEXT,
        resetKey TEXT,
        resetKeyExpiry INTEGER,
        criadoEm DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS operacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT,
        cliente_id INTEGER,
        frigorificos_id INTEGER,
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
        criadoEm DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (frigorificos_id) REFERENCES frigorificos(id)
      );

      CREATE TABLE IF NOT EXISTS despesas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        operacao_id INTEGER NOT NULL,
        descricao TEXT NOT NULL,
        valor REAL NOT NULL,
        criadoEm DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (operacao_id) REFERENCES operacoes(id)
      );

      CREATE TABLE IF NOT EXISTS clientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT UNIQUE NOT NULL,
        contato TEXT,
        criadoEm DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS frigorificos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT UNIQUE NOT NULL,
        localizacao TEXT,
        criadoEm DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed dados padrão
    const adminExists = db.prepare('SELECT * FROM usuarios WHERE username = ?').get('admin');
    if (!adminExists) {
      db.prepare('INSERT INTO usuarios (username, senha) VALUES (?, ?)').run('admin', hashSenha('gado@2024'));
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  }
};

initializeDB();

// Login
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
    
    if (!usuario || usuario.senha !== hashSenha(password)) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }

    const token = jwt.sign({ id: usuario.id, username: usuario.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, usuario: { id: usuario.id, username: usuario.username } });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Reset Master
app.post('/api/resetar-senha-master', (req, res) => {
  try {
    const { username, masterKey, novaSenha } = req.body;
    
    if (masterKey !== MASTER_RESET_KEY) {
      return res.status(401).json({ erro: 'Código secreto inválido' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    db.prepare('UPDATE usuarios SET senha = ? WHERE id = ?').run(hashSenha(novaSenha), usuario.id);
    res.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Master Reset Key (admin only)
app.get('/api/master-reset-key', autenticar, (req, res) => {
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
app.get('/api/operacoes', autenticar, (req, res) => {
  try {
    const operacoes = db.prepare('SELECT * FROM operacoes ORDER BY criadoEm DESC').all();
    res.json(operacoes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/operacoes', autenticar, (req, res) => {
  try {
    const { data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes } = req.body;
    
    const result = db.prepare(`
      INSERT INTO operacoes (data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes);
    
    res.json({ id: result.lastInsertRowid, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/operacoes/:id', autenticar, (req, res) => {
  try {
    const { id } = req.params;
    const { data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes } = req.body;
    
    db.prepare(`
      UPDATE operacoes SET data=?, cliente_id=?, frigorificos_id=?, cabecas=?, pesoPorCabeca=?, pesoTotal=?, arrobas=?, valorCompra=?, valorVenda=?, precoCompra=?, precoVenda=?, totalCompra=?, totalVenda=?, lucro=?, margem=?, observacoes=? WHERE id=?
    `).run(data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes, id);
    
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/operacoes/:id', autenticar, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM operacoes WHERE id=?').run(id);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Despesas
app.post('/api/despesas', autenticar, (req, res) => {
  try {
    const { operacao_id, descricao, valor } = req.body;
    const result = db.prepare('INSERT INTO despesas (operacao_id, descricao, valor) VALUES (?, ?, ?)').run(operacao_id, descricao, valor);
    res.json({ id: result.lastInsertRowid, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/despesas/:id', autenticar, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM despesas WHERE id=?').run(id);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Clientes
app.get('/api/clientes', autenticar, (req, res) => {
  try {
    const clientes = db.prepare('SELECT * FROM clientes ORDER BY nome').all();
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/clientes', autenticar, (req, res) => {
  try {
    const { nome, contato } = req.body;
    const result = db.prepare('INSERT INTO clientes (nome, contato) VALUES (?, ?)').run(nome, contato);
    res.json({ id: result.lastInsertRowid, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Frigoríficos
app.get('/api/frigorificos', autenticar, (req, res) => {
  try {
    const frigorificos = db.prepare('SELECT * FROM frigorificos ORDER BY nome').all();
    res.json(frigorificos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/frigorificos', autenticar, (req, res) => {
  try {
    const { nome, localizacao } = req.body;
    const result = db.prepare('INSERT INTO frigorificos (nome, localizacao) VALUES (?, ?)').run(nome, localizacao);
    res.json({ id: result.lastInsertRowid, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = app;
