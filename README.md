# API Open Finance

App pessoal de finanças com sincronização automática via Open Finance (Pluggy). Dashboard mobile-first com visão geral, contas, transações, categorias, metas e análises.

## Estrutura

- **`finance-app/`** — backend (NestJS + Prisma + Postgres). Integração com a Pluggy, sync automático a cada 3h, webhook de eventos, analytics e planejamento (orçamentos/metas).
- **`finance-web/`** — frontend (Next.js). Dashboard mobile com layout próprio para desktop (menu lateral), widget Pluggy Connect embutido e login por senha.
- **`finance-mcp/`** — servidor MCP. Expõe contas, transações, analytics, metas e orçamentos como tools para clientes de IA (Claude Code, Claude Desktop), consultando o backend por HTTP. Somente leitura.

## Rodando localmente

Cada pasta é um projeto independente com seu próprio `package.json`.

```bash
# backend
cd finance-app
cp .env.example .env   # preencha com suas credenciais
npm install
npx prisma migrate deploy
npm run start:dev

# frontend (em outro terminal)
cd finance-web
npm install
npm run dev

# servidor MCP (opcional — conversar com a IA sobre suas financas)
cd finance-mcp
npm install
npm run build
claude mcp add finance -s user -- node "$PWD/dist/index.js"
```

### Variáveis de ambiente (`finance-app/.env`)

| Variável | Descrição |
|---|---|
| `PLUGGY_CLIENT_ID` / `PLUGGY_CLIENT_SECRET` | Credenciais da sua aplicação em [dashboard.pluggy.ai](https://dashboard.pluggy.ai) |
| `DATABASE_URL` | Connection string do Postgres (ex.: [Neon](https://neon.tech), free) |
| `APP_PASSWORD` | Senha de acesso ao app (tela de login) — escolha a sua |
| `AUTH_SECRET` | Segredo aleatório para assinar o cookie de sessão (ex.: `openssl rand -hex 32`) |
| `PLUGGY_WEBHOOK_SECRET` | Opcional — protege `POST /pluggy/webhook` |
| `CORS_ORIGINS` | Domínio do frontend em produção (ex.: sua URL da Vercel) |

Nenhuma dessas credenciais fica no repositório — cada pessoa que rodar o projeto tem que usar as suas próprias.

## Deploy

- **Backend**: Render (free) — `render.yaml` já define build/start commands; as variáveis sensíveis são preenchidas manualmente no dashboard.
- **Banco**: Neon (free).
- **Frontend**: Vercel — variável `BACKEND_URL` apontando para a URL do backend no Render.

## Conectar um banco

O widget usa o conector gratuito **MeuPluggy**: crie uma conta em [meu.pluggy.ai](https://meu.pluggy.ai), conecte seu banco real lá, e o app importa os dados via Open Finance.
