import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canUserAccessTicket } from "@/lib/helpdesk";
import { messageBodySchema } from "@/lib/schemas/helpdesk";
import { checkRateLimit, getRateLimitKey } from "@/lib/rateLimit";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { id: ticketId } = await context.params;
  const canAccess = await canUserAccessTicket(userId, ticketId);
  if (!canAccess) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const rl = checkRateLimit(getRateLimitKey(userId, "ticket:message"));
  if (!rl.ok) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em alguns instantes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const parsed = messageBodySchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join("; ") || "Dados inválidos";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const content = parsed.data.content;

  const message = await prisma.helpdeskMessage.create({
    data: { ticketId, userId, content },
    include: { user: { select: { id: true, name: true } }, attachments: true },
  });
  const ticketForStatus = await prisma.helpdeskTicket.findUnique({
    where: { id: ticketId },
    select: { createdById: true, assigneeType: true, assigneeUserId: true, assigneeGroupId: true, assigneeSectorId: true },
  });
  const newStatus = ticketForStatus?.createdById && ticketForStatus.createdById !== userId
    ? "aguardando_feedback_usuario"
    : "in_progress";
  await prisma.helpdeskTicket.update({ where: { id: ticketId }, data: { status: newStatus, updatedAt: new Date() } });
  const ticket = ticketForStatus;
  if (ticket) {
    const userIdsToNotify = new Set<string>();
    if (ticket.assigneeType === "user" && ticket.assigneeUserId && ticket.assigneeUserId !== userId) userIdsToNotify.add(ticket.assigneeUserId);
    if (ticket.assigneeType === "group" && ticket.assigneeGroupId) {
      const perms = await prisma.userGroupPermission.findMany({ where: { groupId: ticket.assigneeGroupId }, select: { userId: true } });
      perms.forEach((p) => userIdsToNotify.add(p.userId));
    }
    if (ticket.assigneeType === "sector" && ticket.assigneeSectorId) {
      const perms = await prisma.userSectorPermission.findMany({ where: { sectorId: ticket.assigneeSectorId }, select: { userId: true } });
      perms.forEach((p) => userIdsToNotify.add(p.userId));
    }
    const creatorTicket = await prisma.helpdeskTicket.findUnique({ where: { id: ticketId }, select: { createdById: true } });
    if (creatorTicket && creatorTicket.createdById !== userId) userIdsToNotify.add(creatorTicket.createdById);
    userIdsToNotify.delete(userId);
    if (userIdsToNotify.size > 0) {
      await prisma.helpdeskNotification.createMany({
        data: Array.from(userIdsToNotify).map((uid) => ({ userId: uid, ticketId, messageId: message.id, type: "new_message" })),
      });
    }
  }
  return NextResponse.json(message);
}
