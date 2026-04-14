const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const jwt     = require('jsonwebtoken');
const Database = require('better-sqlite3');

const app  = express();
const PORT = process.env.PORT || 3001;
const SECRET = process.env.JWT_SECRET || 'gadomarket-jwt-secret-change-in-production';
const MASTER_RESET_KEY = process.env.MASTER_RESET_KEY || 'GADO@RESET@2026';

// ── BANCO DE DADOS ──────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'gadomarket.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS operacoes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    data            TEXT    NOT NULL,
    cliente         TEXT    NOT NULL,
    frigorifico     TEXT,
    sexo            TEXT    NOT NULL,
    cabecas         INTEGER NOT NULL DEFAULT 0,
    pesoPorCabeca   REAL    DEFAULT 0,
    pesoTotal       REAL    DEFAULT 0,
    arrobasTotal    REAL    DEFAULT 0,
    valorCompraArroba REAL  DEFAULT 0,
    valorVendaArroba  REAL  DEFAULT 0,
    totalCompra     REAL    DEFAULT 0,
    totalVenda      REAL    DEFAULT 0,
    totalDespesas   REAL    DEFAULT 0,
    lucro           REAL    DEFAULT 0,
    status          TEXT    DEFAULT 'Concluída',
    createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS despesas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    operacaoId INTEGER NOT NULL,
    descricao  TEXT    NOT NULL,
    valor      REAL    NOT NULL DEFAULT 0,
    FOREIGN KEY (operacaoId) REFERENCES operacoes(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS clientes (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    nome     TEXT NOT NULL,
    telefone TEXT DEFAULT '',
    cidade   TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS frigorificos (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    nome   TEXT NOT NULL,
    cidade TEXT DEFAULT ''
  );
`);

// ── SEED ────────────────────────────────────────────────────────────
if (db.prepare('SELECT COUNT(*) AS c FROM clientes').get().c === 0) {
  const ic = db.prepare('INSERT INTO clientes (nome,telefone,cidade) VALUES (?,?,?)');
  ic.run('José Aparecido Silva','(67) 99876-5432','Campo Grande - MS');
  ic.run('Maria das Dores Ferreira','(34) 98765-4321','Uberaba - MG');
  ic.run('Carlos Eduardo Nunes','(65) 97654-3210','Cuiabá - MT');
}
if (db.prepare('SELECT COUNT(*) AS c FROM frigorificos').get().c === 0) {
  const ifr = db.prepare('INSERT INTO frigorificos (nome,cidade) VALUES (?,?)');
  ifr.run('JBS - Unidade Campo Grande','Campo Grande - MS');
  ifr.run('Minerva Foods','Barretos - SP');
  ifr.run('Marfrig','Promissão - SP');
}
if (db.prepare('SELECT COUNT(*) AS c FROM operacoes').get().c === 0) {
  const io = db.prepare(`INSERT INTO operacoes
    (data,cliente,frigorifico,sexo,cabecas,pesoPorCabeca,pesoTotal,arrobasTotal,
     valorCompraArroba,valorVendaArroba,totalCompra,totalVenda,totalDespesas,lucro,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const id = db.prepare('INSERT INTO despesas (operacaoId,descricao,valor) VALUES (?,?,?)');

  let r = io.run('10/04/2026','José Aparecido Silva','JBS - Unidade Campo Grande','Boi',
    20,520,10400,693.3,290,315,201057,218389.5,4500,12832.5,'Concluída');
  id.run(r.lastInsertRowid,'Frete',2500);
  id.run(r.lastInsertRowid,'Medicamentos',800);
  id.run(r.lastInsertRowid,'Alimentação',1200);

  r = io.run('05/04/2026','Maria das Dores Ferreira','Minerva Foods','Vaca',
    15,430,6450,430,270,295,116100,126850,2400,8350,'Concluída');
  id.run(r.lastInsertRowid,'Frete',1800);
  id.run(r.lastInsertRowid,'Comissão',600);

  r = io.run('01/04/2026','Carlos Eduardo Nunes','Marfrig','Boi',
    30,560,16800,1120,300,318,336000,356160,6750,13410,'Pendente');
  id.run(r.lastInsertRowid,'Frete',4000);
  id.run(r.lastInsertRowid,'Medicamentos',1500);
  id.run(r.lastInsertRowid,'Estadias',900);
  id.run(r.lastInsertRowid,'Pedágio',350);
}

// ── MIDDLEWARES ─────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── CRIAR TABELA DE USUÁRIOS ──────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT NOT NULL UNIQUE,
    senha           TEXT NOT NULL,
    email           TEXT,
    resetKey        TEXT,
    resetKeyExpiry  DATETIME,
    criadoEm        DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ── SEED DE USUÁRIO PADRÃO ────────────────────────────────────────
const crypto = require('crypto');
const hashSenha = (senha) => crypto.createHash('sha256').update(senha).digest('hex');

if (db.prepare('SELECT COUNT(*) AS c FROM usuarios').get().c === 0) {
  const senhaHash = hashSenha('gado@2024');
  db.prepare('INSERT INTO usuarios (username, senha, email) VALUES (?, ?, ?)').run('admin', senhaHash, 'admin@gadomarket.com');
  console.log('✅ Usuário padrão criado: admin / gado@2024');
}

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Não autorizado' });
  try { req.user = jwt.verify(token, SECRET); next(); }
  catch { res.status(401).json({ error: 'Token inválido' }); }
};

// ── AUTH ─────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  
  const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
  if (!usuario) return res.status(401).json({ error: 'Usuário ou senha incorretos' });
  
  const senhaHash = hashSenha(password);
  if (usuario.senha !== senhaHash) return res.status(401).json({ error: 'Usuário ou senha incorretos' });
  
  const token = jwt.sign({ username, id: usuario.id }, SECRET, { expiresIn: '30d' });
  res.json({ token, username });
});

