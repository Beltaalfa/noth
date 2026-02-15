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
      `SELECT b.cod_tipo_despesa, b.des_tipo_despesa
  FROM tab_tipo_despesa b
 WHERE b.ind_status = 'A'
 ORDER BY b.des_tipo_despesa`
    );
    client.release();
    await pool.end();

    return NextResponse.json(
      result.rows.map((r) => ({
        cod_tipo_despesa: r.cod_tipo_despesa,
        des_tipo_despesa: r.des_tipo_despesa,
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar tipos de despesa";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
