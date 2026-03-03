#!/bin/bash
# Atualiza dados do Intel Prospects (Receita + IBGE).
# Uso: cron todo dia 1 de cada mês às 2h (0 2 1 * *).
# Requer: DATABASE_URL no .env; arquivos de dados em DATA_DIR ou URLs.
set -e
cd "$(dirname "$0")/../.."
[ -n "$DATA_DIR" ] || DATA_DIR="./data/intel"
mkdir -p "$DATA_DIR"
export NODE_ENV=production

echo "[$(date)] Iniciando atualização Intel Prospects..."

# 1) IBGE - indicadores municipais (atualização menos frequente)
if [ -f "$DATA_DIR/municipios_ibge.json" ]; then
  echo "Importando IBGE (JSON)..."
  npm run intel:import-ibge -- --source="$DATA_DIR/municipios_ibge.json" 2>/dev/null || true
elif [ -f "$DATA_DIR/municipios_ibge.csv" ]; then
  echo "Importando IBGE (CSV)..."
  npm run intel:import-ibge -- --source="$DATA_DIR/municipios_ibge.csv" 2>/dev/null || true
else
  echo "Arquivo IBGE não encontrado em $DATA_DIR (municipios_ibge.csv ou .json). Pulando."
fi

# 2) Receita - empresas por UF (atualização principal)
for uf in SP RJ MG PR RS SC BA PE; do
  if [ -f "$DATA_DIR/receita_${uf}.csv" ]; then
    echo "Importando Receita $uf..."
    npm run intel:import-receita -- --source="$DATA_DIR/receita_${uf}.csv" 2>/dev/null || true
  fi
done
if [ -f "$DATA_DIR/receita.csv" ]; then
  echo "Importando Receita (arquivo único)..."
  npm run intel:import-receita -- --source="$DATA_DIR/receita.csv" 2>/dev/null || true
fi

echo "[$(date)] Atualização concluída."
