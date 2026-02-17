import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIdsForUser, getGroupIdsForUser, getSectorIdsForUser, canUserCreateTicketFor } from "@/lib/helpdesk";

export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const status = searchParams.get("status");

  const clientIds = await getClientIdsForUser(userId);
  const role = (session.user as { role?: string })?.role;
  const isAdmin = role === "admin";

  const where: Record<string, unknown> = {};
  if (clientId) {
    if (!isAdmin && !clientIds.has(clientId)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    where.clientId = clientId;
  } else if (!isAdmin) {
    where.clientId = { in: Array.from(clientIds) };
  }
  if (status && ["open", "in_progress", "closed", "pending_approval", "rejected"].includes(status)) where.status = status;
  if (!isAdmin) {
    const [groupIds, sectorIds, approverConfigs] = await Promise.all([
      getGroupIdsForUser(userId),
      getSectorIdsForUser(userId),
      prisma.helpdeskApprovalConfigApprover.findMany({ where: { userId }, select: { config: { select: { groupId: true, sectorId: true } } } }),
    ]);
    const approverGroupIds = approverConfigs.filter((c) => c.config.groupId).map((c) => c.config.groupId!);
    const approverSectorIds = approverConfigs.filter((c) => c.config.sectorId).map((c) => c.config.sectorId!);
    where.OR = [
      { createdById: userId },
      { assigneeType: "user", assigneeUserId: userId },
      { assigneeType: "group", assigneeGroupId: { in: Array.from(groupIds) } },
      { assigneeType: "sector", assigneeSectorId: { in: Array.from(sectorIds) } },
      ...(approverGroupIds.length ? [{ status: "pending_approval", assigneeType: "group", assigneeGroupId: { in: approverGroupIds } }] : []),
      ...(approverSectorIds.length ? [{ status: "pending_approval", assigneeType: "sector", assigneeSectorId: { in: approverSectorIds } }] : []),
    ];
  }

  const tickets = await prisma.helpdeskTicket.findMany({
    where,
    include: {
      creator: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      assigneeUser: { select: { id: true, name: true } },
      group: { select: { id: true, name: true } },
      sector: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json(tickets);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const userId = (session.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

  let body: { clientId: string; subject?: string; assigneeType: "user" | "group" | "sector"; assigneeId: string; content: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { clientId, subject, assigneeType, assigneeId, content } = body;
  if (!clientId || !assigneeType || !assigneeId || !content?.trim()) {
    return NextResponse.json({ error: "clientId, assigneeType, assigneeId e content são obrigatórios" }, { status: 400 });
  }
  if (!["user", "group", "sector"].includes(assigneeType)) {
    return NextResponse.json({ error: "assigneeType inválido" }, { status: 400 });
  }

  const canCreate = await canUserCreateTicketFor(userId, clientId, assigneeType, assigneeId);
  const role = (session.user as { role?: string })?.role;
  if (!canCreate && role !== "admin") {
    return NextResponse.json({ error: "Sem permissão para criar ticket" }, { status: 403 });
  }

  let initialStatus: "open" | "pending_approval" = "open";
  const approvalConfig =
    assigneeType === "group" || assigneeType === "sector"
      ? await prisma.helpdeskApprovalConfig.findFirst({
          where: {
            clientId,
            ...(assigneeType === "group" ? { groupId: assigneeId } : { sectorId: assigneeId }),
          },
          include: { approvers: { select: { userId: true } } },
        })
      : null;

  if (approvalConfig?.exigeAprovacao) {
    initialStatus = "pending_approval";
  }

  const ticket = await prisma.helpdeskTicket.create({
    data: {
      clientId,
      subject: subject?.trim() || null,
      status: initialStatus,
      assigneeType,
      assigneeUserId: assigneeType === "user" ? assigneeId : null,
      assigneeGroupId: assigneeType === "group" ? assigneeId : null,
      assigneeSectorId: assigneeType === "sector" ? assigneeId : null,
      createdById: userId,
      messages: {
        create: { userId, content: content.trim() },
      },
    },
    include: {
      creator: { select: { id: true, name: true } },
      client: { select: { id: true, name: true } },
      messages: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  const firstMsg = ticket.messages[0];
  const userIdsToNotify = new Set<string>();

  if (initialStatus === "pending_approval" && approvalConfig) {
    approvalConfig.approvers.forEach((a) => userIdsToNotify.add(a.userId));
    userIdsToNotify.delete(userId);
    if (userIdsToNotify.size > 0) {
      await prisma.helpdeskNotification.createMany({
        data: Array.from(userIdsToNotify).map((uid) => ({
          userId: uid,
          ticketId: ticket.id,
          messageId: firstMsg?.id ?? null,
          type: "awaiting_approval",
        })),
      });
    }
  } else {
    if (assigneeType === "user" && assigneeId !== userId) userIdsToNotify.add(assigneeId);
    if (assigneeType === "group") {
      const perms = await prisma.userGroupPermission.findMany({
        where: { groupId: assigneeId },
        select: { userId: true },
      });
      perms.forEach((p) => userIdsToNotify.add(p.userId));
    }
    if (assigneeType === "sector") {
      const perms = await prisma.userSectorPermission.findMany({
        where: { sectorId: assigneeId },
        select: { userId: true },
      });
      perms.forEach((p) => userIdsToNotify.add(p.userId));
    }
    userIdsToNotify.delete(userId);
    if (userIdsToNotify.size > 0 && firstMsg) {
      await prisma.helpdeskNotification.createMany({
        data: Array.from(userIdsToNotify).map((uid) => ({
          userId: uid,
          ticketId: ticket.id,
          messageId: firstMsg.id,
          type: "new_ticket",
        })),
      });
    }
  }

  return NextResponse.json(ticket);
}
