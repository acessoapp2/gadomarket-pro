# Código Secreto Master de Reset de Senha

## Informações

**Código Secreto:** `GADO@RESET@2026`

**Validade:** PERMANENTE (não expira)

**Tipo:** Master Key para resetar senha sem passar pelo "Esqueci Minha Senha"

---

## Como Usar

### Via Interface Web

1. Acesse: http://localhost:3000
2. Clique em "🔑 Resetar com Código Secreto" na página de login
3. Preencha:
   - **Usuário:** admin
   - **Código Secreto:** GADO@RESET@2026
   - **Nova Senha:** sua nova senha
4. Clique em "✅ Resetar Senha"

### Via API

```bash
curl -X POST http://localhost:3001/api/resetar-senha-master \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "masterKey": "GADO@RESET@2026",
    "novaSenha": "nova_senha_123"
  }'
```

**Resposta (sucesso):**
```json
{
  "success": true,
  "message": "Senha alterada com sucesso usando código master"
}
```

---

## Comparação de Métodos

| Método | Código | Validade | Endpoint |
|--------|--------|----------|----------|
| **Esqueci minha senha** | Gerado (8 dígitos) | 30 minutos | `/api/esqueci-senha` + `/api/resetar-senha` |
| **Código Secreto Master** | Fixo permanente | Sem expiry | `/api/resetar-senha-master` |

---

## Segurança

- ✅ Código criptografado no banco de dados
- ✅ Válido permanentemente
- ✅ Pode ser alterado via variável de ambiente

### Alterar o Código Master

```bash
export MASTER_RESET_KEY="seu_novo_codigo"
npm run dev
```

---

## Endpoints Disponíveis

### POST /api/esqueci-senha
Gera código temporário de recuperação

### POST /api/resetar-senha
Reseta senha com código temporário

### POST /api/resetar-senha-master
Reseta senha com código secreto master

### GET /api/master-reset-key (autenticado)
Retorna o código secreto master (somente admin)

---

## Acesso

- 🖥️ Web: http://localhost:3000
- 📡 API: http://localhost:3001

---

**Data de Criação:** 14 de Abril de 2026
**Versão:** 2.0.0
