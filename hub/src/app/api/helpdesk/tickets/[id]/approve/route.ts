import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUserApproveTicket } from "@/lib/helpdesk";
import { TIPO_CADASTRO_DESCONTO_COMERCIAL } from "@/lib/schemas/helpdesk";

/** Até 5 centavos: Análise de Crédito encerra em concluído (POP nível 1). */
const LIMIAR_CREDITO_CENTAVOS = 0.05;
/** Até 10 centavos: Gerência Comercial pode encerrar (POP nível 2). */
const LIMIAR_GERENCIA_CENTAVOS = 0.1;
/** Até 15 centavos: Diretor pode encerrar; acima sobe para Diretoria (POP níveis 3 e 4). */
const LIMIAR_DIRETOR_CENTAVOS = 0.15;
/** Acima deste valor (outros tipos): exigem 2 aprovações de proprietários. */
const LIMIAR_PROPRIETARIOS_CENTAVOS = 0.2;

const NOME_SETOR_ANALISE_CREDITO = "Análise de Crédito";
const NOME_SETOR_GERENCIA_COMERCIAL = "Gerência Comercial";
const NOME_SETOR_DIRETOR = "Diretor";
const NOME_SETOR_DIRETORIA = "Diretoria";

/** Formas de pagamento consideradas à vista para alçada nível 1 (POP). */
const FORMAS_AVISTA_NOMES = ["DINHEIRO", "PIX"];
const VOLUME_MINIMO_NIVEL1_LITROS = 500;

async function findSectorByName(clientId: string, name: string) {
  return prisma.sector.findFirst({
    where: { name, group: { clientId } },
    select: { id: true },
  });
}

