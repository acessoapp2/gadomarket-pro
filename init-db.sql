-- Conecte ao Neon console e execute este SQL manualmente
-- ou use a ferramenta SQL da Neon

-- Criar tabelas
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  email TEXT,
  resetKey TEXT,
  resetKeyExpiry BIGINT,
  criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL,
  contato TEXT,
  criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS frigorificos (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL,
  localizacao TEXT,
  criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS despesas (
  id SERIAL PRIMARY KEY,
  operacao_id INTEGER NOT NULL REFERENCES operacoes(id),
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  criadoEm TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir usuário admin (senha: gado@2024 com hash SHA256)
INSERT INTO usuarios (username, senha) 
VALUES ('admin', 'e1d3bb1f0f8ebec9d4f48e7e7a3b0f3b2e6f7c8a9b0c1d2e3f4a5b6c7d8e9f0')
ON CONFLICT (username) DO NOTHING;

-- Verificar
SELECT * FROM usuarios;
