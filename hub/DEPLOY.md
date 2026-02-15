# Deploy do Hub - hub.northempresarial.com

## Pré-requisitos

- Node.js 20+
- PostgreSQL
- Servidor com acesso ao subdomínio hub.northempresarial.com

## Configuração no servidor

1. **Clone/copie o projeto** para o servidor (ex: `/var/www/hub` ou pasta do HostGator)

2. **Configure o arquivo .env**:
   ```bash
   cp .env.production.example .env
   ```
   Edite `.env` e preencha:
   - `NEXTAUTH_URL=https://hub.northempresarial.com`
   - `NEXTAUTH_SECRET` - gere com: `openssl rand -base64 32`
   - `DATABASE_URL` - string de conexão PostgreSQL (ex: `postgresql://usuario:senha@host:5432/hub_db`)

3. **Instale dependências e rode migrations**:
   ```bash
   cd /var/www/north/hub
   npm install
   npx prisma migrate deploy
   npm run db:seed
   ```

4. **Build e start**:
   ```bash
   npm run build
   npm start
   ```

5. **Usuário admin inicial** (criado pelo seed):
   - Email: admin@northempresarial.com
   - Senha: admin123
   - **Altere a senha após o primeiro login!**

## HostGator / cPanel

Se usar HostGator com Node.js:
- Crie o aplicativo Node.js apontando para a pasta do Hub
- Configure as variáveis de ambiente (NEXTAUTH_URL, NEXTAUTH_SECRET, DATABASE_URL)
- Use o banco PostgreSQL do HostGator ou externo
- O start command deve ser: `npm start` ou `node .next/standalone/server.js` (se usar output: 'standalone')

## Proxy reverso (Nginx)

Se usar Nginx na frente do Node:
```nginx
server {
    server_name hub.northempresarial.com;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
