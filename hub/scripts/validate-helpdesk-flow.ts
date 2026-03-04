/**
 * Valida o fluxo POP 001/25: cria um ticket de teste e aplica duas aprovações
 * (Crédito → Gerência → concluído para valor 0,10). Escreve resultado em NDJSON
 * para análise (session 42c547).
 *
 * Uso: npx tsx scripts/validate-helpdesk-flow.ts
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
const LIMIAR_CREDITO = 0.05;
const LIMIAR_GERENCIA = 0.1;

function findSectorByName(prisma: PrismaClient, clientId: string, name: string) {
  return prisma.sector.findFirst({
    where: { name, group: { clientId } },
    select: { id: true, name: true },
  });
}

function logEvidence(obj: Record<string, unknown>) {
  console.log(JSON.stringify({ ...obj, timestamp: Date.now() }));
}

async function main() {
  const client = await prisma.client.findFirst({
    where: { name: { equals: CLIENTE_NOME, mode: "insensitive" }, deletedAt: null },
  });
  if (!client) {
    console.error("Cliente não encontrado:", CLIENTE_NOME);
    process.exit(1);
  }
  const clientId = client.id;

  const tipo = await prisma.helpdeskTipoSolicitacao.findFirst({
    where: { clientId, nome: { equals: TIPO_NOME, mode: "insensitive" } },
  });
  if (!tipo) {
    console.error("Tipo não encontrado:", TIPO_NOME);
    process.exit(1);
  }

  const setorCredito = await findSectorByName(prisma, clientId, NOMES_SETORES[0]);
  if (!setorCredito) {
    console.error("Setor não encontrado:", NOMES_SETORES[0]);
    process.exit(1);
  }

  const adminUser = await prisma.user.findFirst({
    where: { role: "admin", deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!adminUser) {
    console.error("Nenhum usuário admin encontrado.");
    process.exit(1);
  }

  const approvalConfig = await prisma.helpdeskApprovalConfig.findFirst({
    where: { clientId, sectorId: setorCredito.id, tipoSolicitacaoId: tipo.id },
  });
  if (!approvalConfig) {
    console.error("Config de aprovação não encontrada para setor Crédito.");
    process.exit(1);
  }

  const maxNum = await prisma.helpdeskTicket.aggregate({
    where: { clientId },
    _max: { numero: true },
  });
  const numero = (maxNum._max.numero ?? 0) + 1;

  const formData = {
    formaPagamentoNome: "PIX",
    volumeEstimadoLitros: 600,
    classeABC: "A",
  };
  const valorDesconto = 0.1;

  const ticket = await prisma.helpdeskTicket.create({
    data: {
      clientId,
      numero,
      subject: "[VALIDAÇÃO] Teste fluxo POP",
      tipoSolicitacaoId: tipo.id,
      status: "pending_approval",
      workflowStep: "credito",
      assigneeType: "sector",
      assigneeSectorId: setorCredito.id,
      createdById: adminUser.id,
      formData: formData as object,
      custoOrcamento: valorDesconto,
      messages: {
        create: { userId: adminUser.id, content: "Mensagem inicial" },
      },
    },
    select: { id: true, status: true, workflowStep: true, assigneeSectorId: true },
  });

  logEvidence({
    hypothesisId: "H1_H5",
    step: "ticket_created",
    ticketId: ticket.id,
    status: ticket.status,
    workflowStep: ticket.workflowStep,
    assigneeSectorId: ticket.assigneeSectorId,
    expected: "pending_approval + credito + setor Crédito",
  });

  const setorGerencia = await findSectorByName(prisma, clientId, NOMES_SETORES[1]);
  logEvidence({
    hypothesisId: "H3",
    step: "find_gerencia",
    sectorName: NOMES_SETORES[1],
    setorFound: !!setorGerencia,
    clientId,
  });

  if (!setorGerencia) {
    console.error("Setor Gerência não encontrado. Fluxo quebrado.");
    process.exit(1);
  }

  await prisma.helpdeskApprovalLog.create({
    data: { ticketId: ticket.id, userId: adminUser.id, action: "approved", comment: null },
  });

  await prisma.helpdeskTicket.update({
    where: { id: ticket.id },
    data: {
      status: "pending_approval",
      workflowStep: "gerencia",
      assigneeType: "sector",
      assigneeUserId: null,
      assigneeGroupId: null,
      assigneeSectorId: setorGerencia.id,
    },
  });

  const afterFirst = await prisma.helpdeskTicket.findUnique({
    where: { id: ticket.id },
    include: { sector: { select: { name: true } } },
  });

  logEvidence({
    hypothesisId: "H5",
    step: "after_first_approve",
    ticketId: ticket.id,
    status: afterFirst?.status,
    workflowStep: afterFirst?.workflowStep,
    sectorName: afterFirst?.sector?.name ?? null,
    expected: "pending_approval + gerencia + setor Gerência Comercial",
  });

  await prisma.helpdeskApprovalLog.create({
    data: { ticketId: ticket.id, userId: adminUser.id, action: "approved", comment: null },
  });

  await prisma.helpdeskTicket.update({
    where: { id: ticket.id },
    data: { status: "concluido", workflowStep: null },
  });

  const afterSecond = await prisma.helpdeskTicket.findUnique({
    where: { id: ticket.id },
    select: { status: true, workflowStep: true },
  });

  logEvidence({
    hypothesisId: "H5",
    step: "after_second_approve",
    ticketId: ticket.id,
    status: afterSecond?.status,
    workflowStep: afterSecond?.workflowStep,
    expected: "concluido + workflowStep null",
  });

  const ok =
    afterSecond?.status === "concluido" &&
    afterSecond?.workflowStep === null &&
    afterFirst?.status === "pending_approval" &&
    afterFirst?.workflowStep === "gerencia";

  if (ok) {
    console.log("VALIDAÇÃO OK: fluxo Crédito → Gerência → concluído está correto.");
  } else {
    console.error("VALIDAÇÃO FALHOU: estado final inesperado.");
    process.exit(1);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
