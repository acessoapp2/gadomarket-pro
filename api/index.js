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
    ssl: { rejectUnauthorized: false },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  
  pool.on('error', (err) => {
    console.error('❌ Pool error:', err);
  });
  
  pool.on('connect', () => {
    console.log('✅ Conexão estabelecida com PostgreSQL');
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

// Inicializar banco de dados com retry
const initializeDB = async (tentativa = 1) => {
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

    // Seed de clientes
    const clientesResult = await client.query('SELECT COUNT(*) as c FROM clientes');
    const clientesCount = parseInt(clientesResult.rows[0].c);
    if (clientesCount === 0) {
      try {
        await client.query(`
          INSERT INTO clientes (nome, contato) VALUES 
          ('José Aparecido Silva', '(67) 99876-5432')
          ON CONFLICT (nome) DO NOTHING
        `);
        await client.query(`
          INSERT INTO clientes (nome, contato) VALUES 
          ('Maria das Dores Ferreira', '(34) 98765-4321')
          ON CONFLICT (nome) DO NOTHING
        `);
        await client.query(`
          INSERT INTO clientes (nome, contato) VALUES 
          ('Carlos Eduardo Nunes', '(65) 97654-3210')
          ON CONFLICT (nome) DO NOTHING
        `);
        console.log('✅ Clientes seed criados (3 clientes)');
      } catch (err) {
        console.error('⚠️ Erro ao criar clientes seed:', err.message);
      }
    } else {
      console.log(`✅ Clientes já existem (${clientesCount})`);
    }

    // Seed de frigorificos
    const frigoResult = await client.query('SELECT COUNT(*) as c FROM frigorificos');
    const frigoCount = parseInt(frigoResult.rows[0].c);
    if (frigoCount === 0) {
      try {
        await client.query(`
          INSERT INTO frigorificos (nome, localizacao) VALUES 
          ('JBS - Unidade Campo Grande', 'Campo Grande - MS')
          ON CONFLICT (nome) DO NOTHING
        `);
        await client.query(`
          INSERT INTO frigorificos (nome, localizacao) VALUES 
          ('Minerva Foods', 'Barretos - SP')
          ON CONFLICT (nome) DO NOTHING
        `);
        await client.query(`
          INSERT INTO frigorificos (nome, localizacao) VALUES 
          ('Marfrig', 'Promissão - SP')
          ON CONFLICT (nome) DO NOTHING
        `);
        console.log('✅ Frigorificos seed criados (3 frigorificos)');
      } catch (err) {
        console.error('⚠️ Erro ao criar frigorificos seed:', err.message);
      }
    } else {
      console.log(`✅ Frigorificos já existem (${frigoCount})`);
    }

    client.release();
    console.log('✅ Database inicializado com sucesso!');
  } catch (err) {
    console.error(`❌ Erro na inicialização (tentativa ${tentativa}):`, err.message);
    if (tentativa < 3) {
      console.log(`⏳ Tentando novamente em 2 segundos...`);
      setTimeout(() => initializeDB(tentativa + 1), 2000);
    }
  }
};

initializeDB();

// Health check
app.get('/api/health', async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ 
        status: 'erro',
        message: 'Pool não inicializado',
        database: 'desconectado'
      });
    }
    
    // Testar conexão
    const result = await pool.query('SELECT 1 as ping');
    res.json({ 
      status: 'ok',
      database: 'conectado',
      ping: result.rows[0].ping,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Health check error:', err);
    res.status(503).json({ 
      status: 'erro',
      message: err.message,
      database: 'erro'
    });
  }
});

