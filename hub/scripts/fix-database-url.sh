#!/bin/bash
# Remove a URL antiga (prisma+postgres) e adiciona linha para PostgreSQL real.
# Depois edite o .env e troque TROQUE_A_SENHA pela senha do Postgres.

set -e
ENV_FILE="/var/www/north/hub/.env"
cd "$(dirname "$0")/.."

[ -f "$ENV_FILE" ] || { echo ".env não encontrado"; exit 1; }

cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
sed -i.tmp '/^DATABASE_URL=/d' "$ENV_FILE"
rm -f "$ENV_FILE.tmp"

echo 'DATABASE_URL="postgresql://postgres:TROQUE_A_SENHA@127.0.0.1:5432/hub_db?schema=public"' >> "$ENV_FILE"
echo "Pronto. Edite o .env e substitua TROQUE_A_SENHA pela senha do PostgreSQL."
echo "Depois: npm run db:seed"
