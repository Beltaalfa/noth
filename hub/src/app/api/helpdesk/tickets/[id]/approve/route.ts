import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUserApproveTicket } from "@/lib/helpdesk";

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
    select: { status: true, assigneeGroupId: true, assigneeSectorId: true, createdById: true },
  });
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
  if (ticket.status !== "pending_approval") {
    return NextResponse.json({ error: "Ticket não está aguardando aprovação" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.helpdeskApprovalLog.create({
      data: { ticketId: id, userId, action: "approved", comment: body.comment?.trim() || null },
    }),
    prisma.helpdeskTicket.update({ where: { id }, data: { status: "open" } }),
  ]);

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
