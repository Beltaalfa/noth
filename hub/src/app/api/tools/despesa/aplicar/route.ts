import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { canUserAccessAlteracaoDespesaPmg } from "@/lib/permissions";
import { getPmgDbConnection } from "@/lib/db-connections";
import { logAudit } from "@/lib/audit";
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

  let body: {
    seqDespesas?: number[];
    codCentroCusto?: number;
    codTipoDespesa?: number;
    observacao?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { seqDespesas = [], codCentroCusto, codTipoDespesa, observacao } = body;
  if (!Array.isArray(seqDespesas) || seqDespesas.length === 0) {
    return NextResponse.json({ error: "seqDespesas não pode ser vazio" }, { status: 400 });
  }
  const hasCentro = codCentroCusto != null && String(codCentroCusto).trim() !== "";
  const hasTipo = codTipoDespesa != null && String(codTipoDespesa).trim() !== "";
  const hasObs = typeof observacao === "string" && observacao.trim() !== "";
  if (!hasCentro && !hasTipo && !hasObs) {
    return NextResponse.json({ error: "Preencha ao menos um campo (centro de custo, tipo ou observação)" }, { status: 400 });
  }

  const canAccess = await canUserAccessAlteracaoDespesaPmg(userId);
  if (!canAccess) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const creds = await getPmgDbConnection();
    const pool = new Pool({ ...creds, connectionTimeoutMillis: 10000 });
    const client = await pool.connect();

    const inPlaceholders = (offset: number) => seqDespesas.map((_, i) => `$${offset + i}`).join(", ");
    const afetados: { rateio?: number; tipo?: number; observacao?: number; total: number } = { total: 0 };

    try {
      if (hasCentro || hasTipo || hasObs) {
        await client.query("BEGIN");

        if (hasTipo || hasObs) {
          if (hasTipo && hasObs) {
            const params = [codTipoDespesa, observacao?.trim() ?? "", ...seqDespesas];
            const q = `UPDATE tab_outras_despesas a SET cod_tipo_despesa = $1, des_observacao = $2 WHERE a.seq_despesa IN (${inPlaceholders(3)})`;
            const r = await client.query(q, params);
            afetados.tipo = r.rowCount ?? 0;
          } else if (hasTipo) {
            const params = [codTipoDespesa, ...seqDespesas];
            const q = `UPDATE tab_outras_despesas a SET cod_tipo_despesa = $1 WHERE a.seq_despesa IN (${inPlaceholders(2)})`;
            const r = await client.query(q, params);
            afetados.tipo = r.rowCount ?? 0;
          } else {
            const params = [observacao?.trim() ?? "", ...seqDespesas];
            const q = `UPDATE tab_outras_despesas a SET des_observacao = $1 WHERE a.seq_despesa IN (${inPlaceholders(2)})`;
            const r = await client.query(q, params);
            afetados.observacao = r.rowCount ?? 0;
          }
        }

        if (hasCentro) {
          const params = [codCentroCusto, ...seqDespesas];
          const q = `UPDATE tab_rateio_despesa A SET cod_centro_custo = $1 WHERE A.seq_despesa IN (${inPlaceholders(2)})`;
          const r = await client.query(q, params);
          afetados.rateio = r.rowCount ?? 0;
        }

        await client.query("COMMIT");
      }
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }

    afetados.total = seqDespesas.length;

    client.release();
    await pool.end();

    const camposAlterados: string[] = [];
    if (hasCentro) camposAlterados.push("centro_custo");
    if (hasTipo) camposAlterados.push("tipo_despesa");
    if (hasObs) camposAlterados.push("observacao");

    await logAudit({
      userId,
      action: "despesa_alteracao",
      entity: "AlteracaoDespesa",
      entityId: null,
      details: JSON.stringify({ cliente: "PMG", qtdDespesas: seqDespesas.length, camposAlterados }),
    });

    return NextResponse.json({ ok: true, afetados });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao aplicar alterações";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
