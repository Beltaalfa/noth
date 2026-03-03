import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getClientDbConnection } from "@/lib/db-connections";
import { Pool } from "pg";
import { getClientIdsForNegociacoes } from "@/lib/permissions";

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
  const clienteId = searchParams.get("clienteId");
  const codEmpresa = searchParams.get("codEmpresa");
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId obrigatório" }, { status: 400 });
  }
  const codEmp = codEmpresa ? parseInt(codEmpresa, 10) : null;
  if (codEmp == null || Number.isNaN(codEmp)) {
    return NextResponse.json({ error: "codEmpresa obrigatório" }, { status: 400 });
  }

  const isAdmin = (session.user as { role?: string })?.role === "admin";
  const allowedClientIds = await getClientIdsForNegociacoes(userId, isAdmin);
  if (!allowedClientIds.includes(clienteId)) {
    return NextResponse.json({ error: "Sem permissão para este cliente" }, { status: 403 });
  }

  try {
    const creds = await getClientDbConnection(clienteId, "negociacoes");
    const pool = new Pool({
      ...creds,
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect();
    const result = await client.query(
      `SELECT DISTINCT c.cod_item, c.des_item
       FROM tab_preco_venda tpv
       JOIN tab_item c ON c.cod_item = tpv.cod_item
       WHERE tpv.cod_empresa = $1
         AND c.cod_subgrupo_item = 1
       ORDER BY c.des_item`,
      [codEmp]
    );
    client.release();
    await pool.end();

    return NextResponse.json(
      result.rows.map((r) => ({
        cod_item: Number(r.cod_item),
        des_item: String(r.des_item ?? ""),
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar produtos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
