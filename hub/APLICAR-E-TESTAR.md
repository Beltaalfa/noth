# Como aplicar e testar o Hub

## 1. Dependências e banco

```bash
cd /var/www/north/hub
npm install
npx prisma generate
```

## 2. Migrations (se ainda não aplicou)

Em **desenvolvimento** (cria/atualiza migrations):

```bash
npm run db:migrate
```

Em **produção** (só aplica migrations existentes):

```bash
npx prisma migrate deploy
```

Se não usar migrations e quiser só sincronizar o schema:

```bash
npm run db:push
```

## 3. Build e subir o Hub

```bash
npm run build
npm run start
```

O Hub sobe na porta **3007** (definida no `package.json`).

## 4. Se usar PM2

```bash
cd /var/www/north/hub
npm run build
pm2 restart hub
# ou, se o processo se chama de outra forma:
# pm2 list
# pm2 restart <nome-do-app-hub>
```

## 5. Testar no navegador

- **Login admin**: acesse `http://seu-dominio:3007/login` (ou a URL do hub).
- **Admin → Configurações → Usuários**:  
  - Vincule **clientes** ao usuário (ícone de chave “Permissões”) para ele ver Helpdesk e ferramentas no portal.  
  - Confira a coluna **Clientes** e o texto de ajuda.
- **Admin → Configurações → Clientes**:  
  - Clique no ícone de **ferramentas** em um cliente e teste adicionar/remover ferramentas.
- **Admin → Configurações → Ferramentas**:  
  - Use **“Sincronizar vínculos com clientes”** se tiver ferramentas antigas que não aparecem no portal.
- **Portal (usuário cliente)**: faça login com um usuário que tenha pelo menos um cliente vinculado e confira o menu (Dashboard, Helpdesk, ferramentas, Minha conta).

## 6. Variável de ambiente

Garanta que existe `.env` na pasta do hub com pelo menos:

- `DATABASE_URL` – connection string do PostgreSQL
- Variáveis do NextAuth (ex.: `AUTH_SECRET`, `NEXTAUTH_URL`) se usar login

Exemplo mínimo:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/nome_do_banco"
AUTH_SECRET="uma-string-secreta-longa"
NEXTAUTH_URL="http://localhost:3007"
```

Depois de aplicar (migrations + build + restart), use os passos da seção 5 para testar tudo.