// Diagnóstico
app.get('/api/diagnostico', async (req, res) => {
  try {
    const diagnostico = {
      timestamp: new Date().toISOString(),
      database_url_configured: !!DATABASE_URL,
      pool_exists: !!pool
    };
    
    if (pool) {
      try {
        // Testar SELECT simples
        const result = await pool.query('SELECT 1 as test');
        diagnostico.database_connection = 'ok';
        
        // Contar registros
        const usuarios = await pool.query('SELECT COUNT(*) as c FROM usuarios');
        const clientes = await pool.query('SELECT COUNT(*) as c FROM clientes');
        const frigorificos = await pool.query('SELECT COUNT(*) as c FROM frigorificos');
        const operacoes = await pool.query('SELECT COUNT(*) as c FROM operacoes');
        
        diagnostico.table_counts = {
          usuarios: parseInt(usuarios.rows[0].c),
          clientes: parseInt(clientes.rows[0].c),
          frigorificos: parseInt(frigorificos.rows[0].c),
          operacoes: parseInt(operacoes.rows[0].c)
        };
      } catch (err) {
        diagnostico.database_connection = 'erro';
        diagnostico.error = err.message;
      }
    }
    
    res.json(diagnostico);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
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
    if (!pool) {
      return res.status(500).json({ erro: 'Banco de dados não disponível' });
    }
    const result = await pool.query('SELECT * FROM operacoes ORDER BY criadoEm DESC');
    
    // Transformar field names para as que o frontend espera
    const operacoes = result.rows.map(op => ({
      ...op,
      arrobasTotal: op.arrobas,
      valorCompraArroba: op.valorCompra || op.precoCompra,
      valorVendaArroba: op.valorVenda || op.precoVenda
    }));
    
    res.json(operacoes);
  } catch (err) {
    console.error('❌ Erro ao buscar operacoes:', err);
    res.status(500).json({ erro: 'Erro ao buscar operações: ' + err.message });
  }
});

app.post('/api/operacoes', autenticar, async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ erro: 'Banco de dados não disponível' });
    }
    
    console.log('📥 Recebendo nova operação:', req.body);
    
    const { data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes } = req.body;
    
    // Validar campos obrigatórios
    if (!data || cliente_id === null || cabecas === null) {
      console.warn('⚠️ Campos obrigatórios faltando:', {data, cliente_id, cabecas});
      return res.status(400).json({ erro: 'Campos obrigatórios: data, cliente_id, cabecas' });
    }
    
    const result = await pool.query(`
      INSERT INTO operacoes (data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [data, cliente_id, frigorificos_id, cabecas, pesoPorCabeca, pesoTotal, arrobas, valorCompra, valorVenda, precoCompra, precoVenda, totalCompra, totalVenda, lucro, margem, observacoes]);
    
    const op = result.rows[0];
    console.log('✅ Operação inserida com ID:', op.id);
    
    // Transformar field names para as que o frontend espera
    const operacaoTransformada = {
      ...op,
      arrobasTotal: op.arrobas,
      valorCompraArroba: op.valorCompra || op.precoCompra,
      valorVendaArroba: op.valorVenda || op.precoVenda
    };
    
    res.json({ id: op.id, sucesso: true, operacao: operacaoTransformada });
  } catch (err) {
    console.error('❌ Erro ao criar operacao:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ erro: 'Erro ao criar operação: ' + err.message });
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
    if (!pool) {
      return res.status(500).json({ erro: 'Banco de dados não disponível' });
    }
    const result = await pool.query('SELECT * FROM clientes ORDER BY nome');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar clientes:', err);
    res.status(500).json({ erro: 'Erro ao buscar clientes: ' + err.message });
  }
});

app.post('/api/clientes', autenticar, async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ erro: 'Banco de dados não disponível' });
    }
    const { nome, contato } = req.body;
    const result = await pool.query('INSERT INTO clientes (nome, contato) VALUES ($1, $2) RETURNING id', [nome, contato]);
    res.json({ id: result.rows[0].id, sucesso: true });
  } catch (err) {
    console.error('❌ Erro ao criar cliente:', err);
    res.status(500).json({ erro: 'Erro ao criar cliente: ' + err.message });
  }
});

// Frigoríficos
app.get('/api/frigorificos', autenticar, async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ erro: 'Banco de dados não disponível' });
    }
    const result = await pool.query('SELECT * FROM frigorificos ORDER BY nome');
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Erro ao buscar frigorificos:', err);
    res.status(500).json({ erro: 'Erro ao buscar frigorificos: ' + err.message });
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
// Deploy timestamp: Wed Apr 15 07:32:51 -03 2026
