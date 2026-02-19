import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUserApproveTicket } from "@/lib/helpdesk";
import { TIPO_CADASTRO_DESCONTO_COMERCIAL } from "@/lib/schemas/helpdesk";

/** Limiar em reais: até este valor a aprovação é da Gerência Comercial (1 aprovação). */
const LIMIAR_GERENCIA_CENTAVOS = 0.1;
/** Acima deste valor exigem-se 2 aprovações de proprietários do cliente. */
const LIMIAR_PROPRIETARIOS_CENTAVOS = 0.2;
const NOME_SETOR_GERENCIA_COMERCIAL = "Gerência Comercial";

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
      tipoSolicitacao: { select: { nome: true } },
    },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  if (ticket.status !== "pending_approval" && ticket.status !== "aguardando_aprovacao_proprietarios") {
    return NextResponse.json({ error: "Ticket não está aguardando aprovação" }, { status: 400 });
  }

  const isEtapaProprietarios = ticket.workflowStep === "proprietarios" && ticket.status === "aguardando_aprovacao_proprietarios";
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
      await prisma.$transaction([
        prisma.helpdeskApprovalLog.create({
          data: { ticketId: id, userId, action: "approved", comment: body.comment?.trim() || null },
        }),
      ]);
    }
  } else {
    await prisma.helpdeskApprovalLog.create({
      data: { ticketId: id, userId, action: "approved", comment: body.comment?.trim() || null },
    });

    const valorDesconto = ticket.custoOrcamento != null ? Number(ticket.custoOrcamento) : null;
    const isTipoCadastroDesconto = ticket.tipoSolicitacao?.nome === TIPO_CADASTRO_DESCONTO_COMERCIAL;
    const proximaEtapaGerencia =
      isTipoCadastroDesconto && valorDesconto != null && valorDesconto <= LIMIAR_GERENCIA_CENTAVOS;
    const proximaEtapaProprietarios =
      isTipoCadastroDesconto && valorDesconto != null && valorDesconto > LIMIAR_PROPRIETARIOS_CENTAVOS;

    if (proximaEtapaGerencia) {
      const setorGerencia = await prisma.sector.findFirst({
        where: { name: NOME_SETOR_GERENCIA_COMERCIAL, group: { clientId: ticket.clientId } },
        select: { id: true },
      });
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
        const approvers = await prisma.helpdeskApprovalConfigApprover.findMany({
          where: { config: { sectorId: setorGerencia.id } },
          select: { userId: true },
        });
        const userIdsToNotify = new Set(approvers.map((a) => a.userId));
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
