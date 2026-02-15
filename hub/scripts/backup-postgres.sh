#!/bin/bash
# Backup do banco PostgreSQL do Hub
# Uso: ./scripts/backup-postgres.sh [destino]
# Exemplo cron (diário às 2h): 0 2 * * * /var/www/north/hub/scripts/backup-postgres.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HUB_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$HUB_DIR/.env"
BACKUP_DIR="${1:-$HUB_DIR/backups}"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

if [ ! -f "$ENV_FILE" ]; then
  echo "Erro: .env não encontrado em $ENV_FILE"
  exit 1
fi

# Extrair DATABASE_URL do .env
source <(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed 's/^/export /')
if [ -z "$DATABASE_URL" ]; then
  echo "Erro: DATABASE_URL não definido no .env"
  exit 1
fi

# pg_dump precisa de variáveis separadas
# Formato: postgresql://user:pass@host:port/dbname
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/hub_db_$TIMESTAMP.sql.gz"

export PGPASSWORD="$DB_PASS"
pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl 2>/dev/null | gzip > "$BACKUP_FILE"
unset PGPASSWORD

echo "Backup criado: $BACKUP_FILE"

# Remover backups antigos
find "$BACKUP_DIR" -name "hub_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
