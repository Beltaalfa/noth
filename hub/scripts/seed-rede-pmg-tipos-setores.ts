import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL nao definido");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const CLIENTE_NOME = "Rede PMG";

// Mesma lista de hub/src/lib/helpdesk-seed-tipos.ts (tipos por cliente no banco central)
const LISTA_TIPOS = [
  "COMPRAS", "CONTROLADORIA", "DIRETORIA",
  "FINANCEIRO FATURAMENTO", "FINANCEIRO CONFERÊNCIA CAIXA", "FINANCEIRO CONTAS A PAGAR",
  "FINANCEIRO CONTAS A RECEBER / CADASTRO", "FINANCEIRO TESOURARIA / CONCILIAÇÃO",
  "FISCAL REGISTROS / GUIA / TAXAS", "FISCAL ALTERAÇÃO DE CADASTRO", "FISCAL / CADASTRO ITEM",
  "FISCAL TRIBUTAÇÃO", "FISCAL REGISTROS / COMBUSTÍVEL / CTE", "FISCAL REGISTROS / DESPESAS",
  "FISCAL REGISTROS / ESTOQUE", "FISCAL REGISTROS / NFE", "FISCAL REGISTROS / NFE USO E CONSUMO / PRESTAÇÃO DE SERVIÇOS",
  "GERENTE FINANCEIRO", "GERENTE FISCAL", "GERENTE RH",
  "POSTO MACEDO 262", "RESTAURANTE 262", "RH PMG", "TI",
];

async function main() {
  const cliente = await prisma.client.findFirst({
    where: { name: { equals: CLIENTE_NOME, mode: "insensitive" }, deletedAt: null },
  });
  if (!cliente) {
    console.error("Cliente Rede PMG nao encontrado.");
    process.exit(1);
  }
  const clientId = cliente.id;
  console.log("Cliente:", CLIENTE_NOME);

  const existentesTipos = await prisma.helpdeskTipoSolicitacao.count({ where: { clientId } });
  if (existentesTipos === 0) {
    const roots: Record<string, string> = {};
    let ordem = 0;
    for (const nome of LISTA_TIPOS) {
      const upper = nome.toUpperCase();
      let parentId: string | null = null;
      if (upper.startsWith("FINANCEIRO")) {
        if (!roots["FINANCEIRO"]) {
          const r = await prisma.helpdeskTipoSolicitacao.create({
            data: { clientId, nome: "FINANCEIRO", status: "A", ordem: ordem++ },
          });
          roots["FINANCEIRO"] = r.id;
        }
        parentId = roots["FINANCEIRO"];
      } else if (upper.startsWith("FISCAL")) {
        if (!roots["FISCAL"]) {
          const r = await prisma.helpdeskTipoSolicitacao.create({
            data: { clientId, nome: "FISCAL", status: "A", ordem: ordem++ },
          });
          roots["FISCAL"] = r.id;
        }
        parentId = roots["FISCAL"];
      } else if (upper.startsWith("RH") || upper === "GERENTE RH") {
        if (!roots["RH"]) {
          const r = await prisma.helpdeskTipoSolicitacao.create({
            data: { clientId, nome: "RH", status: "A", ordem: ordem++ },
          });
          roots["RH"] = r.id;
        }
        parentId = roots["RH"];
      }
      await prisma.helpdeskTipoSolicitacao.create({
        data: { clientId, nome, parentId, status: "A", ordem: ordem++ },
      });
    }
    console.log("Tipos de solicitacao criados.");
  } else {
    console.log("Tipos ja existem; pulando.");
  }

  const nomesSetores = new Set<string>();
  for (const nome of LISTA_TIPOS) {
    const upper = nome.toUpperCase();
    if (upper.startsWith("FINANCEIRO")) nomesSetores.add("Financeiro");
    else if (upper.startsWith("FISCAL")) nomesSetores.add("Fiscal");
    else if (upper.startsWith("RH") || upper === "GERENTE RH") nomesSetores.add("RH");
    else if (upper.startsWith("GERENTE")) nomesSetores.add("Gerentes");
    else if (upper.startsWith("POSTO") || upper.startsWith("RESTAURANTE")) nomesSetores.add("Operacoes");
    else if (upper === "TI") nomesSetores.add("TI");
    else if (upper === "COMPRAS") nomesSetores.add("Compras");
    else if (upper === "CONTROLADORIA") nomesSetores.add("Controladoria");
    else if (upper === "DIRETORIA") nomesSetores.add("Diretoria");
  }

  const gruposPorSetor: Record<string, string[]> = {
    Financeiro: ["Faturamento", "Conferencia Caixa", "Contas a Pagar", "Contas a Receber", "Tesouraria", "Gerente Financeiro"],
    Fiscal: ["Registros Guia Taxas", "Alteracao Cadastro", "Cadastro Item", "Tributacao", "Combustivel CTE", "Despesas", "Estoque", "NFE", "NFE Uso Consumo", "Gerente Fiscal"],
    RH: ["RH PMG", "Gerente RH"],
    TI: ["TI"],
    Compras: ["Compras"],
    Controladoria: ["Controladoria"],
    Diretoria: ["Diretoria"],
    Operacoes: ["Posto Macedo 262", "Restaurante 262"],
    Gerentes: ["Gerente Financeiro", "Gerente Fiscal", "Gerente RH"],
  };

  for (const nomeSetor of nomesSetores) {
    let group = await prisma.group.findFirst({ where: { clientId, name: nomeSetor } });
    if (!group) {
      group = await prisma.group.create({ data: { clientId, name: nomeSetor } });
      console.log("Setor criado:", nomeSetor);
    }
    const nomesGrupos = gruposPorSetor[nomeSetor] ?? [nomeSetor];
    for (const nomeGrupo of nomesGrupos) {
      const exists = await prisma.sector.findFirst({ where: { groupId: group.id, name: nomeGrupo } });
      if (!exists) {
        await prisma.sector.create({ data: { groupId: group.id, name: nomeGrupo } });
        console.log("  Grupo:", nomeSetor, "->", nomeGrupo);
      }
    }
  }
  console.log("Concluido.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
