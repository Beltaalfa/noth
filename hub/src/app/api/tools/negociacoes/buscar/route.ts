import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getClientDbConnection } from "@/lib/db-connections";
import { logAudit } from "@/lib/audit";
import { Pool } from "pg";
import { getToolsForUser } from "@/lib/permissions";

type ModoBusca = "CNPJ" | "COD" | "NOME";

function detectarModoBusca(busca: string): { modo: ModoBusca; valorCnpj?: string; valorCod?: number; valorNome?: string } {
  const trim = busca.trim();
  const apenasDigitos = trim.replace(/\D/g, "");
  const soNumeros = /^\d+$/.test(trim);

  if (apenasDigitos.length === 11 || apenasDigitos.length === 14) {
    return { modo: "CNPJ", valorCnpj: apenasDigitos };
  }
  if (soNumeros && trim.length > 0) {
    const cod = parseInt(trim, 10);
    if (!Number.isNaN(cod)) return { modo: "COD", valorCod: cod };
  }
  return { modo: "NOME", valorNome: `%${trim}%` };
}

const QUERY = `
WITH NegociacoesAtivas AS (
    SELECT
        tpv.cod_pessoa,
        tpv.cod_item,
        tpv.cod_condicao_pagamento,
        tpv.cod_empresa,
        tpv.val_preco_venda_a,
        tpv.dta_inicio,
        ROW_NUMBER() OVER (
            PARTITION BY tpv.cod_pessoa, tpv.cod_item, tpv.cod_empresa, tpv.cod_condicao_pagamento
            ORDER BY tpv.dta_inicio DESC, tpv.val_preco_venda_a DESC
        ) AS rn
    FROM tab_preco_venda tpv
    WHERE tpv.cod_pessoa IS NOT NULL
      AND tpv.dta_inicio <= CURRENT_DATE
),
UltimoPrecoFixo AS (
    SELECT 
        tpv.cod_item,
        tpv.cod_empresa,
        tpv.val_preco_venda_a,
        tpv.dta_inicio,
        ROW_NUMBER() OVER (
            PARTITION BY tpv.cod_item, tpv.cod_empresa
            ORDER BY tpv.dta_inicio DESC, tpv.val_preco_venda_a DESC
        ) AS rn
    FROM tab_preco_venda tpv
    WHERE tpv.cod_pessoa IS NULL
      AND tpv.cod_condicao_pagamento IS NULL
      AND tpv.dta_inicio <= CURRENT_DATE
)
SELECT 
    f.nom_fantasia,
    na.cod_pessoa,
    b.nom_pessoa,
    b.num_cnpj_cpf,
    na.cod_item,
    c.des_item,
    na.cod_condicao_pagamento,
    d.des_forma_pagto,
    na.val_preco_venda_a AS preco_negociado,
    na.dta_inicio AS data_inicio_negociacao,
    na.cod_empresa,
    COALESCE(upf.val_preco_venda_a, 0)::numeric AS preco_fixo,
    (COALESCE(upf.val_preco_venda_a, 0) - na.val_preco_venda_a)::numeric AS desconto_reais,
    ROUND((COALESCE(upf.val_preco_venda_a, 0) - na.val_preco_venda_a) * 100)::bigint AS desconto_centavos,
    na.val_preco_venda_a::numeric AS preco_final
FROM NegociacoesAtivas na
LEFT JOIN tab_pessoa b ON b.cod_pessoa = na.cod_pessoa
LEFT JOIN tab_item c ON c.cod_item = na.cod_item
LEFT JOIN tab_forma_pagto_pdv d ON d.cod_forma_pagto = na.cod_condicao_pagamento
LEFT JOIN tab_empresa f ON f.cod_empresa = na.cod_empresa
LEFT JOIN UltimoPrecoFixo upf
       ON upf.cod_item = na.cod_item
      AND upf.cod_empresa = na.cod_empresa
      AND upf.rn = 1
WHERE na.rn = 1
  AND na.cod_empresa = $1
  AND (
        ($2 = 'CNPJ'   AND b.num_cnpj_cpf = $3)
     OR ($2 = 'COD'    AND na.cod_pessoa = $4)
     OR ($2 = 'NOME'   AND b.nom_pessoa ILIKE $5)
  )
ORDER BY c.des_item, na.cod_condicao_pagamento, na.dta_inicio DESC
`;

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });
  }

  let body: { clienteId?: string; codEmpresa?: number; busca?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { clienteId, codEmpresa, busca } = body;
  if (!clienteId) {
    return NextResponse.json({ error: "clienteId obrigatório" }, { status: 400 });
  }
  if (codEmpresa == null) {
    return NextResponse.json({ error: "codEmpresa obrigatório" }, { status: 400 });
  }
  if (!busca || String(busca).trim() === "") {
    return NextResponse.json({ error: "busca obrigatória" }, { status: 400 });
  }

  const role = (session.user as { role?: string })?.role;
  if (role !== "admin") {
    const tools = await getToolsForUser(userId);
    const canAccess = tools.some((t) => t.slug === "negociacoes" && t.clientId === clienteId);
    if (!canAccess) {
      return NextResponse.json({ error: "Sem permissão para este cliente" }, { status: 403 });
    }
  }

  const { modo, valorCnpj, valorCod, valorNome } = detectarModoBusca(String(busca).trim());
  const codEmp = Number(codEmpresa);

  const params = [
    codEmp,
    modo,
    valorCnpj ?? "",
    valorCod ?? 0,
    valorNome ?? "%%",
  ];

  try {
    const creds = await getClientDbConnection(clienteId, "negociacoes");
    const pool = new Pool({
      ...creds,
      connectionTimeoutMillis: 15000,
    });
    const client = await pool.connect();
    const result = await client.query(QUERY, params);
    client.release();
    await pool.end();

    const rows = result.rows.map((r) => ({
      nom_fantasia: String(r.nom_fantasia ?? ""),
      cod_pessoa: Number(r.cod_pessoa),
      nom_pessoa: String(r.nom_pessoa ?? ""),
      num_cnpj_cpf: String(r.num_cnpj_cpf ?? ""),
      cod_item: Number(r.cod_item),
      des_item: String(r.des_item ?? ""),
      cod_condicao_pagamento: r.cod_condicao_pagamento,
      des_forma_pagto: String(r.des_forma_pagto ?? ""),
      preco_fixo: Number(r.preco_fixo ?? 0),
      preco_negociado: Number(r.preco_negociado ?? 0),
      desconto_reais: Number(r.desconto_reais ?? 0),
      desconto_centavos: Number(r.desconto_centavos ?? 0),
      preco_final: Number(r.preco_final ?? 0),
      data_inicio_negociacao: r.data_inicio_negociacao ? new Date(r.data_inicio_negociacao).toISOString().slice(0, 10) : null,
    }));

    await logAudit({
      userId,
      action: "negociacoes_busca",
      entity: "Negociacoes",
      entityId: clienteId,
      details: JSON.stringify({ clienteId, codEmpresa: codEmp, modoBusca: modo, qtdLinhas: rows.length }),
    });

    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao buscar negociações";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