async function notifyApproversAndCreator(
  ticketId: string,
  sectorId: string,
  createdById: string | null,
  excludingUserId: string
) {
  const approvers = await prisma.helpdeskApprovalConfigApprover.findMany({
    where: { config: { sectorId } },
    select: { userId: true },
  });
  const userIdsToNotify = new Set(approvers.map((a) => a.userId));
  if (createdById) userIdsToNotify.add(createdById);
  userIdsToNotify.delete(excludingUserId);
  userIdsToNotify.delete("");
  if (userIdsToNotify.size > 0) {
    await prisma.helpdeskNotification.createMany({
      data: Array.from(userIdsToNotify).map((uid) => ({
        userId: uid,
        ticketId,
        type: "awaiting_approval",
      })),
    });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { id } = await context.params;
  let body: { comment?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const canApprove = await canUserApproveTicket(userId, id);
  if (!canApprove) return NextResponse.json({ error: "Sem permissão para aprovar" }, { status: 403 });

  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id },
    select: {
      status: true,
      workflowStep: true,
      assigneeGroupId: true,
      assigneeSectorId: true,
      createdById: true,
      clientId: true,
      tipoSolicitacaoId: true,
      custoOrcamento: true,
      formData: true,
      tipoSolicitacao: { select: { nome: true } },
    },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  if (ticket.status !== "pending_approval" && ticket.status !== "aguardando_aprovacao_proprietarios") {
    return NextResponse.json({ error: "Ticket não está aguardando aprovação" }, { status: 400 });
  }

  const isEtapaProprietarios = ticket.workflowStep === "proprietarios" && ticket.status === "aguardando_aprovacao_proprietarios";
  const isTipoCadastroDesconto = ticket.tipoSolicitacao?.nome === TIPO_CADASTRO_DESCONTO_COMERCIAL;
  const valorDesconto = ticket.custoOrcamento != null ? Number(ticket.custoOrcamento) : null;
  const formData = (ticket.formData as Record<string, unknown> | null) ?? {};
  const formaPagamentoNome = typeof formData.formaPagamentoNome === "string" ? formData.formaPagamentoNome.trim().toUpperCase() : "";
  const volumeEstimadoLitros = typeof formData.volumeEstimadoLitros === "number" ? formData.volumeEstimadoLitros : (typeof formData.volumeEstimadoLitros === "string" ? parseFloat(formData.volumeEstimadoLitros) : NaN);
  const volumeNum = Number.isNaN(volumeEstimadoLitros) ? 0 : volumeEstimadoLitros;
  const classeABC = typeof formData.classeABC === "string" ? formData.classeABC.toUpperCase() : "";

  if (!isEtapaProprietarios && isTipoCadastroDesconto && valorDesconto != null) {
    const step = ticket.workflowStep ?? "credito";
    if (step === "credito" || step === null) {
      if (valorDesconto <= LIMIAR_CREDITO_CENTAVOS) {
        const isAvista = FORMAS_AVISTA_NOMES.includes(formaPagamentoNome);
        if (!isAvista) {
          return NextResponse.json(
            { error: "Aprovação neste nível exige forma de pagamento à vista (ex.: Dinheiro, PIX)." },
            { status: 400 }
          );
        }
        if (volumeNum < VOLUME_MINIMO_NIVEL1_LITROS) {
          return NextResponse.json(
            { error: `Aprovação neste nível exige volume estimado de pelo menos ${VOLUME_MINIMO_NIVEL1_LITROS} L.` },
            { status: 400 }
          );
        }
      }
    } else if (step === "gerencia") {
      if (valorDesconto <= LIMIAR_GERENCIA_CENTAVOS) {
        if (classeABC !== "A" && classeABC !== "B") {
          return NextResponse.json(
            { error: "Aprovação neste nível exige cliente classificado como Curva A ou B (Classe ABC)." },
            { status: 400 }
          );
        }
      }
    }
  }

  if (isEtapaProprietarios) {
    const countResult = await prisma.helpdeskApprovalLog.groupBy({
      by: ["userId"],
      where: { ticketId: id, action: "approved" },
    });
    const approverIds = new Set(countResult.map((r) => r.userId));
    approverIds.add(userId);
    if (approverIds.size >= 2) {
      await prisma.$transaction([
        prisma.helpdeskApprovalLog.create({
          data: { ticketId: id, userId, action: "approved", comment: body.comment?.trim() || null },
        }),
        prisma.helpdeskTicket.update({ where: { id }, data: { status: "concluido", workflowStep: null } }),
      ]);
      const proprietarios = await prisma.clientProprietario.findMany({
        where: { clientId: ticket.clientId },
        select: { userId: true },
      });
      const userIdsToNotify = new Set(proprietarios.map((p) => p.userId));
      if (ticket.createdById) userIdsToNotify.add(ticket.createdById);
      userIdsToNotify.delete(userId);
      if (userIdsToNotify.size > 0) {
        await prisma.helpdeskNotification.createMany({
          data: Array.from(userIdsToNotify).map((uid) => ({
            userId: uid,
            ticketId: id,
            type: "approved",
          })),
        });
      }
    } else {
      await prisma.helpdeskApprovalLog.create({
        data: { ticketId: id, userId, action: "approved", comment: body.comment?.trim() || null },
      });
    }
  } else {
    await prisma.helpdeskApprovalLog.create({
      data: { ticketId: id, userId, action: "approved", comment: body.comment?.trim() || null },
    });

    if (isTipoCadastroDesconto && valorDesconto != null) {
      const step = ticket.workflowStep ?? "credito";

      if (step === "credito" || step === null) {
        if (valorDesconto <= LIMIAR_CREDITO_CENTAVOS) {
          await prisma.helpdeskTicket.update({
            where: { id },
            data: { status: "concluido", workflowStep: null },
          });
        } else {
          const setorGerencia = await findSectorByName(ticket.clientId, NOME_SETOR_GERENCIA_COMERCIAL);
          if (setorGerencia) {
            await prisma.helpdeskTicket.update({
              where: { id },
              data: {
                status: "pending_approval",
                workflowStep: "gerencia",
                assigneeType: "sector",
                assigneeUserId: null,
                assigneeGroupId: null,
                assigneeSectorId: setorGerencia.id,
              },
            });
            await notifyApproversAndCreator(id, setorGerencia.id, ticket.createdById, userId);
          } else {
            await prisma.helpdeskTicket.update({ where: { id }, data: { status: "open", workflowStep: null } });
          }
        }
      } else if (step === "gerencia") {
        if (valorDesconto <= LIMIAR_GERENCIA_CENTAVOS) {
          await prisma.helpdeskTicket.update({
            where: { id },
            data: { status: "concluido", workflowStep: null },
          });
        } else {
          const setorDiretor = await findSectorByName(ticket.clientId, NOME_SETOR_DIRETOR);
          if (setorDiretor) {
            await prisma.helpdeskTicket.update({
              where: { id },
              data: {
                status: "pending_approval",
                workflowStep: "diretor",
                assigneeType: "sector",
                assigneeUserId: null,
                assigneeGroupId: null,
                assigneeSectorId: setorDiretor.id,
              },
            });
            await notifyApproversAndCreator(id, setorDiretor.id, ticket.createdById, userId);
          } else {
            const setorDiretoria = await findSectorByName(ticket.clientId, NOME_SETOR_DIRETORIA);
            if (setorDiretoria) {
              await prisma.helpdeskTicket.update({
                where: { id },
                data: {
                  status: "pending_approval",
                  workflowStep: "diretoria",
                  assigneeType: "sector",
                  assigneeUserId: null,
                  assigneeGroupId: null,
                  assigneeSectorId: setorDiretoria.id,
                },
              });
              await notifyApproversAndCreator(id, setorDiretoria.id, ticket.createdById, userId);
            } else {
              await prisma.helpdeskTicket.update({ where: { id }, data: { status: "open", workflowStep: null } });
            }
          }
        }
      } else if (step === "diretor") {
        if (valorDesconto <= LIMIAR_DIRETOR_CENTAVOS) {
          await prisma.helpdeskTicket.update({
            where: { id },
            data: { status: "concluido", workflowStep: null },
          });
        } else {
          const setorDiretoria = await findSectorByName(ticket.clientId, NOME_SETOR_DIRETORIA);
          if (setorDiretoria) {
            await prisma.helpdeskTicket.update({
              where: { id },
              data: {
                status: "pending_approval",
                workflowStep: "diretoria",
                assigneeType: "sector",
                assigneeUserId: null,
                assigneeGroupId: null,
                assigneeSectorId: setorDiretoria.id,
              },
            });
            await notifyApproversAndCreator(id, setorDiretoria.id, ticket.createdById, userId);
          } else {
            await prisma.helpdeskTicket.update({ where: { id }, data: { status: "open", workflowStep: null } });
          }
        }
      } else if (step === "diretoria") {
        await prisma.helpdeskTicket.update({
          where: { id },
          data: { status: "concluido", workflowStep: null },
        });
      } else {
        await prisma.helpdeskTicket.update({ where: { id }, data: { status: "open", workflowStep: null } });
      }
    } else {
      const proximaEtapaGerencia =
        isTipoCadastroDesconto && valorDesconto != null && valorDesconto <= LIMIAR_GERENCIA_CENTAVOS;
      const proximaEtapaProprietarios =
        isTipoCadastroDesconto && valorDesconto != null && valorDesconto > LIMIAR_PROPRIETARIOS_CENTAVOS;

      if (proximaEtapaGerencia) {
        const setorGerencia = await findSectorByName(ticket.clientId, NOME_SETOR_GERENCIA_COMERCIAL);
        if (setorGerencia) {
          await prisma.helpdeskTicket.update({
            where: { id },
            data: {
              status: "pending_approval",
              workflowStep: "gerencia",
              assigneeType: "sector",
              assigneeUserId: null,
              assigneeGroupId: null,
              assigneeSectorId: setorGerencia.id,
            },
          });
          await notifyApproversAndCreator(id, setorGerencia.id, ticket.createdById, userId);
        } else {
          await prisma.helpdeskTicket.update({ where: { id }, data: { status: "open", workflowStep: null } });
        }
      } else if (proximaEtapaProprietarios) {
        await prisma.helpdeskTicket.update({
          where: { id },
          data: {
            status: "aguardando_aprovacao_proprietarios",
            workflowStep: "proprietarios",
            assigneeType: "sector",
            assigneeUserId: null,
            assigneeGroupId: null,
            assigneeSectorId: null,
          },
        });
        const proprietarios = await prisma.clientProprietario.findMany({
          where: { clientId: ticket.clientId },
          select: { userId: true },
        });
        const userIdsToNotify = new Set(proprietarios.map((p) => p.userId));
        userIdsToNotify.add(ticket.createdById ?? "");
        userIdsToNotify.delete(userId);
        userIdsToNotify.delete("");
        if (userIdsToNotify.size > 0) {
          await prisma.helpdeskNotification.createMany({
            data: Array.from(userIdsToNotify).map((uid) => ({
              userId: uid,
              ticketId: id,
              type: "awaiting_approval",
            })),
          });
        }
      } else {
        await prisma.helpdeskTicket.update({ where: { id }, data: { status: "open", workflowStep: null } });
      }
    }
  }

  const userIdsToNotify = new Set<string>();
  if (ticket.assigneeGroupId) {
    const perms = await prisma.userGroupPermission.findMany({
      where: { groupId: ticket.assigneeGroupId },
      select: { userId: true },
    });
    perms.forEach((p) => userIdsToNotify.add(p.userId));
  }
  if (ticket.assigneeSectorId) {
    const perms = await prisma.userSectorPermission.findMany({
      where: { sectorId: ticket.assigneeSectorId },
      select: { userId: true },
    });
    perms.forEach((p) => userIdsToNotify.add(p.userId));
  }
  if (ticket.createdById) userIdsToNotify.add(ticket.createdById);
  userIdsToNotify.delete(userId);
  if (userIdsToNotify.size > 0) {
    await prisma.helpdeskNotification.createMany({
      data: Array.from(userIdsToNotify).map((uid) => ({
        userId: uid,
        ticketId: id,
        type: "approved",
      })),
    });
  }

  const updated = await prisma.helpdeskTicket.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json(updated);
}
