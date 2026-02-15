import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUserAccessTool } from "@/lib/permissions";
import { Pool } from "pg";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  const body = await request.json();
  const { toolId, params = {} } = body;

  if (!toolId) {
    return NextResponse.json({ error: "toolId obrigatório" }, { status: 400 });
  }

  const canAccess = await canUserAccessTool(userId, toolId);
  if (!canAccess) {
    return NextResponse.json({ error: "Sem permissão para esta ferramenta" }, { status: 403 });
  }

  const tool = await prisma.tool.findUnique({
    where: { id: toolId },
    include: { dbConnection: true },
  });

  if (!tool) {
    return NextResponse.json({ error: "Ferramenta não encontrada" }, { status: 404 });
  }

  if (tool.type !== "query_runner" || !tool.dbConnectionId || !tool.dbConnection) {
    return NextResponse.json({ error: "Ferramenta não configurada para execução de queries" }, { status: 400 });
  }

  const conn = tool.dbConnection;
  if (conn.type !== "postgres") {
    return NextResponse.json({ error: "Apenas PostgreSQL é suportado no momento" }, { status: 400 });
  }

  let query = "SELECT 1";
  if (tool.scriptConfig) {
    try {
      const config = JSON.parse(tool.scriptConfig) as { query?: string };
      if (config.query) query = config.query;
    } catch {
      // usa query padrão
    }
  }

  if (params.query && typeof params.query === "string") {
    if (!params.query.trim().toUpperCase().startsWith("SELECT")) {
      return NextResponse.json({ error: "Apenas queries SELECT são permitidas" }, { status: 400 });
    }
    query = params.query;
  }

  try {
    const pool = new Pool({
      host: conn.host,
      port: conn.port,
      user: conn.user,
      password: conn.password,
      database: conn.database,
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect();
    const result = await client.query(query);
    client.release();
    await pool.end();

    return NextResponse.json({
      ok: true,
      rows: result.rows,
      rowCount: result.rowCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao executar query";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
