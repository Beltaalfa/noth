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

## Setup

1. Copie `.env.example` para `.env`
2. Configure `DATABASE_URL` (PostgreSQL)
3. Configure `NEXTAUTH_URL` e `NEXTAUTH_SECRET`
4. Execute as migrações:

```bash
npx prisma migrate dev
npx prisma db seed
```

5. Rode o projeto:

```bash
npm run dev   # desenvolvimento
npm run build && npm start  # produção
```

## Estrutura

- `/login` - Login (portal e admin)
- `/dashboard` - Dashboard do cliente
- `/ferramentas/[slug]` - Ferramentas do cliente
- `/conta` - Perfil do usuário
- `/admin/config/*` - CRUD Admin (clientes, usuários, grupos, setores, conexões, permissões)
- `/admin/logs` - Auditoria
