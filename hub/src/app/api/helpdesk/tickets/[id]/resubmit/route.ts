import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUserAccessTicket } from "@/lib/helpdesk";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { id } = await context.params;
  const canAccess = await canUserAccessTicket(userId, id);
  if (!canAccess) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id },
    select: { status: true, createdById: true, assigneeGroupId: true, assigneeSectorId: true },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  if (ticket.status !== "rejected") {
    return NextResponse.json({ error: "Apenas tickets reprovados podem ser reenviados" }, { status: 400 });
  }
  if (ticket.createdById !== userId) {
    return NextResponse.json({ error: "Apenas o solicitante pode reenviar" }, { status: 403 });
  }

  const config = await prisma.helpdeskApprovalConfig.findFirst({
    where: {
      OR: [
        ...(ticket.assigneeGroupId ? [{ groupId: ticket.assigneeGroupId }] : []),
        ...(ticket.assigneeSectorId ? [{ sectorId: ticket.assigneeSectorId }] : []),
      ],
    },
    include: { approvers: { select: { userId: true } } },
  });

  if (!config?.exigeAprovacao) {
    await prisma.helpdeskTicket.update({ where: { id }, data: { status: "open" } });
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

  const userIdsToNotify = new Set(config.approvers.map((a) => a.userId));
  userIdsToNotify.delete(userId);

  await prisma.helpdeskTicket.update({ where: { id }, data: { status: "pending_approval" } });
  if (userIdsToNotify.size > 0) {
    await prisma.helpdeskNotification.createMany({
      data: Array.from(userIdsToNotify).map((uid) => ({
        userId: uid,
        ticketId: id,
        type: "awaiting_approval",
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
