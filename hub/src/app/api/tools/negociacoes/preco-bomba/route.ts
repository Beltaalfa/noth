import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getClientDbConnection } from "@/lib/db-connections";
import { Pool } from "pg";
import { getClientIdsForNegociacoes } from "@/lib/permissions";

/**
 * Valor de bomba (preço fixo) por item para a empresa.
 * Mesma lógica do painel de negociações (buscar): UltimoPrecoFixo em tab_preco_venda
 * com cod_pessoa NULL e cod_condicao_pagamento NULL, último por dta_inicio.
 */
const QUERY = `
WITH UltimoPreco AS (
    SELECT
        tpv.cod_item,
        tpv.val_preco_venda_a,
        ROW_NUMBER() OVER (PARTITION BY tpv.cod_item ORDER BY tpv.dta_inicio DESC) AS rn
    FROM tab_preco_venda tpv
    WHERE tpv.cod_empresa = $1
      AND tpv.cod_pessoa IS NULL
      AND tpv.cod_condicao_pagamento IS NULL
      AND tpv.dta_inicio <= CURRENT_DATE
)
SELECT c.cod_item, c.des_item, up.val_preco_venda_a AS valor_bomba
FROM UltimoPreco up
JOIN tab_item c ON c.cod_item = up.cod_item
WHERE up.rn = 1
  AND c.cod_subgrupo_item = 1
ORDER BY c.des_item
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
  const codEmpresa = searchParams.get("codEmpresa");
  if (!clientId) {
    return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  }
  const codEmp = codEmpresa != null ? parseInt(String(codEmpresa), 10) : NaN;
  if (Number.isNaN(codEmp)) {
    return NextResponse.json({ error: "codEmpresa obrigatório" }, { status: 400 });
  }

  const isAdmin = (session.user as { role?: string })?.role === "admin";
  const allowedClientIds = await getClientIdsForNegociacoes(userId, isAdmin);
  if (!allowedClientIds.includes(clientId)) {
    return NextResponse.json({ error: "Sem permissão para este cliente" }, { status: 403 });
  }

  try {
    const creds = await getClientDbConnection(clientId, "negociacoes");
    const pool = new Pool({
      ...creds,
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect();
    const result = await client.query(QUERY, [codEmp]);
    client.release();
    await pool.end();

    return NextResponse.json(
      result.rows.map((r: { cod_item: unknown; des_item: unknown; valor_bomba: unknown }) => ({
        cod_item: Number(r.cod_item),
        des_item: String(r.des_item ?? ""),
        valor_bomba: Number(r.valor_bomba ?? 0),
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar preços de bomba";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
