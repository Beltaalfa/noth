#!/bin/bash
# Restaura backup do banco PostgreSQL do Hub
# Uso: ./scripts/restore-postgres.sh <arquivo_backup.sql ou arquivo_backup.sql.gz>
# Exemplo: ./scripts/restore-postgres.sh hub_db_20250215_020000.sql.gz

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HUB_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$HUB_DIR/.env"
BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Uso: $0 <arquivo_backup.sql ou arquivo_backup.sql.gz>"
  echo "Exemplo: $0 backups/hub_db_20250215_020000.sql.gz"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Erro: .env não encontrado em $ENV_FILE"
  exit 1
fi

source <(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed 's/^/export /')
if [ -z "$DATABASE_URL" ]; then
  echo "Erro: DATABASE_URL não definido no .env"
  exit 1
fi

DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')

echo "Restaurando de $BACKUP_FILE para $DB_NAME..."
echo "ATENÇÃO: Os dados atuais serão sobrescritos!"
read -p "Continuar? (s/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
  echo "Cancelado."
  exit 0
fi

export PGPASSWORD="$DB_PASS"

if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1
else
  psql -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -f "$BACKUP_FILE"
fi

unset PGPASSWORD
echo "Restauração concluída."
