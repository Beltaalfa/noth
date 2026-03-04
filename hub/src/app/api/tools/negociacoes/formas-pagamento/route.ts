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
  const clientId = searchParams.get("clientId") ?? searchParams.get("clienteId");
  if (!clientId) {
    return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
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
    const result = await client.query(
      `SELECT cod_forma_pagto, des_forma_pagto
       FROM tab_forma_pagto_pdv
       ORDER BY des_forma_pagto`
    );
    client.release();
    await pool.end();

    return NextResponse.json(
      result.rows.map((r) => ({
        cod_forma_pagto: Number(r.cod_forma_pagto),
        des_forma_pagto: String(r.des_forma_pagto ?? ""),
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar formas de pagamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
