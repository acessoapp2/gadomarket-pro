# 🐂 GadoMarket Pro

Aplicativo de gestão de compra e venda de gado.

---

## 📦 Como rodar no MacBook

### Passo 1 — Instale o Node.js (se não tiver)
Acesse: https://nodejs.org  
Baixe e instale a versão **LTS**.

### Passo 2 — Abra o Terminal no Mac
Pressione `Cmd + Espaço`, digite **Terminal** e pressione Enter.

### Passo 3 — Entre na pasta do projeto
```bash
cd ~/Downloads/gadomarket-pro
```

### Passo 4 — Instale as dependências
```bash
npm install
```
(Aguarde, pode demorar alguns minutos na primeira vez)

### Passo 5 — Rode o aplicativo
```bash
npm start
```

O app vai abrir automaticamente no navegador em:  
👉 **http://localhost:3000**

---

## ✅ Funcionalidades

- **Nova Operação** — Registra compra e venda em 3 etapas
  - Nome do cliente
  - Nome do frigorífico
  - Sexo do animal (Boi 🐂 ou Vaca 🐄)
  - Quantidade de cabeças
  - Peso por cabeça
  - Valor de compra por @
  - Valor de venda por @
  - Despesas (frete, medicamentos, etc.)
  - **Lucro calculado automaticamente**

- **Operações** — Lista com histórico de todas as operações
- **Cadastros** — Gerencia clientes e frigoríficos
- **Relatório** — Faturamento, lucro total, ranking por cliente

---

## 📱 Para usar no Claude (claude.ai)

Abra o arquivo `src/App.jsx` e cole o conteúdo diretamente no Claude como um artifact React.

---

Desenvolvido com ❤️ para gestão pecuária brasileira.
