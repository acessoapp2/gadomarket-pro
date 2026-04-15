const { Pool } = require('pg');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_XerUaR26VCdb@ep-bold-smoke-ack2gh2f.sa-east-1.aws.neon.tech/neondb?sslmode=require';

const hashSenha = (senha) => crypto.createHash('sha256').update(senha).digest('hex');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Inicializando banco de dados...');
    
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
    console.log('✅ Tabela usuarios criada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nome TEXT UNIQUE NOT NULL,
        contato TEXT,
        criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela clientes criada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS frigorificos (
        id SERIAL PRIMARY KEY,
        nome TEXT UNIQUE NOT NULL,
        localizacao TEXT,
        criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela frigorificos criada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS operacoes (
        id SERIAL PRIMARY KEY,
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
        criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (frigorificos_id) REFERENCES frigorificos(id)
      )
    `);
    console.log('✅ Tabela operacoes criada');

    await client.query(`
      CREATE TABLE IF NOT EXISTS despesas (
        id SERIAL PRIMARY KEY,
        operacao_id INTEGER NOT NULL,
        descricao TEXT NOT NULL,
        valor REAL NOT NULL,
        criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (operacao_id) REFERENCES operacoes(id)
      )
    `);
    console.log('✅ Tabela despesas criada');

    // Inserir admin
    const result = await client.query('SELECT * FROM usuarios WHERE username = $1', ['admin']);
    if (result.rows.length === 0) {
      await client.query(
        'INSERT INTO usuarios (username, senha) VALUES ($1, $2)',
        ['admin', hashSenha('gado@2024')]
      );
      console.log('✅ Usuário admin criado');
    } else {
      console.log('✅ Usuário admin já existe');
    }

    console.log('\n✅ Banco de dados inicializado com sucesso!');
    console.log('Credenciais: admin / gado@2024');
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

initDB();
