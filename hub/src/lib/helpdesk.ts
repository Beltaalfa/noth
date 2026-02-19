import { prisma } from "./prisma";

export type HelpdeskProfile = {
  primaryGroupId: string | null;
  primarySectorId: string | null;
  isGerenteArea: boolean;
  podeReceberChamados: boolean;
  podeEncaminharChamados: boolean;
  valorMaximoAutorizar: number | null;
  helpdeskNivelAcesso: string | null;
};

export async function getHelpdeskProfile(userId: string): Promise<HelpdeskProfile | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      primaryGroupId: true,
      primarySectorId: true,
      isGerenteArea: true,
      podeReceberChamados: true,
      podeEncaminharChamados: true,
      valorMaximoAutorizar: true,
      helpdeskNivelAcesso: true,
    },
  });
  if (!u) return null;
  return {
    primaryGroupId: u.primaryGroupId,
    primarySectorId: u.primarySectorId,
    isGerenteArea: u.isGerenteArea ?? false,
    podeReceberChamados: u.podeReceberChamados ?? false,
    podeEncaminharChamados: u.podeEncaminharChamados ?? false,
    valorMaximoAutorizar: u.valorMaximoAutorizar != null ? Number(u.valorMaximoAutorizar) : null,
    helpdeskNivelAcesso: u.helpdeskNivelAcesso,
  };
}

/** Group IDs das áreas que o usuário gerencia (quando isGerenteArea). */
export async function getManagedGroupIdsForUser(userId: string): Promise<Set<string>> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGerenteArea: true, primaryGroupId: true, primarySectorId: true, primarySector: { select: { groupId: true } } },
  });
  if (!u || !u.isGerenteArea) return new Set();
  if (u.primaryGroupId) return new Set([u.primaryGroupId]);
  if (u.primarySectorId && u.primarySector?.groupId) return new Set([u.primarySector.groupId]);
  return new Set();
}

/** Sector IDs das áreas que o usuário gerencia (quando isGerenteArea). */
export async function getManagedSectorIdsForUser(userId: string): Promise<Set<string>> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { isGerenteArea: true, primarySectorId: true, primaryGroupId: true },
  });
  if (!u || !u.isGerenteArea) return new Set();
  if (u.primarySectorId) return new Set([u.primarySectorId]);
  if (u.primaryGroupId) {
    const sectors = await prisma.sector.findMany({ where: { groupId: u.primaryGroupId }, select: { id: true } });
    return new Set(sectors.map((s) => s.id));
  }
  return new Set();
}

/** Para filas: group/sector IDs onde o operador atua (primary ou permissões). */
export async function getQueueGroupIdsForUser(userId: string): Promise<Set<string>> {
  const [profile, groupPerms] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { primaryGroupId: true } }),
    getGroupIdsForUser(userId),
  ]);
  const ids = new Set(groupPerms);
  if (profile?.primaryGroupId) ids.add(profile.primaryGroupId);
  return ids;
}

export async function getQueueSectorIdsForUser(userId: string): Promise<Set<string>> {
  const [profile, sectorPerms] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { primarySectorId: true, primaryGroupId: true } }),
    getSectorIdsForUser(userId),
  ]);
  const ids = new Set(sectorPerms);
  if (profile?.primarySectorId) ids.add(profile.primarySectorId);
  if (profile?.primaryGroupId) {
    const sectors = await prisma.sector.findMany({ where: { groupId: profile.primaryGroupId }, select: { id: true } });
    sectors.forEach((s) => ids.add(s.id));
  }
  return ids;
}

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
    include: { config: { select: { sectorId: true, tipoSolicitacaoId: true } } },
  });
  if (approver) {
    if (approver.config.sectorId && approver.config.tipoSolicitacaoId) {
      const ticketWithTipo = await prisma.helpdeskTicket.findUnique({
        where: { id: ticketId },
        select: { tipoSolicitacaoId: true },
      });
      if (ticketWithTipo?.tipoSolicitacaoId !== approver.config.tipoSolicitacaoId) return false;
    }
    return true;
  }

  return false;
}

/** Verifica se o usuário pode aprovar/reprovar o ticket.
 * Setor (Group): pode aprovar todos os tipos do setor.
 * Grupo (Sector): pode aprovar apenas o tipo de solicitação configurado (tipoSolicitacaoId). */
export async function canUserApproveTicket(userId: string, ticketId: string): Promise<boolean> {
  const ticket = await prisma.helpdeskTicket.findUnique({
    where: { id: ticketId },
    select: { assigneeGroupId: true, assigneeSectorId: true, status: true, tipoSolicitacaoId: true },
  });
  if (!ticket || ticket.status !== "pending_approval") return false;

  const approver = await prisma.helpdeskApprovalConfigApprover.findFirst({
    where: { userId },
    include: { config: { select: { groupId: true, sectorId: true, tipoSolicitacaoId: true } } },
  });
  if (!approver) return false;

  if (approver.config.groupId && ticket.assigneeGroupId === approver.config.groupId) return true;
  if (approver.config.sectorId && ticket.assigneeSectorId === approver.config.sectorId) {
    if (approver.config.tipoSolicitacaoId) return ticket.tipoSolicitacaoId === approver.config.tipoSolicitacaoId;
    return true;
  }
  return false;
}

/** Verifica se o usuário tem acesso ao cliente (vínculo direto, grupo ou setor). */
export async function userHasAccessToClient(userId: string, clientId: string): Promise<boolean> {
  const hasClient = await prisma.userClientPermission.findFirst({
    where: { userId, clientId },
  });
  if (hasClient) return true;
  const ug = await prisma.userGroupPermission.findFirst({
    where: { userId },
    include: { group: { select: { clientId: true } } },
  });
  if (ug?.group.clientId === clientId) return true;
  const us = await prisma.userSectorPermission.findFirst({
    where: { userId },
    include: { sector: { include: { group: { select: { clientId: true } } } } },
  });
  return us?.sector.group.clientId === clientId;
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
