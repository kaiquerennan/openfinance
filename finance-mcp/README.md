# finance-mcp

Servidor [MCP](https://modelcontextprotocol.io) que expõe os dados do `finance-app` para clientes de IA (Claude Code, Claude Desktop). Em vez de despejar o extrato inteiro num prompt, o modelo chama tools e puxa só o que a pergunta pede.

```
Claude ⇄ stdio ⇄ finance-mcp ⇄ HTTP (cookie de sessão) ⇄ finance-app :3334 ⇄ Postgres
```

## Tools (todas somente leitura)

| Tool | O que traz |
|---|---|
| `listar_meses` | Meses com dados sincronizados + qual é o mais recente |
| `relatorio_mensal` | Relatório completo do mês: receita, gastos, categorias, assinaturas, score de saúde, projeção, hábitos, reserva |
| `serie_mensal` | Renda/consumo/sobra e categorias mês a mês (até 36 meses) |
| `contas_e_saldos` | Contas com saldo, e nos cartões limite, fatura atual, fechamento e vencimento |
| `investimentos` | Posições ativas com saldo atual e total aplicado |
| `transacoes` | Lançamentos com filtro por mês, período, categoria, busca e conta |
| `metas` | Metas com valor alvo, poupado, aportes e prazo |
| `orcamentos` | Limites por categoria (`_global` = teto geral do mês) |

O campo `valor` das transações já sai com sinal econômico (negativo = saiu dinheiro): compras de cartão chegam da Pluggy como `DEBIT` com valor positivo, e o servidor normaliza pelo `type` — a mesma regra do `AnalyticsService`.

## Setup

```bash
cd finance-mcp
npm install
npm run build
```

Nenhuma configuração extra: o servidor lê `PORT` e `APP_PASSWORD` do `finance-app/.env` que está ao lado no monorepo, então a senha vive num lugar só. Para apontar para outro backend (ex.: o deploy no Render), sobrescreva por variável de ambiente:

| Variável | Padrão |
|---|---|
| `FINANCE_API_URL` | `http://localhost:$PORT` do `.env` do backend |
| `FINANCE_APP_PASSWORD` | `APP_PASSWORD` do `.env` do backend |

## Registrando no cliente

**Claude Code** (já registrado no escopo `user`):

```bash
claude mcp add finance -s user -- node /caminho/para/finance-mcp/dist/index.js
claude mcp list          # confere a conexão
```

**Claude Desktop** — em `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "finance": {
      "command": "node",
      "args": ["/caminho/para/finance-mcp/dist/index.js"]
    }
  }
}
```

O backend precisa estar no ar (`cd finance-app && npm run start:dev`); se estiver fora, as tools retornam um erro dizendo isso.

## Testando

```bash
npm run smoke
```

Sobe o servidor por stdio como um cliente real, lista as tools, chama todas contra o backend e verifica que os casos de erro voltam mensagem utilizável.
