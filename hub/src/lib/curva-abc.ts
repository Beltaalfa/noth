import { getClientDbConnection } from "@/lib/db-connections";
import { Pool } from "pg";

/** Mesma Curva ABC da API (volume últimos 3 meses). Usado para obter só o nível por cod_pessoa. */
const QUERY_CURVA_ABC_BASE = `
WITH volume_cliente AS (
    SELECT
        a.cod_pessoa,
        a.nom_pessoa,
        ROUND(SUM(j.qtd_item)::numeric, 2) AS volume_litros
    FROM tab_pessoa a
    JOIN tab_cupom_fiscal e ON e.cod_pessoa_cliente = a.cod_pessoa
    JOIN tab_item_cupom_fiscal j ON j.seq_cupom = e.seq_cupom
    JOIN tab_item k ON k.cod_item = j.cod_item
    WHERE a.ind_cliente       = 'S'
      AND a.ind_bloqueado     = 'N'
      AND a.ind_pessoa_ativa  = 'S'
      AND a.cod_pessoa        <> 1
      AND e.ind_cancelado     = 'N'
      AND j.ind_cancelado     = 'N'
      AND e.dta_cupom         >= CURRENT_DATE - INTERVAL '3 months'
      AND k.cod_subgrupo_item = 1
    GROUP BY a.cod_pessoa, a.nom_pessoa
),
total_geral AS (
    SELECT SUM(volume_litros) AS total_litros FROM volume_cliente
),
ranked AS (
    SELECT
        v.cod_pessoa,
        v.nom_pessoa,
        v.volume_litros,
        SUM(v.volume_litros) OVER (ORDER BY v.volume_litros DESC NULLS LAST) AS volume_acumulado,
        ROW_NUMBER() OVER (ORDER BY v.volume_litros DESC NULLS LAST) AS posicao
    FROM volume_cliente v
)
SELECT
    r.cod_pessoa,
    r.nom_pessoa AS cliente,
    CASE
        WHEN 100.0 * r.volume_acumulado / NULLIF(t.total_litros, 0) <= 80 THEN 'A'
        WHEN 100.0 * r.volume_acumulado / NULLIF(t.total_litros, 0) <= 95 THEN 'B'
        ELSE 'C'
    END AS curva_abc
FROM ranked r
CROSS JOIN total_geral t
`;

const QUERY_NIVEL_POR_COD = `SELECT curva_abc AS nivel FROM (${QUERY_CURVA_ABC_BASE}) sub WHERE cod_pessoa = $1 LIMIT 1`;

/**
 * Retorna o nível na Curva ABC (A, B ou C) para um cliente e cod_pessoa, consultando o banco do cliente.
 * Usa a mesma regra da API: volume (litragem) últimos 3 meses; A até 80%, B 80–95%, C 95–100%.
 */
export async function getNivelCurvaABCPorCodPessoa(
  clientId: string,
  codPessoa: number
): Promise<string | null> {
  try {
    const creds = await getClientDbConnection(clientId, "negociacoes");
    const pool = new Pool({
      ...creds,
      connectionTimeoutMillis: 15000,
    });
    const client = await pool.connect();
    const result = await client.query(QUERY_NIVEL_POR_COD, [codPessoa]);
    client.release();
    await pool.end();
    const row = result.rows[0];
    if (!row?.nivel) return null;
    const nivel = String(row.nivel).toUpperCase().replace(/[^ABC]/g, "");
    return nivel === "A" || nivel === "B" || nivel === "C" ? nivel : null;
  } catch {
    return null;
  }
}
