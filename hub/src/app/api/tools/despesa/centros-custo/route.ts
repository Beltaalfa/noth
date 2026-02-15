import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { canUserAccessAlteracaoDespesaPmg } from "@/lib/permissions";
import { getPmgDbConnection } from "@/lib/db-connections";
import { Pool } from "pg";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  const canAccess = await canUserAccessAlteracaoDespesaPmg(userId);
  if (!canAccess) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const creds = await getPmgDbConnection();
    const pool = new Pool({
      ...creds,
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect();
    const result = await client.query(
      "SELECT a.cod_centro_custo, a.des_centro_custo FROM tab_centro_custo a WHERE a.dta_fim_validade > 'today' ORDER BY a.des_centro_custo"
    );
    client.release();
    await pool.end();

    return NextResponse.json(
      result.rows.map((r) => ({
        cod_centro_custo: r.cod_centro_custo,
        des_centro_custo: r.des_centro_custo,
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar centros de custo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
