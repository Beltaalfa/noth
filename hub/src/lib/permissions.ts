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
    if (ct.tool.status === "active" && !seen.has(ct.tool.id)) {
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
