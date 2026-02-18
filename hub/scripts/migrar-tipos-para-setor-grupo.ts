/**
 * Preenche groupId (Setor) e sectorId (Grupo) nos tipos de solicitação existentes,
 * a partir do parentId (Pai) atual. Execute após aplicar a migration que adiciona groupId/sectorId.
 *
 * Uso: npx tsx scripts/migrar-tipos-para-setor-grupo.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL nao definido");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/** Nome do tipo (ou pai) -> nome do Setor (Group) */
const NOME_PARA_SETOR: Record<string, string> = {
  COMPRAS: "Compras",
  CONTROLADORIA: "Controladoria",
  DIRETORIA: "Diretoria",
  FINANCEIRO: "Financeiro",
  FISCAL: "Fiscal",
  GERENTE: "Gerentes",
  "GERENTE FINANCEIRO": "Gerentes",
  "GERENTE FISCAL": "Gerentes",
  "GERENTE RH": "RH",
  "POSTO MACEDO 262": "Operacoes",
  "RESTAURANTE 262": "Operacoes",
  "RH PMG": "RH",
  RH: "RH",
  TI: "TI",
};

/** Sufixo do nome do tipo -> nome do Grupo (Sector). Usado quando o tipo tem pai. */
const NOME_TIPO_PARA_GRUPO: Record<string, string> = {
  "FINANCEIRO FATURAMENTO": "Faturamento",
  "FINANCEIRO CONFERÊNCIA CAIXA": "Conferencia Caixa",
  "FINANCEIRO CONTAS A PAGAR": "Contas a Pagar",
  "FINANCEIRO CONTAS A RECEBER / CADASTRO": "Contas a Receber",
  "FINANCEIRO TESOURARIA / CONCILIAÇÃO": "Tesouraria",
  "GERENTE FINANCEIRO": "Gerente Financeiro",
  "FISCAL REGISTROS / GUIA / TAXAS": "Registros Guia Taxas",
  "FISCAL ALTERAÇÃO DE CADASTRO": "Alteracao Cadastro",
  "FISCAL / CADASTRO ITEM": "Cadastro Item",
  "FISCAL TRIBUTAÇÃO": "Tributacao",
  "FISCAL REGISTROS / COMBUSTÍVEL / CTE": "Combustivel CTE",
  "FISCAL REGISTROS / DESPESAS": "Despesas",
  "FISCAL REGISTROS / ESTOQUE": "Estoque",
  "FISCAL REGISTROS / NFE": "NFE",
  "FISCAL REGISTROS / NFE USO E CONSUMO / PRESTAÇÃO DE SERVIÇOS": "NFE Uso Consumo",
  "GERENTE FISCAL": "Gerente Fiscal",
  "GERENTE RH": "Gerente RH",
  "POSTO MACEDO 262": "Posto Macedo 262",
  "RESTAURANTE 262": "Restaurante 262",
  "RH PMG": "RH PMG",
  TI: "TI",
  COMPRAS: "Compras",
  CONTROLADORIA: "Controladoria",
  DIRETORIA: "Diretoria",
};

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\u0300-\u036f/g, "")
    .toUpperCase()
    .trim();
}

async function main() {
  const tipos = await prisma.helpdeskTipoSolicitacao.findMany({
    where: {},
    include: { parent: { select: { nome: true } } },
  });

  const clients = await prisma.client.findMany({ where: { deletedAt: null }, select: { id: true } });
  const groupMap = new Map<string, string>(); // key: clientId:groupName -> groupId
  const sectorMap = new Map<string, string>(); // key: groupId:sectorName -> sectorId

  for (const c of clients) {
    const groups = await prisma.group.findMany({
      where: { clientId: c.id },
      select: { id: true, name: true },
    });
    for (const g of groups) {
      const key = `${c.id}:${normalizar(g.name)}`;
      groupMap.set(key, g.id);
      const sectors = await prisma.sector.findMany({
        where: { groupId: g.id },
        select: { id: true, name: true },
      });
      for (const s of sectors) {
        sectorMap.set(`${g.id}:${normalizar(s.name)}`, s.id);
      }
    }
  }

  let updated = 0;
  for (const t of tipos) {
    const parentNome = t.parent?.nome ?? null;
    const setorNome =
      parentNome ? NOME_PARA_SETOR[parentNome] ?? NOME_PARA_SETOR[parentNome.split(" ")[0]] : NOME_PARA_SETOR[t.nome] ?? NOME_PARA_SETOR[t.nome.split(" ")[0]];
    if (!setorNome) continue;

    const groupKey = `${t.clientId}:${normalizar(setorNome)}`;
    const groupId = groupMap.get(groupKey);
    if (!groupId) continue;

    let sectorId: string | null = null;
    const grupoNome = NOME_TIPO_PARA_GRUPO[t.nome] ?? (parentNome ? t.nome.replace(new RegExp(`^${parentNome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`), "").trim() : null);
    if (grupoNome) {
      const sectorKey = `${groupId}:${normalizar(grupoNome)}`;
      sectorId = sectorMap.get(sectorKey) ?? null;
      if (!sectorId) {
        const sectors = await prisma.sector.findMany({ where: { groupId }, select: { id: true, name: true } });
        const match = sectors.find((s) => normalizar(s.name) === normalizar(grupoNome));
        if (match) sectorId = match.id;
      }
    }

    await prisma.helpdeskTipoSolicitacao.update({
      where: { id: t.id },
      data: { groupId, sectorId },
    });
    updated++;
    console.log("OK", t.nome, "->", setorNome, grupoNome ?? "-");
  }

  console.log("Atualizados", updated, "tipos.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
