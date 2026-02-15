import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getClientDbConnection } from "@/lib/db-connections";
import { Pool } from "pg";
import { getToolsForUser } from "@/lib/permissions";

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
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId obrigatório" }, { status: 400 });
  }

  const role = (session.user as { role?: string })?.role;
  if (role !== "admin") {
    const tools = await getToolsForUser(userId);
    const canAccess = tools.some((t) => t.slug === "negociacoes" && t.clientId === clienteId);
    if (!canAccess) {
      return NextResponse.json({ error: "Sem permissão para este cliente" }, { status: 403 });
    }
  }

  try {
    const creds = await getClientDbConnection(clienteId, "negociacoes");
    const pool = new Pool({
      ...creds,
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect();
    const result = await client.query(
      `SELECT a.cod_empresa, a.nom_fantasia
       FROM tab_empresa a
       ORDER BY a.nom_fantasia`
    );
    client.release();
    await pool.end();

    return NextResponse.json(
      result.rows.map((r) => ({
        cod_empresa: Number(r.cod_empresa),
        nom_fantasia: String(r.nom_fantasia ?? ""),
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar empresas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