app.get('/api/me', auth, (req, res) => res.json({ username: req.user.username }));

// ── RECUPERAÇÃO DE SENHA ──────────────────────────────────────────
app.post('/api/esqueci-senha', (req, res) => {
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'Usuário obrigatório' });
  
  const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });
  
  // Gerar código de recuperação (8 dígitos aleatórios)
  const resetKey = Math.random().toString().substring(2, 10);
  const expiry = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutos
  
  db.prepare('UPDATE usuarios SET resetKey = ?, resetKeyExpiry = ? WHERE id = ?').run(resetKey, expiry, usuario.id);
  
  res.json({ 
    success: true, 
    message: 'Código de recuperação gerado',
    resetKey: resetKey,
    username: username
  });
});

app.post('/api/resetar-senha', (req, res) => {
  const { username, resetKey, novaSenha } = req.body || {};
  if (!username || !resetKey || !novaSenha) return res.status(400).json({ error: 'Campos obrigatórios' });
  
  const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });
  
  if (usuario.resetKey !== resetKey) return res.status(401).json({ error: 'Código inválido' });
  
  const agora = new Date();
  if (new Date(usuario.resetKeyExpiry) < agora) return res.status(401).json({ error: 'Código expirado' });
  
  const senhaHash = hashSenha(novaSenha);
  db.prepare('UPDATE usuarios SET senha = ?, resetKey = NULL, resetKeyExpiry = NULL WHERE id = ?').run(senhaHash, usuario.id);
  
  res.json({ success: true, message: 'Senha alterada com sucesso' });
});

// ── RESETAR SENHA COM CÓDIGO SECRETO MASTER ─────────────────────────
app.post('/api/resetar-senha-master', (req, res) => {
  const { username, masterKey, novaSenha } = req.body || {};
  if (!username || !masterKey || !novaSenha) return res.status(400).json({ error: 'Campos obrigatórios' });
  
  // Validar código secreto master
  if (masterKey !== MASTER_RESET_KEY) return res.status(401).json({ error: 'Código secreto inválido' });
  
  const usuario = db.prepare('SELECT * FROM usuarios WHERE username = ?').get(username);
  if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' });
  
  const senhaHash = hashSenha(novaSenha);
  db.prepare('UPDATE usuarios SET senha = ?, resetKey = NULL, resetKeyExpiry = NULL WHERE id = ?').run(senhaHash, usuario.id);
  
  res.json({ success: true, message: 'Senha alterada com sucesso usando código master' });
});

