# Intel Prospects – Como aplicar o seed e manter dados atualizados

## 1. Aplicar após rodar o seed (Opção A)

Depois de executar `npm run db:seed`:

1. **Reiniciar o HUB** para que a aplicação use o banco já populado:
   - **PM2:** `pm2 restart hub` (ou o nome do processo do HUB)
   - **Docker:** `docker compose restart web` (na pasta do hub)
   - **Manual:** parar e subir de novo com `npm run start`

2. **No navegador:** abra o Intel Prospects e atualize a página (F5 ou Ctrl+F5). As listas de estados, municípios, CNAEs e portes passam a usar os dados do banco.

3. **Conferir:** em Intel Prospects → Busca, escolha um estado (ex.: MG). Os municípios e CNAEs devem carregar; faça uma busca para ver resultados se o seed tiver empresas de exemplo.

---

## 2. Manter as informações sempre atualizadas

Os dados vêm da **Receita Federal** (CNPJs) e do **IBGE** (municípios/indicadores). Para manter tudo atualizado:

### 2.1 Fontes oficiais

- **Receita:** dados abertos em [dados.gov.br](https://dados.gov.br) ou FTP Receita (CSV de empresas por UF).
- **IBGE:** indicadores municipais em [IBGE](https://www.ibge.gov.br/estatisticas/downloads-estatisticas.html) ou API (ex.: SIDRA).

### 2.2 Atualização todo dia 1 de cada mês (cron)

O script `scripts/intel/atualizar-dados.sh` roda os imports da Receita e do IBGE. O agendamento recomendado é **todo dia 1 de cada mês às 2h da manhã**.

**Comandos para aplicar (rodar no servidor):**

```bash
# 1) Ir para a pasta do hub
cd /var/www/north/hub

# 2) Deixar o script executável
chmod +x scripts/intel/atualizar-dados.sh

# 3) Criar pasta de dados (e depois colocar aí receita_*.csv e municipios_ibge.csv ou .json)
mkdir -p data/intel

# 4) Agendar no cron: todo dia 1 de cada mês às 2h
(crontab -l 2>/dev/null; echo "0 2 1 * * cd /var/www/north/hub && DATA_DIR=./data/intel ./scripts/intel/atualizar-dados.sh >> /var/log/intel-atualizacao.log 2>&1") | crontab -
```

**Conferir se o cron foi adicionado:**

```bash
crontab -l
```

**Testar o script manualmente (opcional):**

```bash
cd /var/www/north/hub
DATA_DIR=./data/intel ./scripts/intel/atualizar-dados.sh
```

**Arquivos em `data/intel/`:** `receita.csv` ou `receita_SP.csv`, `receita_MG.csv`, etc.; e `municipios_ibge.csv` ou `municipios_ibge.json`. O log fica em `/var/log/intel-atualizacao.log`.

### 2.3 Atualização manual

Sempre que tiver um CSV novo da Receita ou IBGE:

```bash
cd /var/www/north/hub
npm run intel:import-receita -- --source=./caminho/para/receita.csv
npm run intel:import-ibge -- --source=./caminho/para/ibge.csv
```

Os comandos fazem **upsert** (atualizam registros existentes e inserem novos), então pode rodar várias vezes sem duplicar.

---

## Resumo

| Objetivo | O que fazer |
|----------|-------------|
| **Aplicar o seed** | Reiniciar o HUB e atualizar a página do Intel Prospects no navegador. |
| **Dados sempre atualizados** | Cron todo dia 1 de cada mês (comando abaixo). Colocar arquivos em `data/intel/` (Receita + IBGE). |
