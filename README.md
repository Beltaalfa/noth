# Backup — Site institucional (Norte Empresarial)

Backup do site que estava em `ecosystem/apps/site`. Use esta pasta para migrar o site para outro servidor ou repositório.

## Conteúdo

- **public/** — Assets: logos, vídeos, Lottie, ícones, logos de clientes.
- **.next/** — Build Next.js (para servir com next start ou export estático).
- **src/** — Estrutura de pastas do app.
- **scripts/** — Pasta de scripts.

## Como usar

Para servir o build: instale next, react, react-dom e rode `npx next start -p 3000` nesta pasta. Para projeto completo, adicione package.json e tsconfig (ex.: baseado no Hub) e o código-fonte em src se tiver em outro lugar/Git.

Backup gerado a partir de /var/www/bi/ecosystem/apps/site.
