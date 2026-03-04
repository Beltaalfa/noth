/**
 * Seed: setores e configs de aprovação para o fluxo POP 001/25
 * (Cadastro e aprovação de desconto comercial - Análise de Crédito → Gerência → Diretor → Diretoria)
 *
 * Uso: npx tsx scripts/seed-helpdesk-aprovacao-pop.ts
 * Requer: DATABASE_URL e um cliente "Rede PMG" (ou altere CLIENTE_NOME abaixo).
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL obrigatório");
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const CLIENTE_NOME = "Rede PMG";
const TIPO_NOME = "Cadastro e aprovação de desconto comercial";
const NOMES_SETORES = ["Análise de Crédito", "Gerência Comercial", "Diretor", "Diretoria"];
const GRUPO_APROVACAO = "Aprovação Cadastro Desconto";

async function main() {
  const client = await prisma.client.findFirst({
    where: { name: { equals: CLIENTE_NOME, mode: "insensitive" }, deletedAt: null },
  });
  if (!client) {
    console.error("Cliente não encontrado:", CLIENTE_NOME);
    process.exit(1);
  }
  const clientId = client.id;
  console.log("Cliente:", client.name);

  let tipo = await prisma.helpdeskTipoSolicitacao.findFirst({
    where: { clientId, nome: { equals: TIPO_NOME, mode: "insensitive" } },
  });
  if (!tipo) {
    tipo = await prisma.helpdeskTipoSolicitacao.create({
      data: { clientId, nome: TIPO_NOME, status: "A", ordem: 0 },
    });
    console.log("Tipo de solicitação criado:", tipo.nome);
  } else {
    console.log("Tipo já existe:", tipo.nome);
  }
  const tipoSolicitacaoId = tipo.id;

  let group = await prisma.group.findFirst({
    where: { clientId, name: GRUPO_APROVACAO },
  });
  if (!group) {
    group = await prisma.group.create({ data: { clientId, name: GRUPO_APROVACAO } });
    console.log("Grupo criado:", group.name);
  }

  const sectorIds: string[] = [];
  for (const nome of NOMES_SETORES) {
    let sector = await prisma.sector.findFirst({
      where: { groupId: group.id, name: nome },
    });
    if (!sector) {
      sector = await prisma.sector.create({ data: { groupId: group.id, name: nome } });
      console.log("Setor criado:", nome);
    }
    sectorIds.push(sector.id);
  }

  const adminUser = await prisma.user.findFirst({
    where: { role: "admin", deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!adminUser) {
    console.error("Nenhum usuário admin encontrado para vincular como aprovador.");
    process.exit(1);
  }

  for (let i = 0; i < NOMES_SETORES.length; i++) {
    const sectorId = sectorIds[i];
    const nomeSetor = NOMES_SETORES[i];
    const existing = await prisma.helpdeskApprovalConfig.findFirst({
      where: { clientId, sectorId, tipoSolicitacaoId },
    });
    if (existing) {
      console.log("Config de aprovação já existe para:", nomeSetor);
      continue;
    }
    const config = await prisma.helpdeskApprovalConfig.create({
      data: {
        clientId,
        sectorId,
        tipoSolicitacaoId,
        exigeAprovacao: true,
        tipoAprovacao: "by_level",
      },
    });
    await prisma.helpdeskApprovalConfigApprover.upsert({
      where: {
        configId_userId: { configId: config.id, userId: adminUser.id },
      },
      create: { configId: config.id, userId: adminUser.id, ordem: 1 },
      update: {},
    });
    console.log("Config de aprovação criada para:", nomeSetor, "(aprovador:", adminUser.email, ")");
  }

  console.log("Seed Helpdesk aprovação POP concluído.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