// ── OBTER CÓDIGO SECRETO (para demo/admin) ───────────────────────────
app.get('/api/master-reset-key', auth, (req, res) => {
  if (req.user.username !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  res.json({ masterKey: MASTER_RESET_KEY, descricao: 'Use este código para resetar qualquer senha' });
});

// ── CLIENTES ─────────────────────────────────────────────────────────
app.get('/api/clientes', auth, (_req, res) =>
  res.json(db.prepare('SELECT * FROM clientes ORDER BY nome').all()));

app.post('/api/clientes', auth, (req, res) => {
  const { nome, telefone='', cidade='' } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
  const r = db.prepare('INSERT INTO clientes (nome,telefone,cidade) VALUES (?,?,?)').run(nome,telefone,cidade);
  res.json({ id: r.lastInsertRowid, nome, telefone, cidade });
});

app.put('/api/clientes/:id', auth, (req, res) => {
  const { nome, telefone='', cidade='' } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
  db.prepare('UPDATE clientes SET nome=?, telefone=?, cidade=? WHERE id=?').run(nome, telefone, cidade, req.params.id);
  res.json({ id: Number(req.params.id), nome, telefone, cidade });
});

app.delete('/api/clientes/:id', auth, (req, res) => {
  db.prepare('DELETE FROM clientes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── FRIGORÍFICOS ──────────────────────────────────────────────────────
app.get('/api/frigorificos', auth, (_req, res) =>
  res.json(db.prepare('SELECT * FROM frigorificos ORDER BY nome').all()));

app.post('/api/frigorificos', auth, (req, res) => {
  const { nome, cidade='' } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
  const r = db.prepare('INSERT INTO frigorificos (nome,cidade) VALUES (?,?)').run(nome,cidade);
  res.json({ id: r.lastInsertRowid, nome, cidade });
});

app.put('/api/frigorificos/:id', auth, (req, res) => {
  const { nome, cidade='' } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
  db.prepare('UPDATE frigorificos SET nome=?, cidade=? WHERE id=?').run(nome, cidade, req.params.id);
  res.json({ id: Number(req.params.id), nome, cidade });
});

app.delete('/api/frigorificos/:id', auth, (req, res) => {
  db.prepare('DELETE FROM frigorificos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── OPERAÇÕES ─────────────────────────────────────────────────────────
app.get('/api/operacoes', auth, (_req, res) => {
  const ops  = db.prepare('SELECT * FROM operacoes ORDER BY id DESC').all();
  const deps = db.prepare('SELECT * FROM despesas').all();
  res.json(ops.map(o => ({ ...o, despesas: deps.filter(d => d.operacaoId === o.id) })));
});

app.post('/api/operacoes', auth, (req, res) => {
  const o = req.body;
  const r = db.prepare(`
    INSERT INTO operacoes
      (data,cliente,frigorifico,sexo,cabecas,pesoPorCabeca,pesoTotal,arrobasTotal,
       valorCompraArroba,valorVendaArroba,totalCompra,totalVenda,totalDespesas,lucro,status)
    VALUES
      (@data,@cliente,@frigorifico,@sexo,@cabecas,@pesoPorCabeca,@pesoTotal,@arrobasTotal,
       @valorCompraArroba,@valorVendaArroba,@totalCompra,@totalVenda,@totalDespesas,@lucro,@status)
  `).run({ ...o, status: o.status || 'Concluída' });

  if (o.despesas?.length) {
    const ins = db.prepare('INSERT INTO despesas (operacaoId,descricao,valor) VALUES (?,?,?)');
    o.despesas.filter(d => d.descricao).forEach(d => ins.run(r.lastInsertRowid, d.descricao, d.valor));
  }
  res.json({ id: r.lastInsertRowid, ...o });
});

app.delete('/api/operacoes/:id', auth, (req, res) => {
  db.prepare('DELETE FROM despesas WHERE operacaoId=?').run(req.params.id);
  db.prepare('DELETE FROM operacoes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── REACT BUILD (produção) ────────────────────────────────────────────
const buildPath = path.join(__dirname, 'build');
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath));
  app.get('*', (_req, res) => res.sendFile(path.join(buildPath, 'index.html')));
}

app.listen(PORT, () =>
  console.log(`🐂 GadoMarket Pro rodando em http://localhost:${PORT}`));
