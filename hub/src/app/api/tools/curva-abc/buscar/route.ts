import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getClientDbConnection } from "@/lib/db-connections";
import { Pool } from "pg";
import { getClientIdsForCurvaABC } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

/** Curva ABC por volume (litragem) últimos 3 meses. A = até 80% acumulado, B = 80–95%, C = 95–100%. */
const QUERY_CURVA_ABC = `
WITH volume_cliente AS (
    SELECT
        a.cod_pessoa,
        a.nom_pessoa,
        ROUND(SUM(j.qtd_item)::numeric, 2) AS volume_litros
    FROM tab_pessoa a
    JOIN tab_cupom_fiscal e
        ON e.cod_pessoa_cliente = a.cod_pessoa
    JOIN tab_item_cupom_fiscal j
        ON j.seq_cupom = e.seq_cupom
    JOIN tab_item k
        ON k.cod_item = j.cod_item
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
    SELECT SUM(volume_litros) AS total_litros
    FROM volume_cliente
),
ranked AS (
    SELECT
        v.cod_pessoa,
        v.nom_pessoa,
        v.volume_litros,
        SUM(v.volume_litros) OVER (ORDER BY v.volume_litros DESC NULLS LAST) AS volume_acumulado,
        ROW_NUMBER() OVER (ORDER BY v.volume_litros DESC NULLS LAST)       AS posicao
    FROM volume_cliente v
)
SELECT
    r.cod_pessoa,
    r.nom_pessoa                         AS cliente,
    r.volume_litros,
    r.volume_acumulado,
    ROUND(100.0 * r.volume_acumulado / NULLIF(t.total_litros, 0), 2)     AS perc_volume_acumulado,
    r.posicao                             AS posicao_ranking,
    CASE
        WHEN 100.0 * r.volume_acumulado / NULLIF(t.total_litros, 0) <= 80 THEN 'A'
        WHEN 100.0 * r.volume_acumulado / NULLIF(t.total_litros, 0) <= 95 THEN 'B'
        ELSE 'C'
    END                                  AS curva_abc
FROM ranked r
CROSS JOIN total_geral t
ORDER BY r.posicao
`;

export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") ?? searchParams.get("clienteId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  }

  const isAdmin = (session.user as { role?: string })?.role === "admin";
  const allowedClientIds = await getClientIdsForCurvaABC(userId, isAdmin);
  if (!allowedClientIds.includes(clientId)) {
    return NextResponse.json({ error: "Sem permissão para este cliente" }, { status: 403 });
  }

  const codPessoaParam = searchParams.get("cod_pessoa");
  const codPessoa = codPessoaParam != null && codPessoaParam !== "" ? parseInt(codPessoaParam, 10) : null;
  const busca = (searchParams.get("busca") ?? "").trim();

  const useFilter = (codPessoa != null && !Number.isNaN(codPessoa)) || busca !== "";
  const query = useFilter
    ? `SELECT * FROM (${QUERY_CURVA_ABC}) sub WHERE ($1::int IS NULL OR cod_pessoa = $1) AND ($2 = '' OR cliente ILIKE '%' || $2 || '%') ORDER BY posicao_ranking`
    : QUERY_CURVA_ABC;
  const params = useFilter ? [Number.isNaN(codPessoa as number) ? null : codPessoa, busca] : [];

  try {
    const creds = await getClientDbConnection(clientId, "negociacoes");
    const pool = new Pool({
      ...creds,
      connectionTimeoutMillis: 15000,
    });
    const client = await pool.connect();
    const result = await client.query(query, params);
    client.release();
    await pool.end();

    const rows = result.rows.map((r) => ({
      cod_pessoa: Number(r.cod_pessoa),
      nom_pessoa: String(r.cliente ?? r.nom_pessoa ?? ""),
      nivel_curva_abc: String(r.curva_abc ?? "").toUpperCase().replace(/[^ABC]/g, "") || null,
      volume_litros: r.volume_litros != null ? Number(r.volume_litros) : null,
      volume_acumulado: r.volume_acumulado != null ? Number(r.volume_acumulado) : null,
      perc_volume_acumulado: r.perc_volume_acumulado != null ? Number(r.perc_volume_acumulado) : null,
      posicao_ranking: r.posicao_ranking != null ? Number(r.posicao_ranking) : null,
    }));

    await logAudit({
      userId,
      action: "curva_abc_busca",
      entity: "CurvaABC",
      entityId: clientId,
      details: JSON.stringify({ clientId, codPessoa, buscaLength: busca.length, qtdLinhas: rows.length }),
    });

    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar Curva ABC";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
