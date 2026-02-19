# Hub - Portal Clientes + Admin

Portal do Cliente e Painel Admin para Nortempresarial.

**Produção:** https://hub.northempresarial.com

## Stack

- Next.js 16 (App Router)
- NextAuth.js v5 (autenticação)
- Prisma 7 + PostgreSQL
- Tailwind CSS
- Tabler Icons
- Zod (validação)
- Vitest (testes unitários)

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha. As variáveis abaixo são validadas na inicialização (veja `src/lib/env.ts`).

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `DATABASE_URL` | Sim | URL do PostgreSQL (ex.: `postgresql://user:pass@host:5432/db?schema=public`) |
| `NEXTAUTH_URL` | Sim | URL do Hub (ex.: `https://hub.exemplo.com` ou `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Sim | Segredo para sessões (gere com `openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | Não | Chave para criptografia de conexões (opcional; `openssl rand -hex 32`) |

## Setup

1. Copie `.env.example` para `.env` e configure as variáveis obrigatórias.
2. Instale dependências e gere o cliente Prisma:

```bash
npm ci
npx prisma generate
```

3. Execute as migrações e o seed:

```bash
npx prisma migrate dev
npx prisma db seed
```

4. Rode o projeto:

```bash
npm run dev        # desenvolvimento
npm run build && npm start   # produção
```

## Scripts úteis

- `npm run lint` — ESLint
- `npm run test` — Testes unitários (Vitest)
- `npm run db:migrate` — Aplica migrações em desenvolvimento
- `npm run db:push` — Sincroniza schema sem migrações (cuidado em produção)
- `npm run db:seed` — Executa o seed do banco

## Health check

O endpoint `GET /api/health` retorna o status da aplicação e da conexão com o banco (útil para load balancer e monitoramento). Não exige autenticação.

## Estrutura de rotas

- `/login` — Login (portal e admin)
- `/dashboard` — Dashboard do cliente
- `/relatorios` — Relatórios liberados ao usuário
- `/ferramentas/[slug]` — Ferramentas do cliente (negociações, ajuste de despesa, etc.)
- `/helpdesk`, `/helpdesk/meus-chamados`, `/helpdesk/filas`, `/helpdesk/areas-geridas`, `/helpdesk/arvore` — Helpdesk
- `/conta` — Perfil do usuário
- `/admin/config/*` — CRUD Admin (clientes, usuários, grupos, setores, conexões, permissões, ferramentas, relatórios)
- `/admin/helpdesk/*` — Tipos de solicitação e aprovações
- `/admin/logs` — Auditoria
