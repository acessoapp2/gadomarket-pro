# 🐂 GadoMarket Pro — Guia de Publicação na Internet

## O que você vai precisar

- Conta gratuita no **GitHub** (para guardar o código): https://github.com
- Conta gratuita no **Railway** (para hospedar o app): https://railway.app

---

## PASSO 1 — Subir o código no GitHub

1. Acesse https://github.com e crie uma conta (se não tiver)
2. Clique em **"New repository"** (botão verde no canto superior direito)
3. Nomeie como `gadomarket-pro` e clique em **"Create repository"**
4. No seu Mac, abra o **Terminal** e execute:

```bash
cd ~/Downloads/gadomarket-pro

# Inicializar o Git (só na primeira vez)
git init
git add .
git commit -m "GadoMarket Pro v2.0 - Web com Login"

# Conectar ao GitHub (substitua SEU-USUARIO pelo seu usuário do GitHub)
git remote add origin https://github.com/SEU-USUARIO/gadomarket-pro.git
git branch -M main
git push -u origin main
```

---

## PASSO 2 — Publicar no Railway

1. Acesse https://railway.app e crie uma conta com o GitHub
2. Clique em **"New Project"**
3. Selecione **"Deploy from GitHub repo"**
4. Escolha o repositório `gadomarket-pro`
5. Railway vai detectar automaticamente que é um projeto Node.js

### Configurar as variáveis de ambiente no Railway:

No painel do Railway, vá em **Variables** e adicione:

| Variável | Valor |
|----------|-------|
| `ADMIN_USER` | `admin` (ou o usuário que quiser) |
| `ADMIN_PASS` | Uma senha forte (ex: `MinhaSenha@2024`) |
| `JWT_SECRET` | Uma sequência aleatória longa (ex: `chave-super-secreta-do-gado-2024`) |
| `NODE_ENV` | `production` |

### Configurar o Volume para o banco de dados:

1. No Railway, vá em **"Add Plugin"** → **"Volume"**
2. Monte o volume em `/app/data`
3. Adicione a variável: `DB_PATH` = `/app/data/gadomarket.db`

### Configurar os comandos de build:

Railway deve detectar automaticamente, mas se precisar configurar manualmente:
- **Build Command:** `npm run build`
- **Start Command:** `npm start`

---

## PASSO 3 — Acessar o app

Após o deploy (2-3 minutos), Railway vai gerar um link público tipo:
```
https://gadomarket-pro-production.up.railway.app
```

**Login inicial:**
- Usuário: `admin` (ou o que você definiu)
- Senha: A senha que você colocou em `ADMIN_PASS`

---

## Rodar localmente no Mac

```bash
# 1. Instalar dependências
cd ~/Downloads/gadomarket-pro
npm install

# 2. Copiar o arquivo de configuração
cp .env.example .env
# Edite o .env com suas credenciais

# 3. Modo desenvolvimento (API + React juntos)
npm run dev

# 4. Acessar em:
# → App React: http://localhost:3000
# → API:       http://localhost:3001
```

---

## Estrutura do projeto

```
gadomarket-pro/
├── server.js          ← Servidor Node.js + API + Banco de dados
├── gadomarket.db      ← Banco de dados SQLite (criado automaticamente)
├── src/
│   ├── App.jsx        ← Aplicação React completa
│   └── index.js       ← Ponto de entrada React
├── public/            ← Arquivos estáticos
├── build/             ← Build de produção (gerado pelo npm run build)
├── package.json       ← Dependências e scripts
├── .env.example       ← Exemplo de variáveis de ambiente
└── DEPLOY.md          ← Este guia
```

---

## Atualizar o app após mudanças

```bash
cd ~/Downloads/gadomarket-pro
git add .
git commit -m "Descrição do que foi mudado"
git push
```
O Railway detecta automaticamente e faz o novo deploy em segundos.

---

*GadoMarket Pro v2.0 — Desenvolvido para gestão pecuária no Brasil 🇧🇷🐂*
