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

  const sql = [
    "WITH tipo_forma_pagto (ind_tipo, des_tipo_forma_pagto) AS (",
    "  SELECT * FROM (VALUES",
    "    ('DI','Dinheiro'),('NP','Nota a Prazo'),('CN','Cheque à vista'),('CP','Cheque a prazo'),",
    "    ('CC','Cartão de Crédito'),('CF','Carta Frete'),('DC','Depósito Bancário'),('CT','CTF'),",
    "    ('PL','Private Label'),('VO','Voucher/Cartão Frota'),('AC','Adiantamento Cliente')",
    "  ) AS t(ind_tipo, des_tipo_forma_pagto)",
    ")",
    "SELECT f.cod_forma_pagto, f.ind_tipo,",
    "  COALESCE(t.des_tipo_forma_pagto, f.ind_tipo) AS nome_tipo_forma_pagamento,",
    "  f.des_forma_pagto AS nome_forma_pagamento",
    "FROM tab_forma_pagto_pdv f",
    "LEFT JOIN tipo_forma_pagto t ON t.ind_tipo = f.ind_tipo",
    "ORDER BY f.ind_tipo, f.cod_forma_pagto",
  ].join(" ");

  try {
    const creds = await getClientDbConnection(clientId, "negociacoes");
    const pool = new Pool({
      ...creds,
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect();
    const result = await client.query(sql);
    client.release();
    await pool.end();

    return NextResponse.json(
      result.rows.map((r: Record<string, unknown>) => ({
        cod_forma_pagto: Number(r.cod_forma_pagto),
        ind_tipo: String(r.ind_tipo ?? ""),
        nome_tipo_forma_pagamento: String(r.nome_tipo_forma_pagamento ?? r.ind_tipo ?? ""),
        nome_forma_pagamento: String(r.nome_forma_pagamento ?? ""),
      }))
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao listar formas de pagamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
