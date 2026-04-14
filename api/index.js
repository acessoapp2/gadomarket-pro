const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const MASTER_RESET_KEY = process.env.MASTER_RESET_KEY || 'GADO@RESET@2026';
const JWT_SECRET = process.env.JWT_SECRET || 'gadomarket-jwt-secret-change-in-production';

const hashSenha = (senha) => crypto.createHash('sha256').update(senha).digest('hex');

// In-memory database para Vercel (sem SQLite)
const database = {
  usuarios: [
    { id: 1, username: 'admin', senha: hashSenha('gado@2024'), email: null, criadoEm: new Date().toISOString() }
  ],
  operacoes: [],
  despesas: [],
  clientes: [],
  frigorificos: [],
  nextIds: { operacoes: 1, despesas: 1, clientes: 1, frigorificos: 1 }
};

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

// Login
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const usuario = database.usuarios.find(u => u.username === username);
    
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

    const usuario = database.usuarios.find(u => u.username === username);
    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    usuario.senha = hashSenha(novaSenha);
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
    const operacoes = database.operacoes.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm));
    res.json(operacoes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/operacoes', autenticar, (req, res) => {
  try {
    const { data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes } = req.body;
    
    const newOp = {
      id: database.nextIds.operacoes++,
      data,
      cliente_id,
      frigorificos_id,
      cabecas,
      pesoPorCabeca,
      pesoTotal,
      arrobas,
      valorCompra,
      valorVenda,
      precoCompra,
      precoVenda,
      totalCompra,
      totalVenda,
      lucro,
      margem,
      observacoes,
      criadoEm: new Date().toISOString()
    };
    
    database.operacoes.push(newOp);
    res.json({ id: newOp.id, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.put('/api/operacoes/:id', autenticar, (req, res) => {
  try {
    const { id } = req.params;
    const index = database.operacoes.findIndex(o => o.id === parseInt(id));
    
    if (index === -1) {
      return res.status(404).json({ erro: 'Operação não encontrada' });
    }

    database.operacoes[index] = { ...database.operacoes[index], ...req.body };
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/operacoes/:id', autenticar, (req, res) => {
  try {
    const { id } = req.params;
    database.operacoes = database.operacoes.filter(o => o.id !== parseInt(id));
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Despesas
app.post('/api/despesas', autenticar, (req, res) => {
  try {
    const { operacao_id, descricao, valor } = req.body;
    const newDespesa = {
      id: database.nextIds.despesas++,
      operacao_id,
      descricao,
      valor,
      criadoEm: new Date().toISOString()
    };
    
    database.despesas.push(newDespesa);
    res.json({ id: newDespesa.id, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.delete('/api/despesas/:id', autenticar, (req, res) => {
  try {
    const { id } = req.params;
    database.despesas = database.despesas.filter(d => d.id !== parseInt(id));
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Clientes
app.get('/api/clientes', autenticar, (req, res) => {
  try {
    const clientes = database.clientes.sort((a, b) => a.nome.localeCompare(b.nome));
    res.json(clientes);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/clientes', autenticar, (req, res) => {
  try {
    const { nome, contato } = req.body;
    const newCliente = {
      id: database.nextIds.clientes++,
      nome,
      contato,
      criadoEm: new Date().toISOString()
    };
    
    database.clientes.push(newCliente);
    res.json({ id: newCliente.id, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Frigoríficos
app.get('/api/frigorificos', autenticar, (req, res) => {
  try {
    const frigorificos = database.frigorificos.sort((a, b) => a.nome.localeCompare(b.nome));
    res.json(frigorificos);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

app.post('/api/frigorificos', autenticar, (req, res) => {
  try {
    const { nome, localizacao } = req.body;
    const newFrigo = {
      id: database.nextIds.frigorificos++,
      nome,
      localizacao,
      criadoEm: new Date().toISOString()
    };
    
    database.frigorificos.push(newFrigo);
    res.json({ id: newFrigo.id, sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

module.exports = app;
