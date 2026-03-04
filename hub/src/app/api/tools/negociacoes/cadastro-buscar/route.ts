import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getClientDbConnection } from "@/lib/db-connections";
import { Pool } from "pg";
import { getClientIdsForNegociacoes } from "@/lib/permissions";

/** Detecta se a busca é por código (só números) ou CNPJ/CPF (11 ou 14 dígitos). */
function detectarModoBusca(busca: string): { modo: "COD" | "CNPJ"; valorCod?: number; valorCnpj?: string } {
  const trim = busca.trim();
  const apenasDigitos = trim.replace(/\D/g, "");

  if (apenasDigitos.length === 11 || apenasDigitos.length === 14) {
    return { modo: "CNPJ", valorCnpj: apenasDigitos };
  }
  if (/^\d+$/.test(trim) && trim.length > 0) {
    const cod = parseInt(trim, 10);
    if (!Number.isNaN(cod)) return { modo: "COD", valorCod: cod };
  }
  return { modo: "CNPJ", valorCnpj: apenasDigitos || undefined };
}

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
  const busca = searchParams.get("busca")?.trim();

  if (!clientId) {
    return NextResponse.json({ error: "clientId obrigatório" }, { status: 400 });
  }
  if (!busca || busca === "") {
    return NextResponse.json({ error: "busca obrigatória (código ou CNPJ/CPF)" }, { status: 400 });
  }

  const isAdmin = (session.user as { role?: string })?.role === "admin";
  const allowedClientIds = await getClientIdsForNegociacoes(userId, isAdmin);
  if (!allowedClientIds.includes(clientId)) {
    return NextResponse.json({ error: "Sem permissão para este cliente" }, { status: 403 });
  }

  const { modo, valorCod, valorCnpj } = detectarModoBusca(busca);
  if (modo === "COD" && valorCod == null) {
    return NextResponse.json({ error: "Digite um código numérico ou CNPJ/CPF (11 ou 14 dígitos)" }, { status: 400 });
  }
  if (modo === "CNPJ" && (!valorCnpj || (valorCnpj.length !== 11 && valorCnpj.length !== 14))) {
    return NextResponse.json({ error: "CPF deve ter 11 dígitos ou CNPJ 14 dígitos" }, { status: 400 });
  }

  try {
    const creds = await getClientDbConnection(clientId, "negociacoes");
    const pool = new Pool({
      ...creds,
      connectionTimeoutMillis: 10000,
    });
    const client = await pool.connect();

    let result;
    if (modo === "COD") {
      result = await client.query(
        `SELECT cod_pessoa, nom_pessoa, num_cnpj_cpf
         FROM tab_pessoa
         WHERE cod_pessoa = $1
         LIMIT 5`,
        [valorCod]
      );
    } else {
      result = await client.query(
        `SELECT cod_pessoa, nom_pessoa, num_cnpj_cpf
         FROM tab_pessoa
         WHERE REGEXP_REPLACE(COALESCE(num_cnpj_cpf, ''), '\\D', '', 'g') = $1
         LIMIT 5`,
        [valorCnpj]
      );
    }

    client.release();
    await pool.end();

    const rows = (result.rows ?? []).map((r: { cod_pessoa: unknown; nom_pessoa: unknown; num_cnpj_cpf: unknown }) => ({
      cod_pessoa: Number(r.cod_pessoa),
      nom_pessoa: String(r.nom_pessoa ?? ""),
      num_cnpj_cpf: String(r.num_cnpj_cpf ?? ""),
    }));

    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar cadastro";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
