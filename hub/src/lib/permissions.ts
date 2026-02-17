import { prisma } from "./prisma";

async function getClientIdsForUser(userId: string): Promise<Set<string>> {
  const clientIds = new Set<string>();
  const [uc, ug, us] = await Promise.all([
    prisma.userClientPermission.findMany({ where: { userId }, select: { clientId: true } }),
    prisma.userGroupPermission.findMany({ where: { userId }, include: { group: { select: { clientId: true } } } }),
    prisma.userSectorPermission.findMany({ where: { userId }, include: { sector: { include: { group: { select: { clientId: true } } } } } }),
  ]);
  for (const p of uc) clientIds.add(p.clientId);
  for (const p of ug) if (p.group.clientId) clientIds.add(p.group.clientId);
  for (const p of us) if (p.sector.group?.clientId) clientIds.add(p.sector.group.clientId);
  return clientIds;
}

export async function getToolsForUser(userId: string): Promise<{ id: string; name: string; slug: string; clientId: string }[]> {
  const clientIds = await getClientIdsForUser(userId);
  if (clientIds.size === 0) return [];

  const clientTools = await prisma.clientTool.findMany({
    where: { clientId: { in: Array.from(clientIds) } },
    include: { tool: true },
  });

  const seen = new Set<string>();
  const tools: { id: string; name: string; slug: string; clientId: string }[] = [];
  for (const ct of clientTools) {
    if (ct.tool.status === "active" && ct.tool.type !== "powerbi_report" && !seen.has(ct.tool.id)) {
      seen.add(ct.tool.id);
      tools.push({ id: ct.tool.id, name: ct.tool.name, slug: ct.tool.slug, clientId: ct.tool.clientId });
    }
  }
  return tools;
}

export async function canUserAccessTool(userId: string, toolId: string): Promise<boolean> {
  const tools = await getToolsForUser(userId);
  return tools.some((t) => t.id === toolId);
}

export type ReportForUser = {
  id: string;
  name: string;
  slug: string;
  clientId: string;
  client: { name: string; logoUrl: string | null };
};

export async function getReportsForUser(userId: string): Promise<ReportForUser[]> {
  const [groupPerms, sectorPerms] = await Promise.all([
    prisma.userGroupPermission.findMany({ where: { userId }, select: { groupId: true } }),
    prisma.userSectorPermission.findMany({ where: { userId }, select: { sectorId: true } }),
  ]);
  const groupIds = groupPerms.map((p) => p.groupId);
  const sectorIds = sectorPerms.map((p) => p.sectorId);

  const toolPerms = await prisma.toolPermission.findMany({
    where: {
      tool: { type: "powerbi_report", status: "active" },
      OR: [
        { principalType: "user", principalId: userId },
        ...(groupIds.length ? [{ principalType: "group" as const, principalId: { in: groupIds } }] : []),
        ...(sectorIds.length ? [{ principalType: "sector" as const, principalId: { in: sectorIds } }] : []),
      ],
    },
    include: { tool: { include: { client: { select: { name: true, logoUrl: true } } } } },
  });

  const seen = new Set<string>();
  const reports: ReportForUser[] = [];
  for (const tp of toolPerms) {
    const t = tp.tool;
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      reports.push({
        id: t.id,
        name: t.name,
        slug: t.slug,
        clientId: t.clientId,
        client: { name: t.client.name, logoUrl: t.client.logoUrl },
      });
    }
  }
  return reports;
}

export async function canUserAccessReport(userId: string, toolId: string): Promise<boolean> {
  const reports = await getReportsForUser(userId);
  return reports.some((r) => r.id === toolId);
}

export async function getClientsForUser(userId: string): Promise<{ id: string; name: string }[]> {
  const clientIds = await getClientIdsForUser(userId);
  if (clientIds.size === 0) return [];

  const clients = await prisma.client.findMany({
    where: { id: { in: Array.from(clientIds) }, deletedAt: null, status: "active" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return clients;
}

export type AlteracaoDespesaTool = {
  id: string;
  clientId: string;
  client: { id: string; name: string };
};

export async function getAlteracaoDespesaToolsForUser(
  userId: string
): Promise<AlteracaoDespesaTool[]> {
  const [groupPerms, sectorPerms] = await Promise.all([
    prisma.userGroupPermission.findMany({ where: { userId }, select: { groupId: true } }),
    prisma.userSectorPermission.findMany({ where: { userId }, select: { sectorId: true } }),
  ]);
  const groupIds = groupPerms.map((p) => p.groupId);
  const sectorIds = sectorPerms.map((p) => p.sectorId);

  const clientIds = await getClientIdsForUser(userId);

  const toolPerms = await prisma.toolPermission.findMany({
    where: {
      tool: { slug: "alteracao-despesa", status: "active", clientId: { in: Array.from(clientIds) } },
      OR: [
        { principalType: "user", principalId: userId },
        ...(groupIds.length ? [{ principalType: "group" as const, principalId: { in: groupIds } }] : []),
        ...(sectorIds.length ? [{ principalType: "sector" as const, principalId: { in: sectorIds } }] : []),
      ],
    },
    include: { tool: { include: { client: { select: { id: true, name: true } } } } },
  });

  const seen = new Set<string>();
  const tools: AlteracaoDespesaTool[] = [];
  for (const tp of toolPerms) {
    const t = tp.tool;
    if (t?.client && !seen.has(t.id)) {
      seen.add(t.id);
      tools.push({
        id: t.id,
        clientId: t.clientId,
        client: { id: t.client.id, name: t.client.name },
      });
    }
  }
  return tools;
}

export async function canUserAccessAlteracaoDespesa(
  userId: string,
  toolId: string,
  clientId: string
): Promise<boolean> {
  const clientIds = await getClientIdsForUser(userId);
  if (!clientIds.has(clientId)) return false;

  const tools = await getAlteracaoDespesaToolsForUser(userId);
  return tools.some((t) => t.id === toolId && t.clientId === clientId);
}

export async function canUserAccessAlteracaoDespesaForClient(
  userId: string,
  clientId: string
): Promise<boolean> {
  const tools = await getAlteracaoDespesaToolsForUser(userId);
  return tools.some((t) => t.clientId === clientId);
}

/** Acesso direto à Alteração de Despesa - admin; ou ToolPermission; ou ClientTool; ou cliente PMG */
export async function canUserAccessAlteracaoDespesaPmg(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (user?.role === "admin") return true;

  // Permissão via ToolPermission (Admin → Permissões)
  const alteracaoTools = await getAlteracaoDespesaToolsForUser(userId);
  if (alteracaoTools.length > 0) return true;

  // Ferramenta visível em Ferramentas (ClientTool)
  const allTools = await getToolsForUser(userId);
  if (allTools.some((t) => t.slug === "alteracao-despesa")) return true;

  const clientIds = await getClientIdsForUser(userId);
  if (clientIds.size === 0) return false;

  const pmgClient = await prisma.client.findFirst({
    where: {
      id: { in: Array.from(clientIds) },
      deletedAt: null,
      status: "active",
      OR: [
        { name: { contains: "PMG", mode: "insensitive" } },
        { name: { contains: "Rede PMG", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return !!pmgClient;
}
