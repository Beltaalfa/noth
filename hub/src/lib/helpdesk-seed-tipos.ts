import { Pool } from "pg";
import { randomBytes } from "crypto";

const LISTA_INICIAL = [
  "COMPRAS",
  "CONTROLADORIA",
  "DIRETORIA",
  "FINANCEIRO FATURAMENTO",
  "FINANCEIRO CONFERÊNCIA CAIXA",
  "FINANCEIRO CONTAS A PAGAR",
  "FINANCEIRO CONTAS A RECEBER / CADASTRO",
  "FINANCEIRO TESOURARIA / CONCILIAÇÃO",
  "FISCAL REGISTROS / GUIA / TAXAS",
  "FISCAL ALTERAÇÃO DE CADASTRO",
  "FISCAL / CADASTRO ITEM",
  "FISCAL TRIBUTAÇÃO",
  "FISCAL REGISTROS / COMBUSTÍVEL / CTE",
  "FISCAL REGISTROS / DESPESAS",
  "FISCAL REGISTROS / ESTOQUE",
  "FISCAL REGISTROS / NFE",
  "FISCAL REGISTROS / NFE USO E CONSUMO / PRESTAÇÃO DE SERVIÇOS",
  "GERENTE FINANCEIRO",
  "GERENTE FISCAL",
  "GERENTE RH",
  "POSTO MACEDO 262",
  "RESTAURANTE 262",
  "RH PMG",
  "TI",
];

function cuidLike(): string {
  const t = Date.now().toString(36);
  const r = randomBytes(6).toString("hex");
  return `c${t}${r}`.slice(0, 25);
}

/** Seed hd_tipo_solicitacao with initial list and hierarchy. Idempotent: skips if any row exists. */
export async function seedHelpdeskTiposSolicitacao(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    const { rows: existing } = await client.query("SELECT 1 FROM hd_tipo_solicitacao LIMIT 1");
    if (existing.length > 0) return;

    const ids = new Map<string, string>();
    function idFor(name: string): string {
      let id = ids.get(name);
      if (!id) {
        id = cuidLike();
        ids.set(name, id);
      }
      return id;
    }

    const roots: Record<string, string> = {};
    for (const nome of LISTA_INICIAL) {
      let parentId: string | null = null;
      const upper = nome.toUpperCase();
      if (upper.startsWith("FINANCEIRO")) {
        const rootName = "FINANCEIRO";
        if (!roots[rootName]) {
          roots[rootName] = idFor(rootName);
          await client.query(
            `INSERT INTO hd_tipo_solicitacao (id, nome, parent_id, status, ordem, created_at, updated_at)
             VALUES ($1, $2, NULL, 'A', 0, now(), now())`,
            [roots[rootName], rootName]
          );
        }
        parentId = roots[rootName];
      } else if (upper.startsWith("FISCAL")) {
        const rootName = "FISCAL";
        if (!roots[rootName]) {
          roots[rootName] = idFor(rootName);
          await client.query(
            `INSERT INTO hd_tipo_solicitacao (id, nome, parent_id, status, ordem, created_at, updated_at)
             VALUES ($1, $2, NULL, 'A', 0, now(), now())`,
            [roots[rootName], rootName]
          );
        }
        parentId = roots[rootName];
      } else if (upper.startsWith("RH")) {
        const rootName = "RH";
        if (!roots[rootName]) {
          roots[rootName] = idFor(rootName);
          await client.query(
            `INSERT INTO hd_tipo_solicitacao (id, nome, parent_id, status, ordem, created_at, updated_at)
             VALUES ($1, $2, NULL, 'A', 0, now(), now())`,
            [roots[rootName], rootName]
          );
        }
        parentId = roots[rootName];
      }

      const id = idFor(nome);
      await client.query(
        `INSERT INTO hd_tipo_solicitacao (id, nome, parent_id, status, ordem, created_at, updated_at)
         VALUES ($1, $2, $3, 'A', 0, now(), now())`,
        [id, nome, parentId]
      );
    }
  } finally {
    client.release();
  }
}
