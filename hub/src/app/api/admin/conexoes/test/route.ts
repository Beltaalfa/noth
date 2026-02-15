import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { testConnection } from "@/lib/db-connections";

export async function POST(request: Request) {
  const session = await auth();
  if (!session || (session.user as { role?: string })?.role !== "admin") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body;

  if (id) {
    const conn = await prisma.dbConnection.findUnique({ where: { id } });
    if (!conn) return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
    const result = await testConnection({
      type: conn.type,
      host: conn.host,
      port: conn.port,
      user: conn.user,
      password: conn.password,
      database: conn.database,
      extraParams: conn.extraParams ?? undefined,
    });
    return NextResponse.json(result);
  }

  const { type, host, port, user, password, database } = body;
  if (!type || !host || !port || !user || !password || !database) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const result = await testConnection({ type, host, port: Number(port), user, password, database });
  return NextResponse.json(result);
}
