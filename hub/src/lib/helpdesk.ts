import { prisma } from "./prisma";

export async function getClientIdsForUser(userId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const [uc, ug, us] = await Promise.all([
    prisma.userClientPermission.findMany({ where: { userId }, select: { clientId: true } }),
    prisma.userGroupPermission.findMany({ where: { userId }, include: { group: { select: { clientId: true } } } }),
    prisma.userSectorPermission.findMany({ where: { userId }, include: { sector: { include: { group: { select: { clientId: true } } } } } }),
  ]);
  for (const p of uc) ids.add(p.clientId);
  for (const p of ug) if (p.group.clientId) ids.add(p.group.clientId);
  for (const p of us) if (p.sector.group?.clientId) ids.add(p.sector.group.clientId);
  return ids;
}

export async function getGroupIdsForUser(userId: string): Promise<Set<string>> {
  const perms = await prisma.userGroupPermission.findMany({
    where: { userId },
    select: { groupId: true },
  });
  return new Set(perms.map((p) => p.groupId));
}

export async function getSectorIdsForUser(userId: string): Promise<Set<string>> {
  const perms = await prisma.userSectorPermission.findMany({
    where: { userId },
    select: { sectorId: true },
  });
  return new Set(perms.map((p) => p.sectorId));
}

/** Verifica se o usuário pode ver/responder o ticket (busca no central) */
export async function canUserAccessTicket(userId: string, ticketId: string): Promise<boolean> {
  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id: ticketId },
    select: { clientId: true, createdById: true, assigneeType: true, assigneeUserId: true, assigneeGroupId: true, assigneeSectorId: true },
  });
  if (!ticket) return false;

  const clientIds = await getClientIdsForUser(userId);
  if (!clientIds.has(ticket.clientId)) return false;

  if (ticket.createdById === userId) return true;
  if (ticket.assigneeType === "user" && ticket.assigneeUserId === userId) return true;

  const groupIds = await getGroupIdsForUser(userId);
  if (ticket.assigneeType === "group" && ticket.assigneeGroupId && groupIds.has(ticket.assigneeGroupId)) return true;

  const sectorIds = await getSectorIdsForUser(userId);
  if (ticket.assigneeType === "sector" && ticket.assigneeSectorId && sectorIds.has(ticket.assigneeSectorId)) return true;

  const approver = await prisma.helpdeskApprovalConfigApprover.findFirst({
    where: {
      userId,
      OR: [
        ...(ticket.assigneeGroupId ? [{ config: { groupId: ticket.assigneeGroupId } }] : []),
        ...(ticket.assigneeSectorId ? [{ config: { sectorId: ticket.assigneeSectorId } }] : []),
      ],
    },
  });
  if (approver) return true;

  return false;
}

/** Verifica se o usuário pode aprovar/reprovar o ticket */
export async function canUserApproveTicket(userId: string, ticketId: string): Promise<boolean> {
  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id: ticketId },
    select: { assigneeGroupId: true, assigneeSectorId: true, status: true },
  });
  if (!ticket || ticket.status !== "pending_approval") return false;

  const approver = await prisma.helpdeskApprovalConfigApprover.findFirst({
    where: { userId },
    include: { config: { select: { groupId: true, sectorId: true } } },
  });
  if (!approver) return false;

  if (approver.config.groupId && ticket.assigneeGroupId === approver.config.groupId) return true;
  if (approver.config.sectorId && ticket.assigneeSectorId === approver.config.sectorId) return true;
  return false;
}

/** Verifica se o usuário pode criar ticket para o destinatário no cliente */
export async function canUserCreateTicketFor(
  userId: string,
  clientId: string,
  assigneeType: "user" | "group" | "sector",
  assigneeId: string
): Promise<boolean> {
  const clientIds = await getClientIdsForUser(userId);
  if (!clientIds.has(clientId)) return false;

  if (assigneeType === "user") {
    const hasAccess = await prisma.userClientPermission.findFirst({
      where: { userId: assigneeId, clientId },
    });
    if (hasAccess) return true;
    const ug = await prisma.userGroupPermission.findFirst({
      where: { userId: assigneeId },
      include: { group: true },
    });
    if (ug?.group.clientId === clientId) return true;
    const us = await prisma.userSectorPermission.findFirst({
      where: { userId: assigneeId },
      include: { sector: { include: { group: true } } },
    });
    return us?.sector.group.clientId === clientId;
  }
  if (assigneeType === "group") {
    const g = await prisma.group.findFirst({ where: { id: assigneeId, clientId } });
    return !!g;
  }
  if (assigneeType === "sector") {
    const s = await prisma.sector.findFirst({
      where: { id: assigneeId },
      include: { group: true },
    });
    return s?.group.clientId === clientId;
  }
  return false;
}
