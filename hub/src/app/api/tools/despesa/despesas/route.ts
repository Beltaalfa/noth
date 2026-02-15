import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { canUserAccessAlteracaoDespesaPmg } from "@/lib/permissions";
import { getPmgDbConnection } from "@/lib/db-connections";
import { Pool } from "pg";

// Placeholder - substituir pelo SELECT definitivo de despesas ativas
const DESPESAS_QUERY = `
SELECT 1::int as seq_despesa, ''::text as codigo, ''::text as descricao WHERE false
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
  const q = searchParams.get("q") ?? "";

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
    const result = await client.query(DESPESAS_QUERY);
    client.release();
    await pool.end();

    const rows = result.rows.map((r) => ({
      seq_despesa: Number(r.seq_despesa),
      codigo: String(r.codigo ?? ""),
      descricao: String(r.descricao ?? ""),
      label: `${r.codigo ?? ""} - ${r.descricao ?? ""}`.trim() || "-",
    }));

    const filtered =
      q.trim() === ""
        ? rows
        : rows.filter(
            (r) =>
              String(r.codigo).toLowerCase().includes(q.toLowerCase()) ||
              String(r.descricao).toLowerCase().includes(q.toLowerCase())
          );

    return NextResponse.json(filtered);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar despesas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
